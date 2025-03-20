using Newtonsoft.Json;
using ProcessaDados.App.Models;
using ProcessaDados.App.Models.Db;
using ProcessaDados.App.Models.HttpResponse;
using Serilog;
using Simple.Sqlite;
using System.Net;
using System.Text.RegularExpressions;

// Configurando o Serilog
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

Log.Information("Aplicação iniciada");

const string filePath = "config.json";
const decimal exchangeRate = 5.648m;

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

var itens = cnn.GetAll<Item>();

var dmarketTask = dmarket(cnn, exchangeRate, itens);
var steamTask = steam(cnn, exchangeRate, itens, config?.SteamCookies);

await Task.WhenAll(steamTask, dmarketTask);

Log.Information("Captura de dados finalizada");

/// <summary>
/// Método para capturar dados do site STEAM
/// </summary>
/// <param name="cnn">Sqlite Connection</param>
/// <param name="exchangeRate">Valor da cotação atual do BRL em relação ao USD</param>
/// <param name="itens">Lista que contém os dados sobre os itens</param>
/// <param name="steamCookies">Cookies para a requisição</param>
/// <returns></returns>
static async Task steam(ISqliteConnection cnn, decimal exchangeRate, IEnumerable<Item> itens, string steamCookies)
{
    // Número máximo de tentativas
    const int maxRetries = 10;

    var bulk_Data = new List<CollectData>();
    var captureId = Guid.NewGuid();

    const string baseUrl = "https://steamcommunity.com/market/search?appid=570&q=prop_def_index:";

    var cookieContainer = new CookieContainer();
    using var handler = new HttpClientHandler { CookieContainer = cookieContainer };
    using var client = new HttpClient(handler);

    foreach (var cookie in steamCookies.Split(';'))
    {
        var cookieParts = cookie.Split('=', 2);
        if (cookieParts.Length == 2)
        {
            string name = cookieParts[0].Trim();
            string value = cookieParts[1].Trim();
            cookieContainer.Add(new Cookie(name, value, "/", "steamcommunity.com"));
        }
    }

    foreach (var item in itens)
    {
        // Função para fazer a requisição com tentativas
        var attempt = 0;
        var success = false;

        while (attempt <= maxRetries && !success)
        {
            if (attempt > 0) await Task.Delay(2000);

            try
            {
                // URL para o GET
                var uri = new Uri($"{baseUrl}{item.ItemId}");

                // Requisição GET com o cookie de autenticação
                var response = await client.GetAsync(uri);
                string htmlContent = await response.Content.ReadAsStringAsync();

                // Expressão regular para encontrar os valores de `data-price`
                var matches = Regex.Matches(htmlContent, @"data-price=""(\d+)""");

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
                    Log.Information($"[{nameof(ServiceMethod.ServiceType.STEAM)}] Preço: {lowestPrice:C} | {item.Name}");
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

            if (attempt >= maxRetries)
            {
                Log.Error($"[{nameof(ServiceMethod.ServiceType.STEAM)}] Máximo de tentativas atingido para o item {item.Name}");
            }
        }
    }

    cnn.BulkInsert(bulk_Data);

    Log.Information($"[{nameof(ServiceMethod.ServiceType.STEAM)}] Inseridos: {bulk_Data.Count} itens");

    cnn.Insert(new ItemCaptured()
    {
        CaptureId = captureId,
        ServiceType = ServiceType.STEAM,
        DateTime = DateTime.Now,
        ExchangeRate = exchangeRate,
    });
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

                // Expressão regular para capturar o ID dentro da div com classe infobox-image-text
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
    HttpClient _httpClient = new();

    // URL base e parâmetros fixos
    const string apiUrl = "https://api.dmarket.com/exchange/v1/market/items?side=market&orderBy=price&orderDir=asc&title=";
    const string paramsUrl = "&priceFrom=0&priceTo=0&treeFilters=&gameId=9a92&types=dmarket&myFavorites=false&cursor=&limit=20&currency=USD&platform=browser&isLoggedIn=false";

    var bulk_Data = new List<CollectData>();
    var captureId = Guid.NewGuid();

    foreach (var item in itens)
    {
        // Encode do nome do item para URL
        string encodedItem = Uri.EscapeDataString(item.Name);
        string fullUrl = $"{apiUrl}{encodedItem}{paramsUrl}";

        try
        {
            // Enviar requisição GET
            HttpResponseMessage response = await _httpClient.GetAsync(fullUrl);

            if (response.IsSuccessStatusCode)
            {
                // Lê a resposta e deserializa o arquivo JSON para um objeto
                string responseData = await response.Content.ReadAsStringAsync();
                var result = JsonConvert.DeserializeObject<DmarketResponse>(responseData);
                if (result == null) continue;

                // Pega o primeiro "objects" sendo o resultado esperado da query do GET
                var itemResult = result.objects.FirstOrDefault();
                if (itemResult == null) continue;

                // Converte o preço em DOLAR para BRL (em decimal com duas casas decimais)
                var priceBRL = Math.Round(decimal.Parse(itemResult.price.USD) * exchangeRate / 100, 2);

                Log.Information($"[{nameof(ServiceMethod.ServiceType.DMARKET)}] Preço: R$ {priceBRL} | {item.Name}");

                bulk_Data.Add(new CollectData()
                {
                    CaptureId = captureId,
                    ItemId = item.ItemId,
                    Price = priceBRL,
                });
            }
            else
            {
                Log.Warning($"[{nameof(ServiceMethod.ServiceType.DMARKET)}] Erro ({response.StatusCode}): {item}");
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, $"[{nameof(ServiceMethod.ServiceType.DMARKET)}] Exceção ao processar '{item}': {ex.Message}");
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