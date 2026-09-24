using System.Text.Json;
using ProcessaDados.App.Infrastructure;
using ProcessaDados.App.Models.Db;
using ProcessaDados.App.Services;
using Simple.Sqlite;

namespace ProcessaDados.App;

internal static class IntegrationRunner
{
    private static readonly object OutputLock = new();

    private static void Send(object message)
    {
        lock (OutputLock) Console.WriteLine("@dotamine:" + JsonSerializer.Serialize(message));
    }

    public static async Task<int> RunAsync(string[] args)
    {
        using var cancellation = new CancellationTokenSource();
        _ = Task.Run(() => ReadCommands(cancellation));
        var token = cancellation.Token;
        try
        {
            string? database = null;
            int? itemId = null;
            var integrated = false;
            for (var i = 0; i < args.Length; i++)
            {
                switch (args[i])
                {
                    case "--integrated": integrated = true; break;
                    case "--database" when i + 1 < args.Length: database = args[++i]; break;
                    case "--item-id" when i + 1 < args.Length:
                        if (!int.TryParse(args[++i], out var id) || id <= 0)
                            throw new ArgumentException("Item inválido.");
                        itemId = id;
                        break;
                    default: throw new ArgumentException($"Argumento inválido: {args[i]}");
                }
            }
            if (!integrated || string.IsNullOrWhiteSpace(database) || !File.Exists(database))
                throw new ArgumentException("Informe --integrated --database com um banco existente.");
            token.ThrowIfCancellationRequested();

            // Separate app instances must not collect into the same database simultaneously.
            using var runLock = new FileStream(database + ".collection.lock", FileMode.OpenOrCreate,
                FileAccess.ReadWrite, FileShare.None);
            using var connection = DatabaseInitializer.Open(database);
            connection.Execute("PRAGMA busy_timeout = 10000");
            var items = (itemId.HasValue
                ? connection.Query<Item>("SELECT * FROM Item WHERE ItemId = @ItemId", new { ItemId = itemId.Value })
                : connection.Query<Item>("SELECT * FROM Item ORDER BY Name")).ToList();
            if (itemId.HasValue && items.Count == 0) throw new ArgumentException("Item não encontrado no banco.");

            void Progress(string market, int completed, int total, int failed, bool saved) =>
                Send(new { type = "progress", market, completed, total, failed, saved });
            Progress("steam", 0, items.Count, 0, false);
            Progress("dmarket", 0, items.Count, 0, false);
            if (items.Count == 0)
            {
                Progress("steam", 0, 0, 0, true);
                Progress("dmarket", 0, 0, 0, true);
                Send(new { type = "result", status = "completed", message = "Nenhum item cadastrado para atualizar." });
                return 0;
            }

            using var exchangeRates = new ExchangeRateService();
            var exchangeRate = await exchangeRates.GetUsdToBrlAsync(token);
            if (exchangeRate <= 0) throw new InvalidOperationException("Não foi possível consultar a cotação do dólar.");
            var repository = new CaptureRepository(connection);
            var steam = new SteamMarketCollector(repository);
            using var dmarket = new DmarketCollector(repository);
            var steamFailed = 0;
            var dmarketFailed = 0;
            var steamTask = steam.CollectAsync(items, exchangeRate, (completed, total, failed, saved) =>
            {
                steamFailed = failed;
                Progress("steam", completed, total, failed, saved);
            }, token);
            var dmarketTask = dmarket.CollectAsync(items, exchangeRate, (completed, total, failed, saved) =>
            {
                dmarketFailed = failed;
                Progress("dmarket", completed, total, failed, saved);
            }, token);
            await Task.WhenAll(steamTask, dmarketTask);
            token.ThrowIfCancellationRequested();
            var partial = steamFailed + dmarketFailed > 0;
            Send(new { type = "result", status = partial ? "partial" : "completed",
                message = partial
                    ? $"Coleta finalizada. Sem preço atualizado: Steam {steamFailed}; DMarket {dmarketFailed}. Os demais preços foram salvos."
                    : "Preços atualizados e salvos com sucesso." });
            return partial ? 2 : 0;
        }
        catch (Exception exception) when (token.IsCancellationRequested && exception is OperationCanceledException or Microsoft.Playwright.PlaywrightException)
        {
            Send(new { type = "result", status = "cancelled", message = "Atualização cancelada. Os preços coletados até a interrupção foram salvos." });
            return 3;
        }
        catch (Exception exception)
        {
            Send(new { type = "result", status = "error", message = exception.Message });
            return 1;
        }
        finally
        {
            await cancellation.CancelAsync();
        }
    }

    private static void ReadCommands(CancellationTokenSource cancellation)
    {
        try
        {
            while (!cancellation.IsCancellationRequested && Console.ReadLine() is { } command)
                if (command.Trim().Equals("cancel", StringComparison.OrdinalIgnoreCase))
                {
                    cancellation.Cancel();
                    return;
                }
        }
        catch (ObjectDisposedException) { }
        catch (IOException) { }
    }
}
