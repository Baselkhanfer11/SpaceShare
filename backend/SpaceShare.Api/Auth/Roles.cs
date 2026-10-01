using SpaceShare.Api.Models;

namespace SpaceShare.Api.Auth;

/// <summary>
/// All roles in one place. A role always belongs to one kind of organisation:
/// a Provider has owners and staff, a Client has owners and members, and the
/// Platform has admins.
/// </summary>
public static class Roles
{
    public const string PlatformAdmin = "PlatformAdmin";
    public const string ProviderOwner = "ProviderOwner"; // runs a warehouse business: listings, prices, bookings, invoices
    public const string ProviderStaff = "ProviderStaff"; // works in the warehouse: receives, picks, ships
    public const string ClientOwner = "ClientOwner";     // runs a client business: books space, pays invoices
    public const string ClientMember = "ClientMember";   // a client's colleague: tracks stock, asks for shipments

    // The roles that manage their organisation's team (for [Authorize(Roles = ...)]).
    public const string Owners = ProviderOwner + "," + ClientOwner;

    /// <summary>The roles a member of this kind of organisation can have.</summary>
    public static string[] ForType(string organizationType) => organizationType switch
    {
        OrganizationTypes.Platform => [PlatformAdmin],
        OrganizationTypes.Provider => [ProviderOwner, ProviderStaff],
        OrganizationTypes.Client => [ClientOwner, ClientMember],
        _ => [],
    };

    /// <summary>The role of whoever signs an organisation of this type up.</summary>
    public static string OwnerFor(string organizationType) =>
        organizationType == OrganizationTypes.Provider ? ProviderOwner : ClientOwner;

    public static bool IsOwner(string role) => role is ProviderOwner or ClientOwner;
}
