namespace SpaceShare.Api.Models;

/// <summary>
/// A company using SpaceShare — the "tenant". Every user belongs to exactly one,
/// and everything a company owns (its warehouses, products, bookings…) carries
/// its OrganizationId, so one company can never see another's data.
/// </summary>
public class Organization
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    // Platform (us), Provider (a warehouse owner) or Client (a business storing goods).
    public string Type { get; set; } = OrganizationTypes.Client;

    // New sign-ups wait for the platform admin. One of OrganizationStatuses.
    public string Status { get; set; } = OrganizationStatuses.Pending;

    public string? City { get; set; }
    public string? Phone { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // The platform admin's last decision about this organisation (approve,
    // reject, suspend, reactivate): when, who, and the reason shown to them.
    public DateTime? ReviewedAt { get; set; }
    public int? ReviewedById { get; set; }
    public string? ReviewNote { get; set; }

    public List<User> Users { get; set; } = new();
}

public static class OrganizationTypes
{
    public const string Platform = "Platform"; // the company running SpaceShare
    public const string Provider = "Provider"; // has warehouse space to rent out
    public const string Client = "Client";     // needs space for its goods

    // The types someone can sign up as (Platform is created by the seeder only).
    public static readonly string[] SignUp = { Provider, Client };
}

public static class OrganizationStatuses
{
    public const string Pending = "Pending";     // signed up, waiting for review
    public const string Active = "Active";       // approved — can use the app
    public const string Rejected = "Rejected";   // not approved (the note says why)
    public const string Suspended = "Suspended"; // was active, paused by the platform

    public static readonly string[] All = { Pending, Active, Rejected, Suspended };

    public static bool IsValid(string status) => Array.IndexOf(All, status) >= 0;
}
