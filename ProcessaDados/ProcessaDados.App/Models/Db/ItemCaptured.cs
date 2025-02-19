using Simple.DatabaseWrapper.Attributes;

namespace ProcessaDados.App.Models.Db;

struct ItemCaptured
{
    [PrimaryKey, AutoIncrement]
    public int Id { get; set; }
    public Guid CaptureId { get; set; }
    public ServiceType ServiceType { get; set; }
    public DateTime DateTime { get; set; }
    public decimal ExchangeRate { get; set; }
}
