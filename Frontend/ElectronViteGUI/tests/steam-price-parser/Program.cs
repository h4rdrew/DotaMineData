using ProcessaDados.App.Services;

var cases = new (string Text, decimal Rate, decimal Expected)[]
{
    ("Immortal Hammer\nAdoring Wingfall\nQuantity for sale: 845\nFrom $0.54", 5m, 2.70m),
    ("From US$ 0.54", 5m, 2.70m),
    ("R$ 2,70", 5m, 2.70m),
    ("R$\u00a01.234,56", 5m, 1234.56m),
    ("R$ 1,234.56", 5m, 1234.56m),
    ("$1,234.56", 5m, 6172.80m),
    ("R$ 1.234", 5m, 1234m),
    ("$0.55", 5.1m, 2.81m),
    ("$0.54", 0m, 0m),
    ("R$ 2,70", 0m, 2.70m),
    ("CDN$ 1.20", 5m, 0m),
    ("S$ 1.20", 5m, 0m),
    ("€ 1,20", 5m, 0m),
    ("Quantity for sale: 845", 5m, 0m),
    ("From $0.00", 5m, 0m)
};
foreach (var test in cases)
{
    var actual = SteamPriceParser.ParseBrl(test.Text, test.Rate);
    if (actual != test.Expected)
        throw new Exception($"{test.Text}: expected {test.Expected}, got {actual}");
}
Console.WriteLine($"Steam price parser: {cases.Length} cases passed.");
