using ProcessaDados.App.Models.Db;
using Simple.Sqlite;

namespace ProcessaDados.App.Infrastructure;

internal sealed class CaptureRepository(ISqliteConnection connection)
{
    private readonly object _sync = new();

    public void Save(ServiceType service, Guid captureId, decimal exchangeRate, IReadOnlyCollection<CollectData> data)
    {
        lock (_sync)
        {
            if (data.Count > 0) connection.BulkInsert(data.ToList());
            connection.Insert(new ItemCaptured { CaptureId = captureId, ServiceType = service, DateTime = DateTime.Now, ExchangeRate = exchangeRate });
        }
        Serilog.Log.Information("[{Service}] Inseridos: {Count} itens", service, data.Count);
    }
}
