using Simple.DatabaseWrapper.Attributes;

namespace ProcessaDados.App.Models.Db;

struct Heroes
{
    [PrimaryKey, AutoIncrement]
    public int Id { get; set; }
    public int HeroId { get; set; }
    public string Name { get; set; }
    public string? PersonaName { get; set; }
}
