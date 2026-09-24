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

    public async Task<decimal> GetUsdToBrlAsync(CancellationToken token = default)
    {
        try
        {
            using var response = await _client.GetAsync("https://api.dmarket.com/currency-rate/v1/rates", token);
            if (!response.IsSuccessStatusCode) return 0;
            return JsonConvert.DeserializeObject<DmarketExchangeRateResponse>(await response.Content.ReadAsStringAsync(token))?.Rates.BRL ?? 0;
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested) { throw; }
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
    private const int MaxAttempts = 4;
    private const string BaseUrl = "https://api.dmarket.com/exchange/v1/market/items/v2?orderBy=price&orderDir=asc&title=";
    private const string Query = "&priceFrom=0&priceTo=0&treeFilters=rarity%5B%5D=arcana,rarity%5B%5D=immortal&gameId=9a92&myFavorites=false&currency=USD&platform=browser&isLoggedIn=true&pageSize=100";
    private static readonly string[] Qualities = ["Normal", "Genuine", "Elder", "Unusual", "Self-Made", "Inscribed", "Cursed", "Heroic", "Favored", "Ascendant", "Autographed", "Legacy", "Exalted", "Frozen", "Corrupted", "Auspicious", "Infused"];
    private readonly HttpClient _client = ExchangeRateService.CreateClient();
    private readonly RequestPacer _requestPacer = new(TimeSpan.FromMilliseconds(1200), TimeSpan.FromMilliseconds(2400));

    public async Task CollectAsync(IEnumerable<Item> items, decimal exchangeRate, Action<int, int, int, bool>? progress = null, CancellationToken token = default)
    {
        var itemList = items.ToList();
        var completed = 0;
        var captureId = Guid.NewGuid();
        var captured = new List<CollectData>();
        try
        {
        foreach (var item in itemList)
        {
            token.ThrowIfCancellationRequested();
            var interrupted = false;
            try
            {
                var requestUri = BaseUrl + Uri.EscapeDataString(item.Name.Trim()) + Query;
                using var response = await GetWithRetryAsync(requestUri, item.Name, token);
                if (response is null) continue;
                if (!response.IsSuccessStatusCode)
                {
                    Log.Warning("[DMARKET] Erro ({StatusCode}): {Item}", response.StatusCode, item.Name);
                    continue;
                }

                var result = JsonConvert.DeserializeObject<DmarketResponseV2>(await response.Content.ReadAsStringAsync(token));
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
            catch (OperationCanceledException) when (token.IsCancellationRequested)
            {
                interrupted = true;
                throw;
            }
            catch (Exception exception)
            {
                Log.Error(exception, "[DMARKET] Erro ao processar {Item}", item.Name);
            }
            finally
            {
                if (!interrupted)
                {
                    completed++;
                    progress?.Invoke(completed, itemList.Count, completed - captured.Count, false);
                }
            }
        }
        }
        finally
        {
            repository.Save(ServiceType.DMARKET, captureId, exchangeRate, captured);
            progress?.Invoke(completed, itemList.Count, completed - captured.Count, true);
        }
    }

    private async Task<HttpResponseMessage?> GetWithRetryAsync(string requestUri, string itemName, CancellationToken token)
    {
        for (var attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            await _requestPacer.WaitAsync(token);
            HttpResponseMessage response;
            try
            {
                response = await _client.GetAsync(requestUri, token);
            }
            catch (Exception exception) when (!token.IsCancellationRequested && attempt < MaxAttempts && exception is HttpRequestException or TaskCanceledException)
            {
                var networkDelay = TimeSpan.FromSeconds(Math.Pow(2, attempt + 1) + Random.Shared.NextDouble() * 3);
                _requestPacer.Penalize(networkDelay);
                Log.Warning(exception,
                    "[DMARKET] Falha de rede para {Item}. Nova tentativa {NextAttempt}/{MaxAttempts} em {Delay:F1}s",
                    itemName, attempt + 1, MaxAttempts, networkDelay.TotalSeconds);
                continue;
            }

            if (!ShouldRetry(response.StatusCode) || attempt == MaxAttempts) return response;

            var delay = GetRetryDelay(response, attempt);
            _requestPacer.Penalize(delay);
            Log.Warning(
                "[DMARKET] Limite/indisponibilidade ({StatusCode}) para {Item}. Nova tentativa {NextAttempt}/{MaxAttempts} em {Delay:F1}s",
                response.StatusCode, itemName, attempt + 1, MaxAttempts, delay.TotalSeconds);
            response.Dispose();
        }

        return null;
    }

    private static bool ShouldRetry(HttpStatusCode statusCode) =>
        statusCode == HttpStatusCode.TooManyRequests ||
        statusCode == HttpStatusCode.RequestTimeout ||
        statusCode == HttpStatusCode.BadGateway ||
        statusCode == HttpStatusCode.ServiceUnavailable ||
        statusCode == HttpStatusCode.GatewayTimeout;

    private static TimeSpan GetRetryDelay(HttpResponseMessage response, int attempt)
    {
        var retryAfter = response.Headers.RetryAfter?.Delta;
        if (response.Headers.RetryAfter?.Date is { } retryDate)
            retryAfter = retryDate - DateTimeOffset.UtcNow;

        var backoff = TimeSpan.FromSeconds(Math.Pow(2, attempt + 1) + Random.Shared.NextDouble() * 3);
        return retryAfter > backoff ? retryAfter.Value : backoff;
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
    private static readonly TimeSpan SteamThrottleCooldown = TimeSpan.FromSeconds(45);
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
    private readonly RequestPacer _requestPacer = new(TimeSpan.FromMilliseconds(3000), TimeSpan.FromMilliseconds(6000));

    public async Task<List<Item>> CollectAsync(IEnumerable<Item> items, decimal exchangeRate, Action<int, int, int, bool>? progress = null, CancellationToken token = default)
    {
        var itemList = items.ToList();
        var completed = 0;
        var captureId = Guid.NewGuid();
        var captured = new ConcurrentBag<CollectData>();
        var pending = new ConcurrentBag<Item>();
        token.ThrowIfCancellationRequested();
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Chromium.LaunchAsync(new() { Headless = true });
        using var registration = token.Register(() => { _ = CloseCancelledBrowserAsync(browser); });
        token.ThrowIfCancellationRequested();
        await using var context = await browser.NewContextAsync(new()
        {
            StorageStatePath = File.Exists("steam-session.json") ? "steam-session.json" : null,
            Locale = "pt-BR",
            TimezoneId = "America/Sao_Paulo"
        });
        try
        {
            foreach (var item in itemList)
            {
                token.ThrowIfCancellationRequested();
                try
                {
                    if (!await TryCollectItemAsync(context, item, captureId, captured, exchangeRate, token)) pending.Add(item);
                }
                catch (Exception) when (token.IsCancellationRequested) { throw new OperationCanceledException(token); }
                catch (Exception exception)
                {
                    pending.Add(item);
                    Log.Error(exception, "[STEAM] Erro ao processar {Item}", item.Name);
                }
                completed++;
                progress?.Invoke(completed, itemList.Count, pending.Count, false);
            }
        }
        finally
        {
            completed = captured.Count + pending.Count;
            repository.Save(ServiceType.STEAM, captureId, exchangeRate, captured.ToList());
            progress?.Invoke(completed, itemList.Count, pending.Count, true);
        }
        return pending.ToList();
    }

    private async Task<bool> TryCollectItemAsync(IBrowserContext context, Item item, Guid captureId, ConcurrentBag<CollectData> captured, decimal exchangeRate, CancellationToken token)
    {
        var page = await context.NewPageAsync();
        try
        {
            for (var attempt = 1; attempt <= MaxRetries; attempt++)
            {
                try
                {
                    await _requestPacer.WaitAsync(token);
                    var response = await page.GotoAsync(BuildUrl(item), new() { WaitUntil = WaitUntilState.DOMContentLoaded, Timeout = 60000 });
                    if (response is not null && response.Status is 404 or 403 or 429)
                    {
                        var retryAfter = await GetRetryAfterAsync(response);
                        var cooldown = retryAfter > SteamThrottleCooldown ? retryAfter : SteamThrottleCooldown;
                        _requestPacer.Penalize(cooldown);
                        Log.Warning(
                            "[STEAM] Resposta {StatusCode} para {Item}; aguardando pelo menos {Delay:F0}s antes de continuar",
                            response.Status, item.Name, cooldown.TotalSeconds);
                        continue;
                    }

                    var listings = page.Locator("a[href*='/market/listings/570/']");
                    await listings.First.WaitForAsync(new() { State = WaitForSelectorState.Attached, Timeout = 15000 });
                    var texts = await listings.AllInnerTextsAsync();
                    var price = texts.Where(text => text.Contains(item.Name, StringComparison.OrdinalIgnoreCase))
                        .Select(text => SteamPriceParser.ParseBrl(text, exchangeRate)).Where(value => value > 0).DefaultIfEmpty().Min();
                    if (price <= 0)
                    {
                        if (attempt < MaxRetries)
                        {
                            var delay = GetSteamRetryDelay(attempt);
                            _requestPacer.Penalize(delay);
                            Log.Warning(
                                "[STEAM] Resultado vazio para {Item}. Nova tentativa {NextAttempt}/{MaxRetries} em pelo menos {Delay:F1}s",
                                item.Name, attempt + 1, MaxRetries, delay.TotalSeconds);
                        }
                        continue;
                    }
                    captured.Add(new CollectData { CaptureId = captureId, ItemId = item.ItemId, Price = price });
                    Log.Information("[STEAM] R$ {Price:F2} | {Item}", price, item.Name);
                    return true;
                }
                catch (Exception) when (token.IsCancellationRequested) { throw new OperationCanceledException(token); }
                catch (TimeoutException exception) when (attempt < MaxRetries)
                {
                    var delay = GetSteamRetryDelay(attempt);
                    _requestPacer.Penalize(delay);
                    Log.Warning(exception, "[STEAM] Timeout na tentativa {Attempt}/{MaxRetries} para {Item}; aguardando pelo menos {Delay:F1}s", attempt, MaxRetries, item.Name, delay.TotalSeconds);
                }
                catch (Exception exception)
                {
                    if (attempt < MaxRetries) _requestPacer.Penalize(GetSteamRetryDelay(attempt));
                    Log.Error(exception, "[STEAM] Erro na tentativa {Attempt}/{MaxRetries} para {Item}", attempt, MaxRetries, item.Name);
                }
            }
        }
        finally { if (!page.IsClosed) await page.CloseAsync(); }
        Log.Warning("[STEAM] Não capturado: {Item}", item.Name);
        return false;
    }

    private static async Task CloseCancelledBrowserAsync(IBrowser browser)
    {
        try { await browser.CloseAsync(); } catch (PlaywrightException) { }
    }

    private static TimeSpan GetSteamRetryDelay(int attempt) =>
        TimeSpan.FromSeconds(Math.Pow(2, attempt + 2) + Random.Shared.NextDouble() * 4);

    private static async Task<TimeSpan> GetRetryAfterAsync(IResponse response)
    {
        var value = await response.HeaderValueAsync("retry-after");
        if (int.TryParse(value, out var seconds)) return TimeSpan.FromSeconds(Math.Max(0, seconds));
        return DateTimeOffset.TryParse(value, out var date)
            ? date - DateTimeOffset.UtcNow
            : TimeSpan.Zero;
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

}

internal sealed class RequestPacer(TimeSpan minimumInterval, TimeSpan maximumInterval)
{
    private readonly object _sync = new();
    private DateTimeOffset _nextRequestAt = DateTimeOffset.MinValue;

    public async Task WaitAsync(CancellationToken token = default)
    {
        token.ThrowIfCancellationRequested();
        TimeSpan delay;
        lock (_sync)
        {
            var now = DateTimeOffset.UtcNow;
            var scheduledAt = _nextRequestAt > now ? _nextRequestAt : now;
            delay = scheduledAt - now;
            _nextRequestAt = scheduledAt + RandomInterval();
        }

        if (delay > TimeSpan.Zero) await Task.Delay(delay, token);
    }

    public void Penalize(TimeSpan delay)
    {
        if (delay <= TimeSpan.Zero) return;
        lock (_sync)
        {
            var penalizedUntil = DateTimeOffset.UtcNow + delay;
            if (penalizedUntil > _nextRequestAt) _nextRequestAt = penalizedUntil;
        }
    }

    private TimeSpan RandomInterval()
    {
        var range = maximumInterval.TotalMilliseconds - minimumInterval.TotalMilliseconds;
        return minimumInterval + TimeSpan.FromMilliseconds(Random.Shared.NextDouble() * range);
    }
}
