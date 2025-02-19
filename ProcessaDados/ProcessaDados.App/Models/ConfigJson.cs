namespace ProcessaDados.App.Models;

struct ConfigJson
{
    public List<string> Items { get; set; }
    public string DbPath { get; set; }
    public List<int> ItemIds { get; set; }
    public string SteamCookies { get; set; }
}