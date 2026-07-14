using ProcessaDados.App.Models.Db;
using Simple.Sqlite;

namespace ProcessaDados.App.Infrastructure;

internal static class DatabaseInitializer
{
    public static ISqliteConnection Open(string databasePath)
    {
        if (string.IsNullOrWhiteSpace(databasePath)) throw new InvalidOperationException("O caminho do banco não foi configurado.");
        var connection = ConnectionFactory.CreateConnection(databasePath);
        connection.CreateTables().Add<ItemCaptured>().Add<CollectData>().Add<Item>().Add<ServiceMethod>().Add<Heroes>().Commit();
        connection.Insert(new ServiceMethod { ServiceType = ServiceType.STEAM }, OnConflict.Ignore);
        connection.Insert(new ServiceMethod { ServiceType = ServiceType.DMARKET }, OnConflict.Ignore);
        return connection;
    }
}
