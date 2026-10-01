using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using SpaceShare.Api.Models;

namespace SpaceShare.Api.Auth;

/// <summary>
/// Creates the signed token a user gets when they sign in or sign up.
/// Settings come from the "Jwt" config section; the signing key is a secret
/// (dotnet user-secrets locally), never in appsettings.json.
/// </summary>
public class JwtTokenService(IConfiguration config)
{
    public (string Token, DateTime ExpiresAt) Create(User user, Organization organization)
    {
        var jwt = config.GetSection("Jwt");
        var creds = new SigningCredentials(SigningKey(config), SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddMinutes(int.Parse(jwt["ExpiryMinutes"] ?? "480"));

        // Claims = the facts baked into the token. The organisation id is what
        // keeps every query inside the user's own organisation.
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim(CurrentUser.OrganizationClaim, organization.Id.ToString()),
            new Claim(CurrentUser.OrganizationTypeClaim, organization.Type),
        };

        var token = new JwtSecurityToken(
            issuer: jwt["Issuer"],
            audience: jwt["Audience"],
            claims: claims,
            expires: expires,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }

    /// <summary>The key tokens are signed with. Fails loudly if it's missing or too short.</summary>
    public static SymmetricSecurityKey SigningKey(IConfiguration config)
    {
        var key = config["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(key) || Encoding.UTF8.GetByteCount(key) < 32)
            throw new InvalidOperationException(
                "Jwt:Key is missing or shorter than 32 characters. Set it with: " +
                "dotnet user-secrets set \"Jwt:Key\" \"<a long random string>\" (inside backend/SpaceShare.Api).");
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
    }
}
