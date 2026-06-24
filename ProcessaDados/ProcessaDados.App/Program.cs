using AngleSharp;
using HtmlAgilityPack;
using Microsoft.Playwright;
using Newtonsoft.Json;
using ProcessaDados.App;
using ProcessaDados.App.Models;
using ProcessaDados.App.Models.Db;
using ProcessaDados.App.Models.HttpResponse;
using Serilog;
using Simple.Sqlite;
using System.Collections.Concurrent;
using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using Cookie = System.Net.Cookie;

// Configurando o Serilog
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

Log.Information("Aplicação iniciada: v1.2.1");

const string filePath = "config.json";

var config = leArquivoConfig(filePath);
if (config == null)
{
    Log.Error($"Não foi localizado o arquivo de configuração: {filePath}.\nEncerrando aplicação.");
    return;
}
else
{
    Log.Information($"Arquivo de configuração localizado: {filePath}");
}

// Cria uma nova instância de conexão com o BD
using var cnn = ConnectionFactory.CreateConnection(config?.DbPath);

// Cria o schema do BD
cnn.CreateTables()
   .Add<ItemCaptured>()
   .Add<CollectData>()
   .Add<Item>()
   .Add<ServiceMethod>()
   .Add<Heroes>()
   .Commit();

// Popula os serviços que serão utilizados
cnn.Insert(new ServiceMethod() { ServiceType = ServiceType.STEAM }, OnConflict.Ignore);
cnn.Insert(new ServiceMethod() { ServiceType = ServiceType.DMARKET }, OnConflict.Ignore);

Log.Information("Iniciando captura de dados...");

//await capturaIdItens(cnn, config?.Items);

var itens = cnn.Query<Item>(@"SELECT * FROM Item ORDER BY Name");

// utilizei o itens do DB pois é o mesmo do config.json e ficaria mais fácil de testar com os IDs
// Para novos itens, gravar antes utilizando o método capturaIdItens, para que o ID seja salvo no DB
// TODO: Futuramente seria interessante utilizar em conjunto com o método capturaIdItens e já baixar as imagens
//await capturaImagensItens(cnn, config?.ImgPath, itens);

//await pegaHeroiIdPorItens(cnn, itens);

Log.Information("Iniciando captura do valor do dolar");
//var exchangeRate = await capturaExchangeRateMethod1(cnn, config?.AwesomeApiKey ?? string.Empty);
var exchangeRate = await capturaExchangeRateMethod2(cnn);

Log.Information($"Cotação do dólar: {exchangeRate}");

if (exchangeRate == 0)
{
    Log.Error("Erro ao capturar a cotação do dólar. Encerrando aplicação.");
    return;
}

Log.Information("Obtendo sessão da Steam...");
var steamCookies = await getSteamCookiesAsync();
//var steamCookies = config?.SteamCookies ?? string.Empty;
var steamTask = steam_playwright_fast(cnn, exchangeRate, itens, steamCookies);
var dmarketTask = dmarket(cnn, exchangeRate, itens);

await Task.WhenAll(
    steamTask,
    dmarketTask
);
Log.Information("Captura de dados finalizada");

var itensNaoCapturados = steamTask.Result;

if (itensNaoCapturados.Count > 0)
{
    Log.Information(
    "[STEAM] Primeira tentativa finalizada. {Count} itens pendentes.",
    itensNaoCapturados.Count
    );
    await steamRetry(cnn, exchangeRate, itensNaoCapturados, steamCookies);
}

WindowsToast.Notify("Processa dados finalizado com sucesso!");

Console.WriteLine("Pressione ENTER para sair...");
Console.ReadLine();

/// <summary>
/// Método para capturar dados do site STEAM
/// </summary>
/// <param name="cnn">Sqlite Connection</param>
/// <param name="exchangeRate">Valor da cotação atual do BRL em relação ao USD</param>
/// <param name="itens">Lista que contém os dados sobre os itens</param>
/// <param name="steamCookies">Cookies para a requisição</param>
/// <returns></returns>
[Obsolete("Esse método está obsoleto devido à alteração na busca avançada do marketplace da Steam")]
static async Task<List<Item>> steam(ISqliteConnection cnn, decimal exchangeRate, IEnumerable<Item> itens, string steamCookies)
{
    // Número máximo de tentativas
    // se a steam estiver chata, aumentar esse número para 10
    const int maxRetries = 3;

    var bulk_Data = new List<CollectData>();
    var captureId = Guid.NewGuid();

    const string baseUrl = "https://steamcommunity.com/market/search?appid=570&q=prop_def_index:";

    var cookieContainer = new CookieContainer();
    using var handler = new HttpClientHandler { CookieContainer = cookieContainer };
    using var client = new HttpClient(handler);
    // add referer header
    client.DefaultRequestHeaders.Add("Referer", "https://steamcommunity.com/market/search?appid=570");

    var itensUnsolved = new List<Item>();

    foreach (var cookie in steamCookies.Split(';'))
    {
        var cookieParts = cookie.Split('=', 2);
        if (cookieParts.Length == 2)
        {
            try
            {
                string name = cookieParts[0].Trim();
                string value = cookieParts[1].Trim();
                cookieContainer.Add(new Cookie(name, value, "/", "steamcommunity.com"));
            }
            catch (Exception)
            {
                Log.Error($"Erro ao adicionar cookie: {cookie}");
                continue;
            }
        }
    }

    foreach (var item in itens)
    {
        // Função para fazer a requisição com tentativas
        var attempt = 0;
        var success = false;

        while (attempt < maxRetries && !success)
        {
            //await Task.Delay(5000); // Delay caso a steam esteja chata
            if (attempt > 0) await Task.Delay(2000);

            try
            {
                // URL para o GET
                var uri = new Uri($"{baseUrl}{item.ItemId}");

                // Requisição GET com o cookie de autenticação
                var response = await client.GetAsync(uri);
                string htmlContent = await response.Content.ReadAsStringAsync();

                // Expressão regular para encontrar os valores de `data-price`
                var matches = Rx_DataPrice().Matches(htmlContent);

                // Obtém todos os valores numéricos encontrados, converte para inteiro e filtra os maiores que 0
                var prices = matches
                    .Select(m => int.Parse(m.Groups[1].Value))
                    .Where(price => price > 0)
                    .ToList();

                // Obtém o menor valor e divide por 100, caso existam valores válidos
                decimal lowestPrice = prices.Count != 0 ? prices.Min() / 100m : 0;

                if (lowestPrice > 0)
                {
                    bulk_Data.Add(new CollectData()
                    {
                        CaptureId = captureId,
                        ItemId = item.ItemId,
                        Price = lowestPrice,
                    });
                    Log.Information($"[{nameof(ServiceMethod.ServiceType.STEAM)}] {lowestPrice:C} | {item.Name}");
                    success = true;
                }
                else
                {
                    Log.Warning($"[{nameof(ServiceMethod.ServiceType.STEAM)}] Nenhum preço válido encontrado: {item.Name}");
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, $"[{nameof(ServiceMethod.ServiceType.STEAM)}] Erro na tentativa {attempt + 1} para o item {item.Name}");
            }

            attempt++;

            if (attempt == maxRetries)
            {
                Log.Error($"[{nameof(ServiceMethod.ServiceType.STEAM)}] Máximo de tentativas atingido para o item {item.Name}");

                itensUnsolved.Add(item);
            }
        }
    }

    cnn.BulkInsert(bulk_Data);

    cnn.Insert(new ItemCaptured()
    {
        CaptureId = captureId,
        ServiceType = ServiceType.STEAM,
        DateTime = DateTime.Now,
        ExchangeRate = exchangeRate,
    });

    Log.Information($"[{nameof(ServiceMethod.ServiceType.STEAM)}] Inseridos: {bulk_Data.Count} itens");

    if (itensUnsolved.Count > 0)
    {
        Log.Warning($"[{nameof(ServiceMethod.ServiceType.STEAM)}] Itens não capturados: {itensUnsolved.Count}");
    }

    return itensUnsolved;
}

static async Task<List<Item>> steam_httpClient(ISqliteConnection cnn, decimal exchangeRate, IEnumerable<Item> itens, string steamCookies)
{
    // Número máximo de tentativas
    // se a steam estiver chata, aumentar esse número para 10
    const int maxRetries = 3;

    var bulk_Data = new List<CollectData>();
    var captureId = Guid.NewGuid();

    const string baseUrl = "https://steamcommunity.com/market/search?appid=570";

    var cookieContainer = new CookieContainer();
    using var handler = new HttpClientHandler { CookieContainer = cookieContainer };
    using var client = new HttpClient(handler);
    // add referer header
    client.DefaultRequestHeaders.Add("Referer", "https://steamcommunity.com/market/search?appid=570");

    var steamRarityParamDic = populaDictionarySteamRarityParams();
    var steamHeroParamDic = populaDictionarySteamHeroParams();

    var itensUnsolved = new List<Item>();

    foreach (var cookie in steamCookies.Split(';'))
    {
        var cookieParts = cookie.Split('=', 2);
        if (cookieParts.Length == 2)
        {
            try
            {
                string name = cookieParts[0].Trim();
                string value = cookieParts[1].Trim();
                cookieContainer.Add(new Cookie(name, value, "/", "steamcommunity.com"));
            }
            catch (Exception)
            {
                Log.Error($"Erro ao adicionar cookie: {cookie}");
                continue;
            }
        }
    }

    foreach (var item in itens)
    {
        // Função para fazer a requisição com tentativas
        var attempt = 0;
        var success = false;

        while (attempt < maxRetries && !success)
        {
            //await Task.Delay(5000); // Delay caso a steam esteja chata
            if (attempt > 0) await Task.Delay(2000);

            try
            {
                // Monta o URL com o parâmetro de busca avançada para o item específico
                var paramHero = steamHeroParamDic.ContainsKey(item.Hero) ? $"&category_570_Hero%5B%5D={steamHeroParamDic[item.Hero]}" : string.Empty;
                var paramRarity = steamRarityParamDic.ContainsKey(item.Rarity) ? $"&category_570_Rarity%5B%5D={steamRarityParamDic[item.Rarity]}" : string.Empty;
                var paramItemName = $"&q={Uri.EscapeDataString(item.Name.Trim())}";

                // URL para o GET
                var uri = new Uri($"{baseUrl}{paramHero}{paramRarity}{paramItemName}");

                // Requisição GET com o cookie de autenticação
                var response = await client.GetAsync(uri);
                string htmlContent = await response.Content.ReadAsStringAsync();

                // Carrega HTML
                var doc = new HtmlDocument();
                doc.LoadHtml(htmlContent);

                // Lista dos links encontrados
                var resultados = new List<HtmlNode>();

                //// Seleciona todos <a> cujo id começa com "resultlink_"
                //var links = doc.DocumentNode.SelectNodes("//a[starts-with(@id, 'resultlink_')]");

                //var prices = new List<int>();

                //if (links != null)
                //{
                //    foreach (var link in links)
                //    {
                //        // Busca span específico do nome
                //        var span = link.SelectSingleNode(".//span[contains(@id, '_name')]");

                //        if (span == null)
                //            continue;

                //        string nomeItemHtml = HtmlEntity.DeEntitize(span.InnerText).Trim();

                //        if (!nomeItemHtml.Contains(item.Name, StringComparison.OrdinalIgnoreCase))
                //            continue;

                //        string itemHtml = link.InnerHtml;

                //        var matches = Rx_DataPrice().Matches(itemHtml);

                //        prices.AddRange(
                //            matches
                //                .Select(m => int.Parse(m.Groups[1].Value))
                //                .Where(price => price > 0)
                //        );
                //    }
                //}

                // Seleciona todos os links
                var links = doc.DocumentNode.SelectNodes("//a[contains(@href, '/market/listings/570/')]");

                var prices = new List<decimal>();

                if (links != null)
                {
                    foreach (var link in links)
                    {
                        // Nome do item
                        var nameNode = link.SelectSingleNode(".//span[contains(@style, '--text-weight:var(--font-weight-heavy)')]");

                        if (nameNode == null)
                            continue;

                        string nomeItemHtml = HtmlEntity.DeEntitize(nameNode.InnerText).Trim();

                        // Comparação do nome
                        if (!nomeItemHtml.Contains(item.Name, StringComparison.OrdinalIgnoreCase))
                            continue;

                        // Procura texto com "From R$"
                        var priceNode = link.SelectSingleNode(".//span[contains(text(), 'From R$')]");

                        if (priceNode == null)
                            continue;

                        string priceText = HtmlEntity.DeEntitize(priceNode.InnerText).Trim();

                        // Exemplo: "From R$25.56"
                        var match = Regex.Match(priceText, @"R\$(\d+[.,]?\d*)");

                        if (!match.Success)
                            continue;

                        string value = match.Groups[1].Value.Replace(".", "").Replace(",", ".");

                        if (decimal.TryParse(
                            value,
                            System.Globalization.NumberStyles.Any,
                            System.Globalization.CultureInfo.InvariantCulture,
                            out decimal price))
                        {
                            prices.Add(price);
                        }
                    }
                }

                // Obtém o menor valor
                decimal lowestPrice = prices.Count != 0
                    ? prices.Min() / 100m
                    : 0;

                if (lowestPrice > 0)
                {
                    bulk_Data.Add(new CollectData()
                    {
                        CaptureId = captureId,
                        ItemId = item.ItemId,
                        Price = lowestPrice,
                    });

                    Log.Information($"[{nameof(ServiceMethod.ServiceType.STEAM)}] {lowestPrice:C} | {item.Name}");
                    success = true;
                }
                else
                {
                    Log.Warning($"[{nameof(ServiceMethod.ServiceType.STEAM)}] Nenhum preço válido encontrado: {item.Name}");
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, $"[{nameof(ServiceMethod.ServiceType.STEAM)}] Erro na tentativa {attempt + 1} para o item {item.Name}");
            }

            attempt++;

            if (attempt == maxRetries)
            {
                Log.Error($"[{nameof(ServiceMethod.ServiceType.STEAM)}] Máximo de tentativas atingido para o item {item.Name}");

                itensUnsolved.Add(item);
            }
        }
    }

    cnn.BulkInsert(bulk_Data);

    cnn.Insert(new ItemCaptured()
    {
        CaptureId = captureId,
        ServiceType = ServiceType.STEAM,
        DateTime = DateTime.Now,
        ExchangeRate = exchangeRate,
    });

    Log.Information($"[{nameof(ServiceMethod.ServiceType.STEAM)}] Inseridos: {bulk_Data.Count} itens");

    if (itensUnsolved.Count > 0)
    {
        Log.Warning($"[{nameof(ServiceMethod.ServiceType.STEAM)}] Itens não capturados: {itensUnsolved.Count}");
    }

    return itensUnsolved;
}

static async Task<List<Item>> steam_playwright_slow(ISqliteConnection cnn, decimal exchangeRate, IEnumerable<Item> itens, string steamCookies)
{
    const int maxRetries = 3;

    var bulk_Data = new List<CollectData>();
    var captureId = Guid.NewGuid();

    const string baseUrl = "https://steamcommunity.com/market/search?appid=570";

    var steamRarityParamDic = populaDictionarySteamRarityParams();
    var steamHeroParamDic = populaDictionarySteamHeroParams();

    var itensUnsolved = new List<Item>();

    using var playwright = await Playwright.CreateAsync();

    await using var browser = await playwright.Chromium.LaunchAsync(new()
    {
        Headless = true
    });

    var context = await browser.NewContextAsync(new()
    {
        StorageStatePath = "steam-session.json",
        Locale = "pt-BR",
        TimezoneId = "America/Sao_Paulo",
        UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
    });

    //var cookies = new List<Microsoft.Playwright.Cookie>();

    //foreach (var cookie in steamCookies.Split(';'))
    //{
    //    var cookieParts = cookie.Split('=', 2);

    //    if (cookieParts.Length != 2)
    //        continue;

    //    try
    //    {
    //        cookies.Add(new Microsoft.Playwright.Cookie
    //        {
    //            Name = cookieParts[0].Trim(),
    //            Value = cookieParts[1].Trim(),
    //            Domain = ".steamcommunity.com",
    //            Path = "/"
    //        });
    //    }
    //    catch (Exception ex)
    //    {
    //        Log.Warning(ex, $"Erro ao adicionar cookie: {cookie}");
    //    }
    //}

    //await context.AddCookiesAsync(cookies);

    var page = await context.NewPageAsync();

    foreach (var item in itens)
    {
        var attempt = 0;
        var success = false;

        while (attempt < maxRetries && !success)
        {
            try
            {
                if (attempt > 0)
                    await Task.Delay(2000);

                var paramHero = steamHeroParamDic.ContainsKey(item.Hero)
                    ? $"&category_570_Hero%5B%5D={steamHeroParamDic[item.Hero]}"
                    : string.Empty;

                var paramRarity = steamRarityParamDic.ContainsKey(item.Rarity)
                    ? $"&category_570_Rarity%5B%5D={steamRarityParamDic[item.Rarity]}"
                    : string.Empty;

                var paramItemName = $"&q={Uri.EscapeDataString(item.Name.Trim())}";

                var url = $"{baseUrl}{paramHero}{paramRarity}{paramItemName}&l=english";

                await page.GotoAsync(url, new()
                {
                    WaitUntil = WaitUntilState.NetworkIdle,
                    Timeout = 60000
                });

                // espera preços renderizarem
                //await page.WaitForTimeoutAsync(2000);

                var links = await page.QuerySelectorAllAsync("a[href*='/market/listings/570/']");

                var prices = new List<decimal>();

                foreach (var link in links)
                {
                    try
                    {
                        var text = await link.InnerTextAsync();

                        if (string.IsNullOrWhiteSpace(text))
                            continue;

                        if (!text.Contains(item.Name, StringComparison.OrdinalIgnoreCase))
                            continue;

                        /*
                         Exemplos:
                         From R$ 25,56
                         A partir de R$ 25,56
                        */

                        var match = Regex.Match(
                            text,
                            @"R\$\s?([\d.,]+)");

                        if (!match.Success)
                            continue;

                        var value = match.Groups[1].Value;

                        // detecta formato
                        if (value.Contains(",") && value.Contains("."))
                        {
                            // formato brasileiro: 1.234,56
                            if (value.LastIndexOf(",") > value.LastIndexOf("."))
                            {
                                value = value.Replace(".", "").Replace(",", ".");
                            }
                            else
                            {
                                // formato americano: 1,234.56
                                value = value.Replace(",", "");
                            }
                        }
                        else if (value.Contains(","))
                        {
                            // assume decimal brasileiro
                            value = value.Replace(",", ".");
                        }

                        if (decimal.TryParse(
                            value,
                            NumberStyles.Any,
                            CultureInfo.InvariantCulture,
                            out decimal price))
                        {
                            prices.Add(price);
                        }
                    }
                    catch (Exception ex)
                    {
                        Log.Warning(ex, $"Erro ao processar link do item {item.Name}");
                    }
                }

                decimal lowestPrice = prices.Count > 0
                    ? prices.Min()
                    : 0;

                if (lowestPrice > 0)
                {
                    bulk_Data.Add(new CollectData()
                    {
                        CaptureId = captureId,
                        ItemId = item.ItemId,
                        Price = lowestPrice
                    });

                    Log.Information(
                        $"[{nameof(ServiceMethod.ServiceType.STEAM)}] {lowestPrice:C} | {item.Name}");

                    success = true;
                }
                else
                {
                    Log.Warning(
                        $"[{nameof(ServiceMethod.ServiceType.STEAM)}] Nenhum preço válido encontrado: {item.Name}");
                }
            }
            catch (Exception ex)
            {
                Log.Error(
                    ex,
                    $"[{nameof(ServiceMethod.ServiceType.STEAM)}] Erro na tentativa {attempt + 1} para o item {item.Name}");
            }

            attempt++;

            if (attempt == maxRetries && !success)
            {
                Log.Error(
                    $"[{nameof(ServiceMethod.ServiceType.STEAM)}] Máximo de tentativas atingido para o item {item.Name}");

                itensUnsolved.Add(item);
            }
        }
    }

    cnn.BulkInsert(bulk_Data);

    cnn.Insert(new ItemCaptured()
    {
        CaptureId = captureId,
        ServiceType = ServiceType.STEAM,
        DateTime = DateTime.Now,
        ExchangeRate = exchangeRate,
    });

    Log.Information($"[{nameof(ServiceMethod.ServiceType.STEAM)}] Inseridos: {bulk_Data.Count} itens");

    if (itensUnsolved.Count > 0)
    {
        Log.Warning($"[{nameof(ServiceMethod.ServiceType.STEAM)}] Itens não capturados: {itensUnsolved.Count}");
    }

    return itensUnsolved;
}

static async Task<List<Item>> steam_playwright_fast(ISqliteConnection cnn, decimal exchangeRate, IEnumerable<Item> itens, string steamCookies)
{
    const int maxRetries = 3;
    const int maxConcurrency = 5;

    var bulk_Data = new ConcurrentBag<CollectData>();
    var itensUnsolved = new ConcurrentBag<Item>();

    var captureId = Guid.NewGuid();

    const string baseUrl = "https://steamcommunity.com/market/search?appid=570";

    var steamRarityParamDic = populaDictionarySteamRarityParams();
    var steamHeroParamDic = populaDictionarySteamHeroParams();

    using var playwright = await Playwright.CreateAsync();

    await using var browser = await playwright.Chromium.LaunchAsync(new()
    {
        Headless = true
    });

    var context = await browser.NewContextAsync(new()
    {
        StorageStatePath = "steam-session.json",
        Locale = "pt-BR",
        TimezoneId = "America/Sao_Paulo",
        UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
    });

    //var cookies = new List<Microsoft.Playwright.Cookie>();

    //foreach (var cookie in steamCookies.Split(';'))
    //{
    //    var cookieParts = cookie.Split('=', 2);

    //    if (cookieParts.Length != 2)
    //        continue;

    //    cookies.Add(new Microsoft.Playwright.Cookie
    //    {
    //        Name = cookieParts[0].Trim(),
    //        Value = cookieParts[1].Trim(),
    //        Domain = ".steamcommunity.com",
    //        Path = "/"
    //    });
    //}

    //await context.AddCookiesAsync(cookies);

    var semaphore = new SemaphoreSlim(maxConcurrency);

    var tasks = itens.Select(async item =>
    {
        await semaphore.WaitAsync();

        try
        {
            var page = await context.NewPageAsync();

            try
            {
                var attempt = 0;
                var success = false;

                while (attempt < maxRetries && !success)
                {
                    try
                    {
                        if (attempt > 0)
                            await Task.Delay(2000);

                        var paramHero = steamHeroParamDic.ContainsKey(item.Hero)
                            ? $"&category_570_Hero%5B%5D={steamHeroParamDic[item.Hero]}"
                            : string.Empty;

                        var paramRarity = steamRarityParamDic.ContainsKey(item.Rarity)
                            ? $"&category_570_Rarity%5B%5D={steamRarityParamDic[item.Rarity]}"
                            : string.Empty;

                        var paramItemName = $"&q={Uri.EscapeDataString(item.Name.Trim())}";

                        var url =
                            $"{baseUrl}{paramHero}{paramRarity}{paramItemName}&l=english";

                        await page.GotoAsync(url, new()
                        {
                            WaitUntil = WaitUntilState.DOMContentLoaded,
                            Timeout = 60000
                        });

                        var texts = await page
                            .Locator("a[href*='/market/listings/570/']")
                            .AllInnerTextsAsync();

                        var prices = new List<decimal>();

                        foreach (var text in texts)
                        {
                            try
                            {
                                if (string.IsNullOrWhiteSpace(text))
                                    continue;

                                if (!text.Contains(item.Name,
                                        StringComparison.OrdinalIgnoreCase))
                                    continue;

                                var match = Regex.Match(
                                    text,
                                    @"R\$\s?([\d.,]+)");

                                if (!match.Success)
                                    continue;

                                var value = match.Groups[1].Value;

                                if (value.Contains(",") && value.Contains("."))
                                {
                                    if (value.LastIndexOf(",") >
                                        value.LastIndexOf("."))
                                    {
                                        value = value
                                            .Replace(".", "")
                                            .Replace(",", ".");
                                    }
                                    else
                                    {
                                        value = value.Replace(",", "");
                                    }
                                }
                                else if (value.Contains(","))
                                {
                                    value = value.Replace(",", ".");
                                }

                                if (decimal.TryParse(
                                        value,
                                        NumberStyles.Any,
                                        CultureInfo.InvariantCulture,
                                        out decimal price))
                                {
                                    prices.Add(price);
                                }
                            }
                            catch (Exception ex)
                            {
                                Log.Warning(ex,
                                    $"Erro ao processar texto do item {item.Name}");
                            }
                        }

                        decimal lowestPrice =
                            prices.Count > 0
                                ? prices.Min()
                                : 0;

                        if (lowestPrice > 0)
                        {
                            bulk_Data.Add(new CollectData()
                            {
                                CaptureId = captureId,
                                ItemId = item.ItemId,
                                Price = lowestPrice
                            });

                            Log.Information(
                                $"[{nameof(ServiceMethod.ServiceType.STEAM)}] {lowestPrice:C} | {item.Name}");

                            success = true;
                        }
                    }
                    catch (Exception ex)
                    {
                        Log.Error(
                            ex,
                            $"[{nameof(ServiceMethod.ServiceType.STEAM)}] Erro tentativa {attempt + 1} item {item.Name}");
                    }

                    attempt++;
                }

                if (!success)
                {
                    itensUnsolved.Add(item);

                    Log.Warning(
                        $"[{nameof(ServiceMethod.ServiceType.STEAM)}] Não capturado: {item.Name}");
                }
            }
            finally
            {
                await page.CloseAsync();
            }
        }
        finally
        {
            semaphore.Release();
        }
    });

    await Task.WhenAll(tasks);

    cnn.BulkInsert(bulk_Data.ToList());

    cnn.Insert(new ItemCaptured()
    {
        CaptureId = captureId,
        ServiceType = ServiceType.STEAM,
        DateTime = DateTime.Now,
        ExchangeRate = exchangeRate,
    });

    Log.Information(
        $"[{nameof(ServiceMethod.ServiceType.STEAM)}] Inseridos: {bulk_Data.Count}");

    return itensUnsolved.ToList();
}

/// <summary>
/// Captura os IDs dos itens utilizando o Liquipedia
/// </summary>
/// <param name="cnn"></param>
/// <param name="items"></param>
/// <returns></returns>
static async Task capturaIdItens(ISqliteConnection cnn, List<string> items)
{
    HttpClient _httpClient = new();

    var bulk_Item = new List<Item>();

    // URL base da API
    const string baseUrl = "https://liquipedia.net/dota2/";

    foreach (var item in items)
    {
        var formattedItem = item.Replace(" ", "_");
        string encodedItem = Uri.EscapeDataString(formattedItem);
        string fullUrl = $"{baseUrl}{encodedItem}";

        try
        {
            // Enviar requisição GET
            HttpResponseMessage response = await _httpClient.GetAsync(fullUrl);

            if (response.IsSuccessStatusCode)
            {
                // Ler o HTML da resposta
                string htmlContent = await response.Content.ReadAsStringAsync();

                // Expressão regular para capturar o ID dentro da div com a class="infobox-image-text"
                var match = Regex.Match(htmlContent, @"<div class=""infobox-image-text"">ID:\s*(\d+)</div>");

                if (match.Success)
                {
                    string id = match.Groups[1].Value;
                    bulk_Item.Add(new Item { ItemId = int.Parse(id), Name = item });
                    Log.Information($"ID encontrado: {id} | {item}");
                }
                else
                {
                    bulk_Item.Add(new Item { ItemId = 0, Name = item });
                    Log.Warning($"ID não encontrado na página. Item: {item}");
                }
            }
            else
            {
                Log.Error($"Erro ao localizar o item: {item}");
                continue;
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, $"Erro ao processar o item: {item}");
            continue;
        }

        // Pequeno atraso para evitar sobrecarga na API
        await Task.Delay(500);
    }

    cnn.BulkInsert(bulk_Item, OnConflict.Ignore);
    Log.Information($"Inseridos: {bulk_Item.Count} itens");
}

/// <summary>
/// Método para capturar dados do site DMARKET
/// </summary>
/// <param name="cnn">Sqlite Connection</param>
/// <param name="items">Lista que contém os dados sobre os itens</param>
/// <param name="exchangeRate">Valor da cotação atual do BRL em relação ao USD</param>
/// <returns></returns>
static async Task dmarket(ISqliteConnection cnn, decimal exchangeRate, IEnumerable<Item> itens)
{
    var handler = new HttpClientHandler
    {
        AutomaticDecompression =
            DecompressionMethods.GZip |
            DecompressionMethods.Deflate |
            DecompressionMethods.Brotli
    };

    var _httpClient = new HttpClient(handler);

    // URL base e parâmetros fixos
    const string apiUrl = "https://api.dmarket.com/exchange/v1/market/items";
    const string params1 = "?side=market&orderBy=price&orderDir=asc&title=";
    const string params2 = "&priceFrom=0&priceTo=0&treeFilters=rarity%5B%5D=arcana,rarity%5B%5D=immortal&gameId=9a92&types=dmarket&myFavorites=false&cursor=&limit=100&currency=USD&platform=browser&isLoggedIn=true";

    var bulk_Data = new List<CollectData>();
    var captureId = Guid.NewGuid();

    foreach (var item in itens)
    {
        // Encode do nome do item para URL
        string encodedItemName = Uri.EscapeDataString(item.Name.Trim());
        string fullUrl = $"{apiUrl}{params1}{encodedItemName}{params2}";

        try
        {
            // Enviar requisição GET
            HttpResponseMessage response = await _httpClient.GetAsync(fullUrl);

            if (response.IsSuccessStatusCode)
            {
                // Lê a resposta e deserializa o arquivo JSON para um objeto
                string responseData = await response.Content.ReadAsStringAsync();

                var result = null as DmarketResponse;

                try
                {
                    result = JsonConvert.DeserializeObject<DmarketResponse>(responseData);
                }
                catch (JsonException ex)
                {
                    Log.Error(ex, "Erro ao desserializar JSON. Item: {Item}", item.Name);
                    continue;
                }
                if (result == null)
                {
                    Log.Warning($"[{nameof(ServiceMethod.ServiceType.DMARKET)}] Resposta nula para o item: [{item.ItemId}] {item.Name}");
                    continue;
                }

                var itemResult = getItemByEquality(item, result);

                // Ignora qualquer item com o título que está na lista de exclusão
                //var itemResult = result.objects.FirstOrDefault(o => !excludedTitles.Any(excluded => o.title.Contains(excluded, StringComparison.OrdinalIgnoreCase)));

                if (itemResult == null)
                {
                    Log.Warning($"[{nameof(ServiceMethod.ServiceType.DMARKET)}] Item não encontrado na resposta da API: [{item.ItemId}] {item.Name}");
                    continue;
                }

                // Converte o preço em DOLAR para BRL (em decimal com duas casas decimais)
                var priceBRL = Math.Round(decimal.Parse(itemResult.price.USD) * exchangeRate / 100, 2);

                Log.Information($"[{nameof(ServiceMethod.ServiceType.DMARKET)}] R$ {priceBRL} | {item.Name}");

                bulk_Data.Add(new CollectData()
                {
                    CaptureId = captureId,
                    ItemId = item.ItemId,
                    Price = priceBRL,
                });
            }
            else
            {
                Log.Warning($"[{nameof(ServiceMethod.ServiceType.DMARKET)}] Erro ({response.StatusCode}): {item.Name}");
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, $"[{nameof(ServiceMethod.ServiceType.DMARKET)}] Exceção ao processar '{item.Name}': {ex.Message}");
        }

        //// Pequeno atraso para evitar sobrecarga na API
        //await Task.Delay(500);
    }

    cnn.BulkInsert(bulk_Data);

    Log.Information($"[{nameof(ServiceMethod.ServiceType.DMARKET)}] Inseridos: {bulk_Data.Count} itens");

    cnn.Insert(new ItemCaptured()
    {
        CaptureId = captureId,
        ServiceType = ServiceType.DMARKET,
        DateTime = DateTime.Now,
        ExchangeRate = exchangeRate,
    });
}

static ProcessaDados.App.Models.HttpResponse.Object? getItemByEquality(Item item, DmarketResponse result)
{
    var itemQuality = new[] {
        "Normal", "Genuine", "Elder", "Unusual", "Self-Made", "Inscribed", "Cursed", "Heroic", "Favored",
        "Ascendant", "Autographed", "Legacy", "Exalted", "Frozen", "Corrupted", "Auspicious", "Infused"
    };

    // Pega o primeiro resultado de "result" onde objeto.title tenha itemQuality no COMEÇO + item.Name
    // ou apenas item.Name caso não contenha essa concatenação.
    // Ex: item.Name == "Basher of Mage Skulls", se tiver "Inscribed Offhand Basher of Mage Skulls" não é
    // o mesmo item, teria que ser "Inscribed Basher of Mage Skulls", pois "Inscribed" faz parte do itemQuality
    // e "Basher of Mage Skulls" é o nome exato, e não "Offhand Basher of Mage Skulls"

    // Problemas evitados: 
    // Mesmo item, porém Crimson (exceto a do Lion)
    // Itens de arma duas mãos, que só muda se offhand
    // Itens que não são do herói
    return result.objects.FirstOrDefault(obj =>
    {
        var itemNameTrimmed = item.Name.Trim();

        if (string.IsNullOrWhiteSpace(obj.title.Trim()))
            return false;

        // Caso 1: título é exatamente o nome do item
        if (string.Equals(obj.title.Trim(), itemNameTrimmed, StringComparison.OrdinalIgnoreCase))
            return true;

        // Caso 2: título começa com "<Quality> " + item.Name
        foreach (var quality in itemQuality)
        {
            var expected = $"{quality} {itemNameTrimmed}";

            if (string.Equals(obj.title.Trim(), expected, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    });
}

/// <summary>
/// Ignora qualquer item que contenha, comece, ou termine com o título da lista de exclusão
/// </summary>
[Obsolete("getItemByExcludeTitleList is deprecated, please use getItemByEquality instead.")]
static ProcessaDados.App.Models.HttpResponse.Object? getItemByExcludeTitleList(int itemId, DmarketResponse result)
{
    // Id do item que será tolerado mesmo que tenha o "excludedTitles",
    // exemplo: Blastmitt Berserker Bundle, Golden Flight of Epiphany ou Crimson Pique
    int[] exceptionItens = [23842, 12993, 7810, 7578, 35387];

    // Títulos que serão ignorados na captura
    var strStart = new[] {
        "Kinetic", "Loading Screen", "Bundle", "Golden", "Crimson",
        "Crownfall", "Exalted Call of the", "Exalted Voice of"
        };

    var strEnd = new[] { "Kinetic", "Loading Screen", "Bundle", "Golden", "Crimson" };

    var strContains = new[] { "Crownfall Sticker", "Style Unlock" };

    return exceptionItens.Contains(itemId) ?
        result.objects.FirstOrDefault() :
        result.objects.FirstOrDefault(o =>
            !strStart.Any(excluded => o.title.StartsWith(excluded, StringComparison.OrdinalIgnoreCase)) &&
            !strEnd.Any(excluded => o.title.EndsWith(excluded, StringComparison.OrdinalIgnoreCase)) &&
            !strContains.Any(excluded => o.title.Contains(excluded, StringComparison.OrdinalIgnoreCase))
        );
}

/// <summary>
/// Lê aquivo de configuração e desserializa para um objeto
/// </summary>
/// <param name="filePath">Caminho do arquivo de configuração</param>
/// <returns>Retorna um objeto ConfigJson ou nulo caso não localize</returns>
static ConfigJson? leArquivoConfig(string filePath)
{
    if (File.Exists(filePath))
    {
        string jsonContent = File.ReadAllText(filePath);
        return JsonConvert.DeserializeObject<ConfigJson>(jsonContent);
    }

    return null;
}

/// <summary>
/// Busca e salva imagens dos itens
/// </summary>
static async Task capturaImagensItens(ISqliteConnection cnn, string? imgPath, IEnumerable<Item> itens)
{
    HttpClient _httpClient = new();

    var bulk_Item = new List<Item>();

    // URL base da API
    const string host = "https://liquipedia.net";
    const string baseUrl = $"{host}/dota2/";

    // Obtém a lista de arquivos existentes na pasta e extrai os ItemIds
    var arquivosExistentes = Directory.GetFiles(imgPath, "*.png")
        .Select(Path.GetFileNameWithoutExtension)
        .Where(nome => int.TryParse(nome, out _))
        .ToHashSet();

    foreach (var item in itens)
    {
        string itemId = item.ItemId.ToString();

        // Se a imagem já existir na pasta, pula o item
        if (arquivosExistentes.Contains(itemId))
        {
            Log.Information($"Imagem já existente para ItemId {itemId}, pulando...");
            continue;
        }

        var formattedItem = item.Name.Replace(" ", "_");
        string encodedItem = Uri.EscapeDataString(formattedItem);
        string fullUrl = $"{baseUrl}{encodedItem}";

        try
        {
            // Enviar requisição GET
            HttpResponseMessage response = await _httpClient.GetAsync(fullUrl);

            if (response.IsSuccessStatusCode)
            {
                // Ler o HTML da resposta
                string htmlContent = await response.Content.ReadAsStringAsync();

                // Regex para encontrar uma imagem com width="600" height="400" e extensão .png
                string pattern = @"<img[^>]+src=""(?<src>[^""]+\.png)""[^>]*width=""600""[^>]*height=";
                Match match = Regex.Match(htmlContent, pattern, RegexOptions.IgnoreCase);

                if (match.Success)
                {
                    string imgSrc = match.Groups["src"].Value;
                    string imgUrl = imgSrc.StartsWith("http") ? imgSrc : host + imgSrc;

                    // Baixa e salva a imagem
                    Log.Information($"Baixando img: {item.Name}");
                    await downloadImage(imgUrl, item, imgPath);
                }
                else
                {
                    Log.Warning($"Img não encontrado. Item: {item.Name}");
                }
            }
            else
            {
                Log.Error($"Erro ao localizar a img: {item.Name}");
                continue;
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, $"Erro ao processar o item: {item}");
            continue;
        }

        // Pequeno atraso para evitar sobrecarga na API
        await Task.Delay(2000);
    }
}

static async Task downloadImage(string imgUrl, Item item, string? imgPath)
{
    HttpClient _httpClient = new();

    HttpResponseMessage imgResponse = await _httpClient.GetAsync(imgUrl);
    if (imgResponse.IsSuccessStatusCode)
    {
        byte[] imageBytes = await imgResponse.Content.ReadAsByteArrayAsync();
        string fileName = Path.GetFileName(new Uri(imgUrl).AbsolutePath);
        string filePath = Path.Combine(imgPath ?? Directory.GetCurrentDirectory(), item.ItemId.ToString() + ".png");

        await File.WriteAllBytesAsync(filePath, imageBytes);
        Log.Information($"Sucesso em baixar a img: {item.Name}");
    }
    else
    {
        Log.Error($"Falha ao baixar a imagem: {item.Name}");
    }
}

static async Task<decimal> capturaExchangeRateMethod1(ISqliteConnection cnn, string apiKey)
{
    const string url = "https://economia.awesomeapi.com.br/json/last/USD-BRL";

    HttpClient _httpClient = new();
    _httpClient.DefaultRequestHeaders.Add("x-api-key", apiKey);

    HttpResponseMessage response = await _httpClient.GetAsync(url);

    if (response.IsSuccessStatusCode)
    {
        string responseData = await response.Content.ReadAsStringAsync();
        var result = JsonConvert.DeserializeObject<ExchangeRateResponse>(responseData);
        if (result == null) return 0;
        return decimal.Parse(result.USDBRL.bid, CultureInfo.InvariantCulture);
    }
    return 0;
}

static async Task<decimal> capturaExchangeRateMethod2(ISqliteConnection cnn)
{
    const string url = "https://api.dmarket.com/currency-rate/v1/rates";

    var handler = new HttpClientHandler
    {
        AutomaticDecompression =
            DecompressionMethods.GZip |
            DecompressionMethods.Deflate |
            DecompressionMethods.Brotli
    };

    var _httpClient = new HttpClient(handler);

    HttpResponseMessage response = await _httpClient.GetAsync(url);
    if (response.IsSuccessStatusCode)
    {
        // Lê a resposta e deserializa o arquivo JSON para um objeto
        string responseData = await response.Content.ReadAsStringAsync();

        var exchangeRate = null as DmarketExchangeRateResponse;

        try
        {
            exchangeRate = JsonConvert.DeserializeObject<DmarketExchangeRateResponse>(responseData);
            if (exchangeRate == null) return 0;

            return exchangeRate.Rates.BRL;
        }
        catch (Exception ex)
        {
            return 0;
        }
    }
    return 0;
}

static async Task steamRetry(
    ISqliteConnection cnn,
    decimal exchangeRate,
    List<Item> itensNaoCapturados,
    string steamCookies)
{
    while (itensNaoCapturados.Count > 0)
    {
        WindowsToast.Notify("Processa dados pendente...");
        Console.WriteLine(
            $"[{nameof(ServiceMethod.ServiceType.STEAM)}] " +
            $"Existem {itensNaoCapturados.Count} itens que não foram capturados. " +
            $"Deseja tentar novamente apenas para esses itens? (Y/N)"
        );

        string? input = Console.ReadLine()?.Trim().ToUpper();

        if (input == "N")
        {
            Console.WriteLine("Pulando...");
            break;
        }

        if (input != "Y")
        {
            Console.WriteLine("Entrada inválida, tente novamente...");
            continue;
        }

        Console.WriteLine(
            $"[{nameof(ServiceMethod.ServiceType.STEAM)}] Reexecutando apenas para itens não capturados..."
        );

        var retryResult = await steam_playwright_slow(
            cnn,
            exchangeRate,
            itensNaoCapturados,
            steamCookies
        );

        if (retryResult.Count == 0)
        {
            Log.Information(
                $"[{nameof(ServiceMethod.ServiceType.STEAM)}] Retry concluído. Todos os itens foram capturados."
            );
            break;
        }

        Console.WriteLine(
            $"[{nameof(ServiceMethod.ServiceType.STEAM)}] Retry concluído, itens que ainda não foram capturados:"
        );

        foreach (var item in retryResult)
        {
            Console.WriteLine($"[{item.Id}] {item.Name}");
        }

        // Atualiza a lista para a próxima iteração do while
        itensNaoCapturados = retryResult;
    }
}

static async Task pegaHeroiIdPorItens(ISqliteConnection cnn, IEnumerable<Item> itens)
{
    // Lista com itens que não tem o ID de herói
    var itensSemHeroiId = itens.Where(i => i.Hero == Hero.None).ToList();

    var bulk_Item = new List<Item>();

    HttpClient _httpClient = new();
    // URL base da API
    const string host = "https://liquipedia.net";
    const string baseUrl = $"{host}/dota2/";

    foreach (var item in itensSemHeroiId)
    {
        var formattedItem = item.Name.Replace(" ", "_");
        string encodedItem = Uri.EscapeDataString(formattedItem);

        try
        {
            // Enviar requisição GET
            HttpResponseMessage response = await _httpClient.GetAsync($"{baseUrl}{encodedItem}");
            if (response.IsSuccessStatusCode)
            {
                // Ler o HTML da resposta
                string htmlContent = await response.Content.ReadAsStringAsync();

                var context = BrowsingContext.New(Configuration.Default);
                var document = await context.OpenAsync(req => req.Content(htmlContent));

                var element = document.QuerySelector(".heroes-panel__hero-card__title a");

                if (element != null)
                {
                    var heroName = element.TextContent.Trim();
                    //var heroLink = element.GetAttribute("href");

                    string normalizedHeroName =
                        heroName
                            .Replace("'", "")
                            .Replace("-", "")
                            .Replace(" ", "");

                    if (Enum.TryParse<Hero>(normalizedHeroName, ignoreCase: true, out var heroEnum))
                    {
                        // Adiciona o item a lista de bulk para atualização
                        var itemToUpdate = item;
                        itemToUpdate.Hero = heroEnum;
                        bulk_Item.Add(itemToUpdate);
                        Log.Information($"{item.Id}:{item.Name} | {(int)heroEnum}:{heroName}");
                    }
                    else
                    {
                        Log.Warning($"Herói não mapeado para o item: {item.Name} (Nome capturado: {heroName})");
                    }
                }
                else
                {
                    Log.Warning($"Herói não encontrado na página. Item: {item.Name}");
                }
            }
            else
            {
                Log.Error($"Erro ao capturar os heróis por itens: ({response.StatusCode})");
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, $"Exceção ao capturar os heróis por itens: {ex.Message}");
        }

        // Pequeno atraso para evitar sobrecarga na API que varia de 5000 e 7000 ms
        //await Task.Delay(new Random().Next(5000, 7000));
        await Task.Delay(200);
    }

    // Atualiza os itens com o Hero capturado
    try
    {
        cnn.BulkInsert(bulk_Item, OnConflict.Replace);
        Log.Information($"Atualizados: {bulk_Item.Count} itens com o Hero correspondente.");
    }
    catch (Exception)
    {
        Log.Error("Erro ao atualizar os itens com o Hero correspondente.");
    }
}

static async Task<string> getSteamCookiesAsync()
{
    const string sessionFile = "steam-session.json";
    bool hasSessionFile = File.Exists(sessionFile);

    using var playwright = await Playwright.CreateAsync();

    var browser = await playwright.Chromium.LaunchAsync(new()
    {
        Headless = true
    });

    // Checa se tem sessão e se está ativa

    var context = await browser.NewContextAsync(new()
    {
        StorageStatePath = hasSessionFile ? sessionFile : null,
        Locale = "pt-BR",
        TimezoneId = "America/Sao_Paulo",
        UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
    });

    // 🔍 VALIDAÇÃO AQUI
    var page = await context.NewPageAsync();

    // 🔑 navega para a página de histórico de compras, que exige login, para validar se a sessão é válida
    await page.GotoAsync("https://store.steampowered.com/account/history/");

    // Se a página tiver uma tabela de histórico de compras, é porque a sessão é válida e o usuário está logado
    bool isLogged = await page.Locator("#main_content > table").CountAsync() > 0;

    //Console.WriteLine("Cheque se está tudo certo e pressione ENTER...");
    //Console.ReadLine();

    if (!isLogged)
    {
        page = await context.NewPageAsync();

        await page.GotoAsync("https://store.steampowered.com/login/");

        //Console.WriteLine("Faça login na Steam e pressione ENTER...");
        //Console.ReadLine();

        // Remove sessão antiga antes de salvar
        if (File.Exists(sessionFile))
            File.Delete(sessionFile);

        await context.StorageStateAsync(new()
        {
            Path = sessionFile
        });
    }
    else
    {
        context = await browser.NewContextAsync(new()
        {
            StorageStatePath = hasSessionFile ? sessionFile : null,
            Locale = "pt-BR",
            TimezoneId = "America/Sao_Paulo",
            UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
        });

        // 🍪 Adiciona o cookie "bMarketOptOut=1;"
        // Esse cookie desabilita a versão beta do market, que tem uma estrutura diferente e pode quebrar a captura de dados
        //await context.AddCookiesAsync([new Microsoft.Playwright.Cookie
        //{
        //    Name = "bMarketOptOut",
        //    Value = "1",
        //    Domain = ".steamcommunity.com",
        //    Path = "/"
        //}]);
    }

    // 🍪 Extrai cookies
    var cookies = (await context.CookiesAsync())
    .GroupBy(c => c.Name)
    .Select(g => g.Last());

    var cookieString = new StringBuilder();

    foreach (var cookie in cookies)
    {
        cookieString.Append($"{cookie.Name}={cookie.Value}; ");
    }

    return cookieString.ToString();
}

static Dictionary<ItemRarity, string> populaDictionarySteamRarityParams()
{
    return new Dictionary<ItemRarity, string>
    {
        { ItemRarity.Ancient, "tag_Rarity_Ancient" },
        { ItemRarity.Arcana, "tag_Rarity_Arcana" },
        { ItemRarity.Common, "tag_Rarity_Common" },
        { ItemRarity.Uncommon, "tag_Rarity_Uncommon" },
        { ItemRarity.Immortal, "tag_Rarity_Immortal" },
        { ItemRarity.Legendary, "tag_Rarity_Legendary" },
        { ItemRarity.Mythical, "tag_Rarity_Mythical" },
        { ItemRarity.Rare, "tag_Rarity_Rare" },
    };
}

static Dictionary<Hero, string> populaDictionarySteamHeroParams()
{
    return new Dictionary<Hero, string>
    {
        // Personas
        { Hero.AntimagePersona1, "tag_npc_dota_hero_antimage_persona1" },
        { Hero.CrystalMaidenPersona1, "tag_npc_dota_hero_crystal_maiden_persona1" },
        { Hero.PudgePersona1, "tag_npc_dota_hero_pudge_persona1" },
        { Hero.InvokerPersona1, "tag_npc_dota_hero_invoker_persona1" },
        // Heróis
        { Hero.Abaddon, "tag_npc_dota_hero_abaddon" },
        { Hero.Alchemist, "tag_npc_dota_hero_alchemist" },
        { Hero.AncientApparition, "tag_npc_dota_hero_ancient_apparition" },
        { Hero.Antimage, "tag_npc_dota_hero_antimage" },
        { Hero.ArcWarden, "tag_npc_dota_hero_arc_warden" },
        { Hero.Axe, "tag_npc_dota_hero_axe" },
        { Hero.Bane, "tag_npc_dota_hero_bane" },
        { Hero.Batrider, "tag_npc_dota_hero_batrider" },
        { Hero.Beastmaster, "tag_npc_dota_hero_beastmaster" },
        { Hero.Bloodseeker, "tag_npc_dota_hero_bloodseeker" },
        { Hero.BountyHunter, "tag_npc_dota_hero_bounty_hunter" },
        { Hero.Brewmaster, "tag_npc_dota_hero_brewmaster" },
        { Hero.Bristleback, "tag_npc_dota_hero_bristleback" },
        { Hero.Broodmother, "tag_npc_dota_hero_broodmother" },
        { Hero.CentaurWarrunner, "tag_npc_dota_hero_centaur" },
        { Hero.ChaosKnight, "tag_npc_dota_hero_chaos_knight" },
        { Hero.Chen, "tag_npc_dota_hero_chen" },
        { Hero.Clinkz, "tag_npc_dota_hero_clinkz" },
        { Hero.CrystalMaiden, "tag_npc_dota_hero_crystal_maiden" },
        { Hero.DarkSeer, "tag_npc_dota_hero_dark_seer" },
        { Hero.DarkWillow, "tag_npc_dota_hero_dark_willow" },
        { Hero.Dawnbreaker, "tag_npc_dota_hero_dawnbreaker" },
        { Hero.Dazzle, "tag_npc_dota_hero_dazzle" },
        { Hero.DeathProphet, "tag_npc_dota_hero_death_prophet" },
        { Hero.Disruptor, "tag_npc_dota_hero_disruptor" },
        { Hero.Doom, "tag_npc_dota_hero_doom_bringer" },
        { Hero.DragonKnight, "tag_npc_dota_hero_dragon_knight" },
        { Hero.DrowRanger, "tag_npc_dota_hero_drow_ranger" },
        { Hero.EarthSpirit, "tag_npc_dota_hero_earth_spirit" },
        { Hero.Earthshaker, "tag_npc_dota_hero_earthshaker" },
        { Hero.ElderTitan, "tag_npc_dota_hero_elder_titan" },
        { Hero.EmberSpirit, "tag_npc_dota_hero_ember_spirit" },
        { Hero.Enchantress, "tag_npc_dota_hero_enchantress" },
        { Hero.Enigma, "tag_npc_dota_hero_enigma" },
        { Hero.FacelessVoid, "tag_npc_dota_hero_faceless_void" },
        { Hero.NaturesProphet, "tag_npc_dota_hero_furion" },
        { Hero.Grimstroke, "tag_npc_dota_hero_grimstroke" },
        { Hero.Gyrocopter, "tag_npc_dota_hero_gyrocopter" },
        { Hero.Hoodwink, "tag_npc_dota_hero_hoodwink" },
        { Hero.Huskar, "tag_npc_dota_hero_huskar" },
        { Hero.Invoker, "tag_npc_dota_hero_invoker" },
        { Hero.Jakiro, "tag_npc_dota_hero_jakiro" },
        { Hero.Juggernaut, "tag_npc_dota_hero_juggernaut" },
        { Hero.KeeperOfTheLight, "tag_npc_dota_hero_keeper_of_the_light" },
        { Hero.Kez, "tag_npc_dota_hero_kez" },
        { Hero.Kunkka, "tag_npc_dota_hero_kunkka" },
        { Hero.Largo, "tag_npc_dota_hero_largo" },
        { Hero.LegionCommander, "tag_npc_dota_hero_legion_commander" },
        { Hero.Leshrac, "tag_npc_dota_hero_leshrac" },
        { Hero.Lich, "tag_npc_dota_hero_lich" },
        { Hero.LifeStealer, "tag_npc_dota_hero_life_stealer" },
        { Hero.Lina, "tag_npc_dota_hero_lina" },
        { Hero.Lion, "tag_npc_dota_hero_lion" },
        { Hero.LoneDruid, "tag_npc_dota_hero_lone_druid" },
        { Hero.Luna, "tag_npc_dota_hero_luna" },
        { Hero.Lycan, "tag_npc_dota_hero_lycan" },
        { Hero.Magnus, "tag_npc_dota_hero_magnataur" },
        { Hero.Marci, "tag_npc_dota_hero_marci" },
        { Hero.Mars, "tag_npc_dota_hero_mars" },
        { Hero.Medusa, "tag_npc_dota_hero_medusa" },
        { Hero.Meepo, "tag_npc_dota_hero_meepo" },
        { Hero.Mirana, "tag_npc_dota_hero_mirana" },
        { Hero.MonkeyKing, "tag_npc_dota_hero_monkey_king" },
        { Hero.Morphling, "tag_npc_dota_hero_morphling" },
        { Hero.Muerta, "tag_npc_dota_hero_muerta" },
        { Hero.NagaSiren, "tag_npc_dota_hero_naga_siren" },
        { Hero.Necrophos, "tag_npc_dota_hero_necrolyte" },
        { Hero.ShadowFiend, "tag_npc_dota_hero_nevermore" },
        { Hero.NightStalker, "tag_npc_dota_hero_night_stalker" },
        { Hero.NyxAssassin, "tag_npc_dota_hero_nyx_assassin" },
        { Hero.OutworldDestroyer, "tag_npc_dota_hero_obsidian_destroyer" },
        { Hero.OgreMagi, "tag_npc_dota_hero_ogre_magi" },
        { Hero.Omniknight, "tag_npc_dota_hero_omniknight" },
        { Hero.Oracle, "tag_npc_dota_hero_oracle" },
        { Hero.Pangolier, "tag_npc_dota_hero_pangolier" },
        { Hero.PhantomAssassin, "tag_npc_dota_hero_phantom_assassin" },
        { Hero.PhantomLancer, "tag_npc_dota_hero_phantom_lancer" },
        { Hero.Phoenix, "tag_npc_dota_hero_phoenix" },
        { Hero.PrimalBeast, "tag_npc_dota_hero_primal_beast" },
        { Hero.Puck, "tag_npc_dota_hero_puck" },
        { Hero.Pudge, "tag_npc_dota_hero_pudge" },
        { Hero.Pugna, "tag_npc_dota_hero_pugna" },
        { Hero.Queenofpain, "tag_npc_dota_hero_queenofpain" },
        { Hero.Clockwerk, "tag_npc_dota_hero_rattletrap" },
        { Hero.Razor, "tag_npc_dota_hero_razor" },
        { Hero.Riki, "tag_npc_dota_hero_riki" },
        { Hero.Ringmaster, "tag_npc_dota_hero_ringmaster" },
        { Hero.Rubick, "tag_npc_dota_hero_rubick" },
        { Hero.SandKing, "tag_npc_dota_hero_sand_king" },
        { Hero.ShadowDemon, "tag_npc_dota_hero_shadow_demon" },
        { Hero.ShadowShaman, "tag_npc_dota_hero_shadow_shaman" },
        { Hero.Timbersaw, "tag_npc_dota_hero_shredder" },
        { Hero.Silencer, "tag_npc_dota_hero_silencer" },
        { Hero.WraithKing, "tag_npc_dota_hero_skeleton_king" },
        { Hero.SkywrathMage, "tag_npc_dota_hero_skywrath_mage" },
        { Hero.Slardar, "tag_npc_dota_hero_slardar" },
        { Hero.Slark, "tag_npc_dota_hero_slark" },
        { Hero.Snapfire, "tag_npc_dota_hero_snapfire" },
        { Hero.Sniper, "tag_npc_dota_hero_sniper" },
        { Hero.Spectre, "tag_npc_dota_hero_spectre" },
        { Hero.SpiritBreaker, "tag_npc_dota_hero_spirit_breaker" },
        { Hero.StormSpirit, "tag_npc_dota_hero_storm_spirit" },
        { Hero.Sven, "tag_npc_dota_hero_sven" },
        { Hero.Techies, "tag_npc_dota_hero_techies" },
        { Hero.TemplarAssassin, "tag_npc_dota_hero_templar_assassin" },
        { Hero.Terrorblade, "tag_npc_dota_hero_terrorblade" },
        { Hero.Tidehunter, "tag_npc_dota_hero_tidehunter" },
        { Hero.Tinker, "tag_npc_dota_hero_tinker" },
        { Hero.Tiny, "tag_npc_dota_hero_tiny" },
        { Hero.TreantProtector, "tag_npc_dota_hero_treant" },
        { Hero.TrollWarlord, "tag_npc_dota_hero_troll_warlord" },
        { Hero.Tusk, "tag_npc_dota_hero_tusk" },
        { Hero.Underlord, "tag_npc_dota_hero_abyssal_underlord" },
        { Hero.Undying, "tag_npc_dota_hero_undying" },
        { Hero.Ursa, "tag_npc_dota_hero_ursa" },
        { Hero.Vengefulspirit, "tag_npc_dota_hero_vengefulspirit" },
        { Hero.Venomancer, "tag_npc_dota_hero_venomancer" },
        { Hero.Viper, "tag_npc_dota_hero_viper" },
        { Hero.Visage, "tag_npc_dota_hero_visage" },
        { Hero.VoidSpirit, "tag_npc_dota_hero_void_spirit" },
        { Hero.Warlock, "tag_npc_dota_hero_warlock" },
        { Hero.Weaver, "tag_npc_dota_hero_weaver" },
        { Hero.Windranger, "tag_npc_dota_hero_windrunner" },
        { Hero.WinterWyvern, "tag_npc_dota_hero_winter_wyvern" },
        { Hero.Io, "tag_npc_dota_hero_wisp" },
        { Hero.WitchDoctor, "tag_npc_dota_hero_witch_doctor" },
        { Hero.Zeus, "tag_npc_dota_hero_zuus" }
    };
}

partial class Program
{
    [GeneratedRegex(@"data-price=""(\d+)""")]
    private static partial Regex Rx_DataPrice();

    [GeneratedRegex(@"<[^>]*class=[""'][^""']*heroes-panel__hero-card__title[^""']*[""'][^>]*>[\s\S]*?<a[^>]*>(.*?)<\/a>", RegexOptions.Singleline)]
    private static partial Regex Rx_HeroName();
}
