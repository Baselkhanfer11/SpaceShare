namespace SpaceShare.Api.Models;

/// <summary>
/// A warehouse a Provider lists on the marketplace. It sells its space through
/// one or more SpaceOffers, and shows photos. It only appears in search once the
/// platform admin has approved it.
/// </summary>
public class Warehouse : ITenantOwned
{
    public int Id { get; set; }

    // The Provider organisation that owns it.
    public int OrganizationId { get; set; }
    public Organization? Organization { get; set; }

    public string Name { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? Description { get; set; }

    // Free text, e.g. "Sun–Thu 8:00–17:00".
    public string? OpeningHours { get; set; }

    // What the building offers. Each value is one of WarehouseFeatures.
    public List<string> Features { get; set; } = new();

    // Draft → Pending (submitted) → Approved / Rejected. One of WarehouseStatuses.
    public string Status { get; set; } = WarehouseStatuses.Draft;

    public DateTime? SubmittedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public int? ReviewedById { get; set; }
    // Why it was rejected (shown to the owner).
    public string? ReviewNote { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<WarehousePhoto> Photos { get; set; } = new();
    public List<SpaceOffer> Offers { get; set; } = new();
}

public static class WarehouseStatuses
{
    public const string Draft = "Draft";       // being written, only the owner sees it
    public const string Pending = "Pending";   // submitted, waiting for the platform admin
    public const string Approved = "Approved"; // live in search
    public const string Rejected = "Rejected"; // sent back (the note says why); can be fixed and resubmitted

    public static readonly string[] All = { Draft, Pending, Approved, Rejected };

    public static bool IsValid(string status) => Array.IndexOf(All, status) >= 0;
}

/// <summary>What a warehouse can offer. Stored as these codes; the app translates them.</summary>
public static class WarehouseFeatures
{
    public const string Cctv = "Cctv";
    public const string SecurityGuards = "SecurityGuards";
    public const string Access24h = "Access24h";
    public const string LoadingDock = "LoadingDock";
    public const string Forklift = "Forklift";
    public const string Racking = "Racking";
    public const string FireSystem = "FireSystem";

    public static readonly string[] All = { Cctv, SecurityGuards, Access24h, LoadingDock, Forklift, Racking, FireSystem };

    public static bool IsValid(string feature) => Array.IndexOf(All, feature) >= 0;
}
