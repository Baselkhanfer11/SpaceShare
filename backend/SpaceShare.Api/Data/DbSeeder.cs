using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SpaceShare.Api.Auth;
using SpaceShare.Api.Models;

namespace SpaceShare.Api.Data;

/// <summary>
/// Creates the Platform organisation and its first admin the first time the app
/// runs. The admin's email and name come from the "Seed" config section; the
/// password is a secret (dotnet user-secrets locally) and is never in git.
/// Nobody is signed in here, so every query skips the tenant filters on purpose.
/// </summary>
public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        var db = services.GetRequiredService<AppDbContext>();
        var config = services.GetRequiredService<IConfiguration>();
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(DbSeeder));

        var platform = await db.Organizations.IgnoreQueryFilters()
            .FirstOrDefaultAsync(o => o.Type == OrganizationTypes.Platform);
        if (platform is null)
        {
            platform = new Organization
            {
                Name = "SpaceShare",
                Type = OrganizationTypes.Platform,
                Status = OrganizationStatuses.Active,
            };
            db.Organizations.Add(platform);
            await db.SaveChangesAsync();
        }

        if (await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Role == Roles.PlatformAdmin)) return;

        var email = config["Seed:AdminEmail"]?.Trim().ToLowerInvariant();
        var password = config["Seed:AdminPassword"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning(
                "No platform admin yet. Set Seed:AdminPassword (and Seed:AdminEmail) with dotnet user-secrets " +
                "inside backend/SpaceShare.Api, then restart the API.");
            return;
        }

        var admin = new User
        {
            OrganizationId = platform.Id,
            Email = email,
            FullName = config["Seed:AdminFullName"] ?? "Platform Admin",
            Role = Roles.PlatformAdmin,
        };
        admin.PasswordHash = services.GetRequiredService<IPasswordHasher<User>>().HashPassword(admin, password);
        db.Users.Add(admin);
        await db.SaveChangesAsync();
        logger.LogInformation("Created the platform admin {Email}.", email);
    }
}
