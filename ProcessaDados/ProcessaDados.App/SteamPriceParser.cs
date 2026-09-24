using System.Globalization;
using System.Text.RegularExpressions;

namespace ProcessaDados.App.Services;

internal static class SteamPriceParser
{
    private static readonly Regex PricePattern = new(
        @"(?<![\p{L}\p{Sc}])(?<currency>R\$|US\$|\$)\s*(?<amount>\d[\d.,]*)",
        RegexOptions.Compiled);

    // Steam's anonymous search returns USD even with a Brazilian browser locale.
    // Keep BRL prices unchanged; convert USD with the rate recorded for this capture.
    public static decimal ParseBrl(string text, decimal usdToBrl)
    {
        var match = PricePattern.Match(text);
        if (!match.Success) return 0;
        var value = match.Groups["amount"].Value;
        var separator = Math.Max(value.LastIndexOf(','), value.LastIndexOf('.'));
        if (separator >= 0)
        {
            var fractionLength = value.Length - separator - 1;
            value = fractionLength is 1 or 2
                ? value[..separator].Replace(".", "").Replace(",", "") + "." + value[(separator + 1)..]
                : value.Replace(".", "").Replace(",", "");
        }
        if (!decimal.TryParse(value, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var price) || price <= 0)
            return 0;
        if (match.Groups["currency"].Value == "R$") return price;
        return usdToBrl > 0 ? Math.Round(price * usdToBrl, 2, MidpointRounding.AwayFromZero) : 0;
    }
}
