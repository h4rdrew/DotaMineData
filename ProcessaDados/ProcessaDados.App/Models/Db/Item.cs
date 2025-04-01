using Simple.DatabaseWrapper.Attributes;

namespace ProcessaDados.App.Models.Db;

struct Item
{
    [PrimaryKey, AutoIncrement]
    public int Id { get; set; }
    public int ItemId { get; set; }
    public string Name { get; set; }
    public bool Purchased { get; set; }
}