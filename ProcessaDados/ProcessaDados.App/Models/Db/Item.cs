using Simple.DatabaseWrapper.Attributes;
using System.ComponentModel;

namespace ProcessaDados.App.Models.Db;

struct Item
{
    [PrimaryKey, AutoIncrement]
    public int Id { get; set; }
    public int ItemId { get; set; }
    public string Name { get; set; }
    public bool Purchased { get; set; }
    public ItemRarity Rarity { get; set; }
    public Hero Hero { get; set; }
    public ItemSlot ItemSlot { get; set; }
}

public enum ItemSlot
{
    Ability1 = 0,
    Ability2 = 1,
    Ability3 = 2,
    Ability4 = 3,
    ActionItem = 4,
    Announcer = 5,
    Armor = 6,
    Arms = 7,
    Back = 8,
    Belt = 9,
    BodyHead = 10,
    Courier = 11,
    CursorPack = 12,
    Emblem = 13,
    Gloves = 14,
    Head = 15,
    HeroicEffigy = 16,
    HudSkin = 17,
    Legs = 18,
    LoadingScreen = 19,
    MegaKillAnnouncer = 20,
    Misc = 21,
    Mount = 22,
    MultikillBanner = 23,
    Music = 24,
    NotApplicable = 25, // Convertido de "N/A"
    Neck = 26,
    OffHand = 27,
    Shapeshift = 28,
    Shoulder = 29,
    SummonedUnit = 30,
    Tail = 31,
    Taunt = 32,
    Terrain = 33,
    Ultimate = 34,
    Voice = 35,
    Ward = 36,
    Weapon = 37
}

public enum ItemRarity
{
    Common = 1,
    Uncommon = 2,
    Rare = 3,
    Mythical = 4,
    Legendary = 5,
    Ancient = 6,
    Immortal = 7,
    Arcana = 8
}

public enum Hero
{
    None = 0,
    [Description("Anti-Mage")]
    Antimage = 1,
    [Description("Axe")]
    Axe = 2,
    [Description("Bane")]
    Bane = 3,
    [Description("Bloodseeker")]
    Bloodseeker = 4,
    [Description("Crystal Maiden")]
    CrystalMaiden = 5,
    [Description("Drow Ranger")]
    DrowRanger = 6,
    [Description("Earthshaker")]
    Earthshaker = 7,
    [Description("Juggernaut")]
    Juggernaut = 8,
    [Description("Mirana")]
    Mirana = 9,
    [Description("Morphling")]
    Morphling = 10,
    [Description("Shadow Fiend")]
    ShadowFiend = 11,
    [Description("Phantom Lancer")]
    PhantomLancer = 12,
    [Description("Puck")]
    Puck = 13,
    [Description("Pudge")]
    Pudge = 14,
    [Description("Razor")]
    Razor = 15,
    [Description("Sand King")]
    SandKing = 16,
    [Description("Storm Spirit")]
    StormSpirit = 17,
    [Description("Sven")]
    Sven = 18,
    [Description("Tiny")]
    Tiny = 19,
    [Description("Vengeful Spirit")]
    Vengefulspirit = 20,
    [Description("Windranger")]
    Windranger = 21,
    [Description("Zeus")]
    Zeus = 22,
    [Description("Kunkka")]
    Kunkka = 23,
    [Description("Lina")]
    Lina = 25,
    [Description("Lion")]
    Lion = 26,
    [Description("Shadow Shaman")]
    ShadowShaman = 27,
    [Description("Slardar")]
    Slardar = 28,
    [Description("Tidehunter")]
    Tidehunter = 29,
    [Description("Witch Doctor")]
    WitchDoctor = 30,
    [Description("Lich")]
    Lich = 31,
    [Description("Riki")]
    Riki = 32,
    [Description("Enigma")]
    Enigma = 33,
    [Description("Tinker")]
    Tinker = 34,
    [Description("Sniper")]
    Sniper = 35,
    [Description("Necrophos")]
    Necrophos = 36,
    [Description("Warlock")]
    Warlock = 37,
    [Description("Beastmaster")]
    Beastmaster = 38,
    [Description("Queen of Pain")]
    Queenofpain = 39,
    [Description("Venomancer")]
    Venomancer = 40,
    [Description("Faceless Void")]
    FacelessVoid = 41,
    [Description("Wraith King")]
    WraithKing = 42,
    [Description("Death Prophet")]
    DeathProphet = 43,
    [Description("Phantom Assassin")]
    PhantomAssassin = 44,
    [Description("Pugna")]
    Pugna = 45,
    [Description("Templar Assassin")]
    TemplarAssassin = 46,
    [Description("Viper")]
    Viper = 47,
    [Description("Luna")]
    Luna = 48,
    [Description("Dragon Knight")]
    DragonKnight = 49,
    [Description("Dazzle")]
    Dazzle = 50,
    [Description("Clockwerk")]
    Clockwerk = 51,
    [Description("Leshrac")]
    Leshrac = 52,
    [Description("Nature's Prophet")]
    NaturesProphet = 53,
    [Description("Lifestealer")]
    LifeStealer = 54,
    [Description("Dark Seer")]
    DarkSeer = 55,
    [Description("Clinkz")]
    Clinkz = 56,
    [Description("Omniknight")]
    Omniknight = 57,
    [Description("Enchantress")]
    Enchantress = 58,
    [Description("Huskar")]
    Huskar = 59,
    [Description("Night Stalker")]
    NightStalker = 60,
    [Description("Broodmother")]
    Broodmother = 61,
    [Description("Bounty Hunter")]
    BountyHunter = 62,
    [Description("Weaver")]
    Weaver = 63,
    [Description("Jakiro")]
    Jakiro = 64,
    [Description("Batrider")]
    Batrider = 65,
    [Description("Chen")]
    Chen = 66,
    [Description("Spectre")]
    Spectre = 67,
    [Description("Ancient Apparition")]
    AncientApparition = 68,
    [Description("Doom")]
    Doom = 69,
    [Description("Ursa")]
    Ursa = 70,
    [Description("Spirit Breaker")]
    SpiritBreaker = 71,
    [Description("Gyrocopter")]
    Gyrocopter = 72,
    [Description("Alchemist")]
    Alchemist = 73,
    [Description("Invoker")]
    Invoker = 74,
    [Description("Silencer")]
    Silencer = 75,
    [Description("Outworld Destroyer")]
    OutworldDestroyer = 76,
    [Description("Lycan")]
    Lycan = 77,
    [Description("Brewmaster")]
    Brewmaster = 78,
    [Description("Shadow Demon")]
    ShadowDemon = 79,
    [Description("Lone Druid")]
    LoneDruid = 80,
    [Description("Chaos Knight")]
    ChaosKnight = 81,
    [Description("Meepo")]
    Meepo = 82,
    [Description("Treant Protector")]
    TreantProtector = 83,
    [Description("Ogre Magi")]
    OgreMagi = 84,
    [Description("Undying")]
    Undying = 85,
    [Description("Rubick")]
    Rubick = 86,
    [Description("Disruptor")]
    Disruptor = 87,
    [Description("Nyx Assassin")]
    NyxAssassin = 88,
    [Description("Naga Siren")]
    NagaSiren = 89,
    [Description("Keeper of the Light")]
    KeeperOfTheLight = 90,
    [Description("Io")]
    Io = 91,
    [Description("Visage")]
    Visage = 92,
    [Description("Slark")]
    Slark = 93,
    [Description("Medusa")]
    Medusa = 94,
    [Description("Troll Warlord")]
    TrollWarlord = 95,
    [Description("Centaur Warrunner")]
    CentaurWarrunner = 96,
    [Description("Magnus")]
    Magnus = 97,
    [Description("Timbersaw")]
    Timbersaw = 98,
    [Description("Bristleback")]
    Bristleback = 99,
    [Description("Tusk")]
    Tusk = 100,
    [Description("Skywrath Mage")]
    SkywrathMage = 101,
    [Description("Abaddon")]
    Abaddon = 102,
    [Description("Elder Titan")]
    ElderTitan = 103,
    [Description("Legion Commander")]
    LegionCommander = 104,
    [Description("Techies")]
    Techies = 105,
    [Description("Ember Spirit")]
    EmberSpirit = 106,
    [Description("Earth Spirit")]
    EarthSpirit = 107,
    [Description("Underlord")]
    Underlord = 108,
    [Description("Terrorblade")]
    Terrorblade = 109,
    [Description("Phoenix")]
    Phoenix = 110,
    [Description("Oracle")]
    Oracle = 111,
    [Description("Winter Wyvern")]
    WinterWyvern = 112,
    [Description("Arc Warden")]
    ArcWarden = 113,
    [Description("Monkey King")]
    MonkeyKing = 114,
    [Description("Dark Willow")]
    DarkWillow = 119,
    [Description("Pangolier")]
    Pangolier = 120,
    [Description("Grimstroke")]
    Grimstroke = 121,
    [Description("Hoodwink")]
    Hoodwink = 123,
    [Description("Void Spirit")]
    VoidSpirit = 126,
    [Description("Snapfire")]
    Snapfire = 128,
    [Description("Mars")]
    Mars = 129,
    [Description("Ringmaster")]
    Ringmaster = 131,
    [Description("Dawnbreaker")]
    Dawnbreaker = 135,
    [Description("Marci")]
    Marci = 136,
    [Description("Primal Beast")]
    PrimalBeast = 137,
    [Description("Muerta")]
    Muerta = 138,
    [Description("Kez")]
    Kez = 145,
    [Description("Largo")]
    Largo = 155
}