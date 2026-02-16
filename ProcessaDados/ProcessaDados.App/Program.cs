using AngleSharp;
using Newtonsoft.Json;
using ProcessaDados.App;
using ProcessaDados.App.Models;
using ProcessaDados.App.Models.Db;
using ProcessaDados.App.Models.HttpResponse;
using Serilog;
using Simple.Sqlite;
using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;

// Configurando o Serilog
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

Log.Information("Aplicação iniciada: v1.1.2");

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

var dmarketTask = dmarket(cnn, exchangeRate, itens);
var steamTask = steam(cnn, exchangeRate, itens, config?.SteamCookies ?? string.Empty);

await Task.WhenAll(steamTask, dmarketTask);

Log.Information("Captura de dados finalizada");

var itensNaoCapturados = steamTask.Result;

if (itensNaoCapturados.Count > 0)
{
    Log.Information(
    "[STEAM] Primeira tentativa finalizada. {Count} itens pendentes.",
    itensNaoCapturados.Count
    );
    await steamRetry(config, cnn, exchangeRate, itensNaoCapturados);
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
    ConfigJson? config,
    ISqliteConnection cnn,
    decimal exchangeRate,
    List<Item> itensNaoCapturados
    )
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

        var retryResult = await steam(
            cnn,
            exchangeRate,
            itensNaoCapturados,
            config?.SteamCookies
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

partial class Program
{
    [GeneratedRegex(@"data-price=""(\d+)""")]
    private static partial Regex Rx_DataPrice();

    [GeneratedRegex(@"<[^>]*class=[""'][^""']*heroes-panel__hero-card__title[^""']*[""'][^>]*>[\s\S]*?<a[^>]*>(.*?)<\/a>", RegexOptions.Singleline)]
    private static partial Regex Rx_HeroName();
}
