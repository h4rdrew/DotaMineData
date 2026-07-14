using Newtonsoft.Json;
using ProcessaDados.App.Models;
using Serilog;

namespace ProcessaDados.App.Infrastructure;

internal static class ConfigurationLoader
{
    public static ConfigJson? Load(string path)
    {
        if (!File.Exists(path)) return null;
        try { return JsonConvert.DeserializeObject<ConfigJson>(File.ReadAllText(path)); }
        catch (Exception exception) when (exception is IOException or JsonException)
        {
            Log.Error(exception, "Erro ao ler a configuração em {Path}", path);
            return null;
        }
    }
}
