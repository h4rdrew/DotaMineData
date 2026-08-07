using ProcessaDados.App.Infrastructure;
using ProcessaDados.App.Services;
using Serilog;
using Simple.Sqlite;

namespace ProcessaDados.App;

internal sealed class DataProcessingApplication
{
    private const string ConfigFile = "config.json";

    public async Task RunAsync()
    {
        var config = ConfigurationLoader.Load(ConfigFile);
        if (config is null)
        {
            Log.Error("Não foi possível ler {File}. Encerrando aplicação.", ConfigFile);
            return;
        }

        using var connection = DatabaseInitializer.Open(config.Value.DbPath);
        var items = connection.Query<Models.Db.Item>("SELECT * FROM Item ORDER BY Name").ToList();
        using var exchangeRates = new ExchangeRateService();
        var exchangeRate = await exchangeRates.GetUsdToBrlAsync();

        if (exchangeRate <= 0)
        {
            Log.Error("Erro ao capturar a cotação do dólar. Encerrando aplicação.");
            return;
        }

        Log.Information("Cotação do dólar: {ExchangeRate}", exchangeRate);
        var repository = new CaptureRepository(connection);
        var steam = new SteamMarketCollector(repository);
        using var dmarket = new DmarketCollector(repository);
        var steamTask = steam.CollectAsync(items, exchangeRate);
        var dmarketTask = dmarket.CollectAsync(items, exchangeRate);
        await Task.WhenAll(steamTask, dmarketTask);

        await RetryPendingItemsAsync(steam, await steamTask, exchangeRate);
        Log.Information("Captura de dados finalizada");
        WindowsToast.Notify("Processa dados finalizado com sucesso!");
        Console.WriteLine("Pressione ENTER para sair...");
        Console.ReadLine();
    }

    private static async Task RetryPendingItemsAsync(SteamMarketCollector collector, List<Models.Db.Item> pending, decimal exchangeRate)
    {
        while (pending.Count > 0)
        {
            WindowsToast.Notify("Processa dados pendente...");
            Console.WriteLine($"[STEAM] Existem {pending.Count} itens pendentes. Tentar novamente? (Y/N)");
            switch (Console.ReadLine()?.Trim().ToUpperInvariant())
            {
                case "N": return;
                case "Y": pending = await collector.CollectAsync(pending, exchangeRate); break;
                default: Console.WriteLine("Entrada inválida, tente novamente..."); break;
            }
        }
    }
}
