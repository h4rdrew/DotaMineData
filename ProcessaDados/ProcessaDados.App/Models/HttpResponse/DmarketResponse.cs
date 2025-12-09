namespace ProcessaDados.App.Models.HttpResponse;

public record DmarketResponse
{
    public Object[] objects { get; set; }
    public Total total { get; set; }
    public string cursor { get; set; }
}

public record Total
{
    public int offers { get; set; }
    public int targets { get; set; }
    public int items { get; set; }
    public int completedOffers { get; set; }
    public int closedTargets { get; set; }
}

public record Object
{
    public string itemId { get; set; }
    public string type { get; set; }
    public int amount { get; set; }
    public string classId { get; set; }
    public string gameId { get; set; }
    public string gameType { get; set; }
    public bool inMarket { get; set; }
    public bool lockStatus { get; set; }
    public string title { get; set; }
    public string description { get; set; }
    public string image { get; set; }
    public string slug { get; set; }
    public string owner { get; set; }
    public string ownersBlockchainId { get; set; }
    public Ownerdetails ownerDetails { get; set; }
    public string status { get; set; }
    public int discount { get; set; }
    public Price price { get; set; }
    public Instantprice instantPrice { get; set; }
    public Exchangeprice exchangePrice { get; set; }
    public string instantTargetId { get; set; }
    public Suggestedprice suggestedPrice { get; set; }
    public Recommendedprice recommendedPrice { get; set; }
    public Extra extra { get; set; }
    public int createdAt { get; set; }
    public Deliverystats deliveryStats { get; set; }
    public Fees fees { get; set; }
    public Discountprice discountPrice { get; set; }
    public string productId { get; set; }
    public int favoriteFor { get; set; }
    public bool favoriteForUser { get; set; }
    public Favorite favorite { get; set; }
}

public record Ownerdetails
{
    public string id { get; set; }
    public string avatar { get; set; }
    public string wallet { get; set; }
}

public record Price
{
    public string DMC { get; set; }
    public string USD { get; set; }
}

public record Instantprice
{
    public string DMC { get; set; }
    public string USD { get; set; }
}

public record Exchangeprice
{
    public string DMC { get; set; }
    public string USD { get; set; }
}

public record Suggestedprice
{
    public string DMC { get; set; }
    public string USD { get; set; }
}

public record Recommendedprice
{
    public Offerprice offerPrice { get; set; }
    public D3 d3 { get; set; }
    public D7 d7 { get; set; }
    public D7plus d7Plus { get; set; }
}

public record Offerprice
{
    public string DMC { get; set; }
    public string USD { get; set; }
}

public record D3
{
    public string DMC { get; set; }
    public string USD { get; set; }
}

public record D7
{
    public string DMC { get; set; }
    public string USD { get; set; }
}

public record D7plus
{
    public string DMC { get; set; }
    public string USD { get; set; }
}

public record Extra
{
    public string nameColor { get; set; }
    public string backgroundColor { get; set; }
    public bool tradable { get; set; }
    public string offerId { get; set; }
    public bool isNew { get; set; }
    public string gameId { get; set; }
    public string name { get; set; }
    public string categoryPath { get; set; }
    public string viewAtSteam { get; set; }
    public string groupId { get; set; }
    public string linkId { get; set; }
    public int tradeLock { get; set; }
    public int tradeLockDuration { get; set; }
    public string hero { get; set; }
    public string rarity { get; set; }
    public string type { get; set; }
    public bool saleRestricted { get; set; }
    public string inGameAssetID { get; set; }
    public string emissionSerial { get; set; }
    public string sagaAddress { get; set; }
    public bool withdrawable { get; set; }
    public Gem[] gems { get; set; }
    public int overpriced { get; set; }
}

public record Gem
{
    public string name { get; set; }
    public string image { get; set; }
    public string type { get; set; }
}

public record Deliverystats
{
    public string rate { get; set; }
    public string time { get; set; }
}

public record Fees
{
    public F2f f2f { get; set; }
    public Dmarket dmarket { get; set; }
}

public record F2f
{
    public Sell sell { get; set; }
    public Instantsell instantSell { get; set; }
    public Exchange exchange { get; set; }
}

public record Sell
{
    public Default _default { get; set; }
}

public record Default
{
    public string percentage { get; set; }
    public Minfee minFee { get; set; }
}

public record Minfee
{
    public string DMC { get; set; }
    public string USD { get; set; }
}

public record Instantsell
{
    public Default1 _default { get; set; }
}

public record Default1
{
    public string percentage { get; set; }
    public Minfee1 minFee { get; set; }
}

public record Minfee1
{
    public string DMC { get; set; }
    public string USD { get; set; }
}

public record Exchange
{
    public Default2 _default { get; set; }
}

public record Default2
{
    public string percentage { get; set; }
    public Minfee2 minFee { get; set; }
}

public record Minfee2
{
    public string DMC { get; set; }
    public string USD { get; set; }
}

public record Dmarket
{
    public Sell1 sell { get; set; }
    public Instantsell1 instantSell { get; set; }
    public Exchange1 exchange { get; set; }
}

public record Sell1
{
    public Default3 _default { get; set; }
}

public record Default3
{
    public string percentage { get; set; }
    public Minfee3 minFee { get; set; }
}

public record Minfee3
{
    public string DMC { get; set; }
    public string USD { get; set; }
}

public record Instantsell1
{
    public Default4 _default { get; set; }
}

public record Default4
{
    public string percentage { get; set; }
    public Minfee4 minFee { get; set; }
}

public record Minfee4
{
    public string DMC { get; set; }
    public string USD { get; set; }
}

public record Exchange1
{
    public Default5 _default { get; set; }
}

public record Default5
{
    public string percentage { get; set; }
    public Minfee5 minFee { get; set; }
}

public record Minfee5
{
    public string DMC { get; set; }
    public string USD { get; set; }
}

public record Discountprice
{
    public string DMC { get; set; }
    public string USD { get; set; }
}

public record Favorite
{
    public int count { get; set; }
    public bool forUser { get; set; }
}