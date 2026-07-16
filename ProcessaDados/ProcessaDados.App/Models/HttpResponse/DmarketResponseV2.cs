namespace ProcessaDados.App.Models.HttpResponse;

public record DmarketResponseV2
{
    public Offer[] offers { get; set; }
    public TotalV2 total { get; set; }
}

public record TotalV2
{
    public int items { get; set; }
}

public record Offer
{
    public string offerId { get; set; }
    public string assetId { get; set; }
    public int priceCents { get; set; }
    public DateTime createdAt { get; set; }
    public bool locked { get; set; }
    public int recommendedPrice { get; set; }
    public bool overpriced { get; set; }
    public int overpricePercent { get; set; }
    public int discount { get; set; }
    public bool cheapestBySteamAnalyst { get; set; }
    public string title { get; set; }
    public string name { get; set; }
    public string image { get; set; }
    public string slug { get; set; }
    public string categoryPath { get; set; }
    public string gameId { get; set; }
    public string backgroundColor { get; set; }
    public string owner { get; set; }
    public bool tradable { get; set; }
    public bool withdrawable { get; set; }
    public bool tradeProtectionRemoved { get; set; }
    public DateTime unlockDate { get; set; }
    public Dota2 dota2 { get; set; }
    public bool isNew { get; set; }
    public FavoriteV2 favorite { get; set; }
}

public record Dota2
{
    public string quality { get; set; }
    public string hero { get; set; }
    public string rarity { get; set; }
    public Gems[] gems { get; set; }
}

public record Gems
{
    public string name { get; set; }
    public string image { get; set; }
    public string type { get; set; }
}

public record FavoriteV2
{
}