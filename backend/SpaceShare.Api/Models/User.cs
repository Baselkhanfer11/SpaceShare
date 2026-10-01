namespace SpaceShare.Api.Models;

/// <summary>
/// A person who signs in. Always a member of one organisation, with one role
/// that fits that organisation's type (see Roles).
/// </summary>
public class User : ITenantOwned
{
    public int Id { get; set; }

    public int OrganizationId { get; set; }
    public Organization? Organization { get; set; }

    // Used to sign in. Stored trimmed and lower-case, unique across all organisations.
    public string Email { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    // One of Roles.
    public string Role { get; set; } = string.Empty;

    // A deactivated user can't sign in, and their existing token stops working.
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
}
