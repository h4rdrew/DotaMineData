using Microsoft.Playwright;
using Newtonsoft.Json;
using ProcessaDados.App.Infrastructure;
using ProcessaDados.App.Models.Db;
using ProcessaDados.App.Models.HttpResponse;
using Serilog;
using System.Collections.Concurrent;
using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;
using DmarketItem = ProcessaDados.App.Models.HttpResponse.Offer;

namespace ProcessaDados.App.Services;

internal sealed class ExchangeRateService : IDisposable
{
    private readonly HttpClient _client = CreateClient();

    public async Task<decimal> GetUsdToBrlAsync()
    {
        try
        {
            using var response = await _client.GetAsync("https://api.dmarket.com/currency-rate/v1/rates");
            if (!response.IsSuccessStatusCode) return 0;
            return JsonConvert.DeserializeObject<DmarketExchangeRateResponse>(await response.Content.ReadAsStringAsync())?.Rates.BRL ?? 0;
        }
        catch (Exception exception) { Log.Error(exception, "Erro ao consultar a cotação do dólar"); return 0; }
    }

    internal static HttpClient CreateClient() => new(new HttpClientHandler
    {
        AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli
    });
    public void Dispose() => _client.Dispose();
}

internal sealed class DmarketCollector(CaptureRepository repository) : IDisposable
{
    private const string BaseUrl = "https://api.dmarket.com/exchange/v1/market/items/v2?orderBy=price&orderDir=asc&title=";
    private const string Query = "&priceFrom=0&priceTo=0&treeFilters=rarity%5B%5D=arcana,rarity%5B%5D=immortal&gameId=9a92&myFavorites=false&currency=USD&platform=browser&isLoggedIn=true&pageSize=100";
    private static readonly TimeSpan RequestInterval = TimeSpan.FromMilliseconds(500);
    private static readonly string[] Qualities = ["Normal", "Genuine", "Elder", "Unusual", "Self-Made", "Inscribed", "Cursed", "Heroic", "Favored", "Ascendant", "Autographed", "Legacy", "Exalted", "Frozen", "Corrupted", "Auspicious", "Infused"];
    private readonly HttpClient _client = ExchangeRateService.CreateClient();

    public async Task CollectAsync(IEnumerable<Item> items, decimal exchangeRate)
    {
        var captureId = Guid.NewGuid();
        var captured = new List<CollectData>();
        var isFirstRequest = true;
        foreach (var item in items)
        {
            try
            {
                if (!isFirstRequest) await Task.Delay(RequestInterval);
                isFirstRequest = false;

                var requestUri = BaseUrl + Uri.EscapeDataString(item.Name.Trim()) + Query;
                using var response = await _client.GetAsync(requestUri);
                if (!response.IsSuccessStatusCode)
                {
                    Log.Warning("[DMARKET] Erro ({StatusCode}): {Item}", response.StatusCode, item.Name);
                    continue;
                }

                var result = JsonConvert.DeserializeObject<DmarketResponseV2>(await response.Content.ReadAsStringAsync());
                var match = result is null ? null : FindExactItem(item.Name, result.offers);

                if (match is null)
                {
                    Log.Warning("[DMARKET] Item não encontrado: [{ItemId}] {Item}", item.ItemId, item.Name);
                    continue;
                }

                var price = Math.Round(match.priceCents * exchangeRate / 100, 2);
                captured.Add(new CollectData
                {
                    CaptureId = captureId,
                    ItemId = item.ItemId,
                    Price = price
                });

                Log.Information("[DMARKET] R$ {Price} | {Item}", price, item.Name);
            }
            catch (Exception exception)
            {
                Log.Error(exception, "[DMARKET] Erro ao processar {Item}", item.Name);
            }
        }
        repository.Save(ServiceType.DMARKET, captureId, exchangeRate, captured);
    }

    private static DmarketItem? FindExactItem(string name, IEnumerable<DmarketItem> results)
    {
        var normalized = name.Trim();
        return results.FirstOrDefault(result => string.Equals(result.title?.Trim(), normalized, StringComparison.OrdinalIgnoreCase) ||
            Qualities.Any(quality => string.Equals(result.title?.Trim(), $"{quality} {normalized}", StringComparison.OrdinalIgnoreCase)));
    }
    public void Dispose() => _client.Dispose();
}

internal sealed class SteamMarketCollector(CaptureRepository repository)
{
    private const int MaxRetries = 3;
    private static readonly Regex PricePattern = new(@"R\$\s?([\d.,]+)", RegexOptions.Compiled);
    private static readonly IReadOnlyDictionary<ItemRarity, string> Rarities = new Dictionary<ItemRarity, string>
    {
        [ItemRarity.Ancient] = "Rarity_Ancient",
        [ItemRarity.Arcana] = "Rarity_Arcana",
        [ItemRarity.Common] = "Rarity_Common",
        [ItemRarity.Uncommon] = "Rarity_Uncommon",
        [ItemRarity.Immortal] = "Rarity_Immortal",
        [ItemRarity.Legendary] = "Rarity_Legendary",
        [ItemRarity.Mythical] = "Rarity_Mythical",
        [ItemRarity.Rare] = "Rarity_Rare"
    };
    private static readonly IReadOnlyDictionary<Hero, string> HeroAliases = new Dictionary<Hero, string>
    {
        [Hero.AntimagePersona1] = "antimage_persona1",
        [Hero.CrystalMaidenPersona1] = "crystal_maiden_persona1",
        [Hero.PudgePersona1] = "pudge_persona1",
        [Hero.InvokerPersona1] = "invoker_persona1",
        [Hero.CentaurWarrunner] = "centaur",
        [Hero.Doom] = "doom_bringer",
        [Hero.NaturesProphet] = "furion",
        [Hero.KeeperOfTheLight] = "keeper_of_the_light",
        [Hero.Magnus] = "magnataur",
        [Hero.Necrophos] = "necrolyte",
        [Hero.ShadowFiend] = "nevermore",
        [Hero.OutworldDestroyer] = "obsidian_destroyer",
        [Hero.Clockwerk] = "rattletrap",
        [Hero.Timbersaw] = "shredder",
        [Hero.WraithKing] = "skeleton_king",
        [Hero.Underlord] = "abyssal_underlord",
        [Hero.Vengefulspirit] = "vengefulspirit",
        [Hero.Windranger] = "windrunner",
        [Hero.Io] = "wisp",
        [Hero.Zeus] = "zuus",
        [Hero.TreantProtector] = "treant",
    };

    public async Task<List<Item>> CollectAsync(IEnumerable<Item> items, decimal exchangeRate, int maxConcurrency = 2)
    {
        var captureId = Guid.NewGuid();
        var captured = new ConcurrentBag<CollectData>();
        var pending = new ConcurrentBag<Item>();
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Chromium.LaunchAsync(new() { Headless = true });
        await using var context = await browser.NewContextAsync(new()
        {
            StorageStatePath = File.Exists("steam-session.json") ? "steam-session.json" : null,
            Locale = "pt-BR",
            TimezoneId = "America/Sao_Paulo",
            UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36"
        });
        using var semaphore = new SemaphoreSlim(maxConcurrency);
        await Task.WhenAll(items.Select(async item =>
        {
            await semaphore.WaitAsync();
            try { if (!await TryCollectItemAsync(context, item, captureId, captured)) pending.Add(item); }
            finally { semaphore.Release(); }
        }));
        repository.Save(ServiceType.STEAM, captureId, exchangeRate, captured.ToList());
        return pending.ToList();
    }

    private static async Task<bool> TryCollectItemAsync(IBrowserContext context, Item item, Guid captureId, ConcurrentBag<CollectData> captured)
    {
        var page = await context.NewPageAsync();
        try
        {
            for (var attempt = 1; attempt <= MaxRetries; attempt++)
            {
                try
                {
                    if (attempt > 1) await Task.Delay(2000);
                    await page.GotoAsync(BuildUrl(item), new() { WaitUntil = WaitUntilState.DOMContentLoaded, Timeout = 60000 });
                    var texts = await page.Locator("a[href*='/market/listings/570/']").AllInnerTextsAsync();
                    var price = texts.Where(text => text.Contains(item.Name, StringComparison.OrdinalIgnoreCase)).Select(ParsePrice).Where(value => value > 0).DefaultIfEmpty().Min();
                    if (price <= 0) continue;
                    captured.Add(new CollectData { CaptureId = captureId, ItemId = item.ItemId, Price = price });
                    Log.Information("[STEAM] R$ {Price:F2} | {Item}", price, item.Name);
                    return true;
                }
                catch (TimeoutException exception) when (attempt < MaxRetries)
                { Log.Warning(exception, "[STEAM] Timeout na tentativa {Attempt}/{MaxRetries} para {Item}", attempt, MaxRetries, item.Name); }
                catch (Exception exception)
                { Log.Error(exception, "[STEAM] Erro na tentativa {Attempt}/{MaxRetries} para {Item}", attempt, MaxRetries, item.Name); }
            }
        }
        finally { await page.CloseAsync(); }
        Log.Warning("[STEAM] Não capturado: {Item}", item.Name);
        return false;
    }

    private static string BuildUrl(Item item)
    {
        var heroName = HeroAliases.TryGetValue(item.Hero, out var alias)
            ? alias
            : Regex.Replace(item.Hero.ToString(), "([a-z0-9])([A-Z])", "$1_$2").ToLowerInvariant();
        var hero = item.Hero == Hero.None ? "" : $"&category_Hero=npc_dota_hero_{heroName}";
        var rarity = Rarities.TryGetValue(item.Rarity, out var value) ? $"&category_Rarity={value}" : "";
        return $"https://steamcommunity.com/market/search?{hero}{rarity}&appid=570&q={Uri.EscapeDataString(item.Name.Trim())}&l=english";
    }

    private static decimal ParsePrice(string text)
    {
        var match = PricePattern.Match(text);
        if (!match.Success) return 0;
        var value = match.Groups[1].Value;
        if (value.Contains(',') && value.Contains('.')) value = value.LastIndexOf(',') > value.LastIndexOf('.') ? value.Replace(".", "").Replace(',', '.') : value.Replace(",", "");
        else if (value.Contains(',')) value = value.Replace(',', '.');
        return decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var price) ? price : 0;
    }
}
