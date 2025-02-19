using Simple.DatabaseWrapper.Attributes;

namespace ProcessaDados.App.Models.Db;

struct ServiceMethod
{
    [PrimaryKey, AutoIncrement]
    public ServiceType ServiceType { get; set; }
}

enum ServiceType
{
    UNKNOW = 0,
    STEAM = 1,
    DMARKET = 2,
}