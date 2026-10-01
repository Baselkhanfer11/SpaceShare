using System.Security.Claims;

namespace SpaceShare.Api.Auth;

/// <summary>
/// Which organisation's data the current code may see. AppDbContext reads it
/// on every query. Null = nobody is signed in, so no tenant data is visible.
/// </summary>
public interface ITenantProvider
{
    int? OrganizationId { get; }
}

/// <summary>
/// The signed-in user, read from their token's claims.
/// </summary>
public class CurrentUser(IHttpContextAccessor http) : ITenantProvider
{
    // Claim names we add to the token (see JwtTokenService).
    public const string OrganizationClaim = "org";
    public const string OrganizationTypeClaim = "orgType";

    private ClaimsPrincipal? Principal => http.HttpContext?.User;

    public int? UserId => ReadInt(ClaimTypes.NameIdentifier);
    public int? OrganizationId => ReadInt(OrganizationClaim);
    public string? OrganizationType => Principal?.FindFirstValue(OrganizationTypeClaim);
    public string? Role => Principal?.FindFirstValue(ClaimTypes.Role);

    private int? ReadInt(string claim) =>
        int.TryParse(Principal?.FindFirstValue(claim), out var value) ? value : null;
}
