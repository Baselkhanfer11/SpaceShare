namespace SpaceShare.Api.Models;

/// <summary>
/// A photo of a warehouse. The file lives in photo storage under StoredName (a
/// random name), and is served at /api/photos/{StoredName}.
/// </summary>
public class WarehousePhoto : ITenantOwned
{
    public int Id { get; set; }

    public int WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }

    // Always the warehouse's organisation (copied so the tenant filter works on photos too).
    public int OrganizationId { get; set; }

    // e.g. "3f2b…9c.jpg" — random, so photo addresses can't be guessed.
    public string StoredName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }

    // Lowest first; the first photo is the cover shown in search.
    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
