using Simple.DatabaseWrapper.Attributes;

namespace ProcessaDados.App.Models.Db;

struct Data
{
    [PrimaryKey, AutoIncrement]
    public int Id { get; set; }
    public int ItemId { get; set; }
    public decimal Price { get; set; }
    public Guid CaptureId { get; set; }
}