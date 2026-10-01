namespace SpaceShare.Api.Models;

/// <summary>
/// One kind of space a warehouse rents out, e.g. "120 chilled pallets at 3.50 a
/// pallet per week, 2 weeks minimum". A warehouse can have several.
/// </summary>
public class SpaceOffer : ITenantOwned
{
    public int Id { get; set; }

    public int WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }

    // Always the warehouse's organisation (copied so the tenant filter works on offers too).
    public int OrganizationId { get; set; }

    // Pallet, Shelf or SquareMeter. One of SpaceUnits.
    public string UnitType { get; set; } = SpaceUnits.Pallet;

    // Ambient, Chilled or Frozen. One of Temperatures.
    public string Temperature { get; set; } = Temperatures.Ambient;

    // How many units the warehouse rents out in total.
    public int Capacity { get; set; }

    // Price for one unit for one week.
    public decimal PricePerWeek { get; set; }

    // The shortest booking accepted, in weeks.
    public int MinWeeks { get; set; } = 1;

    // An inactive offer stays in the listing's history but isn't shown in search.
    public bool IsActive { get; set; } = true;

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public static class SpaceUnits
{
    public const string Pallet = "Pallet";
    public const string Shelf = "Shelf";
    public const string SquareMeter = "SquareMeter";

    public static readonly string[] All = { Pallet, Shelf, SquareMeter };

    public static bool IsValid(string unit) => Array.IndexOf(All, unit) >= 0;
}

public static class Temperatures
{
    public const string Ambient = "Ambient";
    public const string Chilled = "Chilled";
    public const string Frozen = "Frozen";

    public static readonly string[] All = { Ambient, Chilled, Frozen };

    public static bool IsValid(string temperature) => Array.IndexOf(All, temperature) >= 0;
}
