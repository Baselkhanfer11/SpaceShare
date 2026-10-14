using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SpaceShare.Api.Auth;
using SpaceShare.Api.Models;
using SpaceShare.Api.Services;

namespace SpaceShare.Api.Data;

/// <summary>
/// Fills a local database with example companies, people and listings, so the app can be tried
/// without typing everything in by hand. Runs only in Development, only when "Seed:DemoPassword"
/// is set (a secret, never in git — every demo account signs in with it), and adds the data only
/// once. If the secret changes later, the demo accounts follow it on the next start, so the current
/// secret always works. Demo emails end in @demo.spaceshare.local.
/// Nobody is signed in here, so every query skips the tenant filters on purpose.
/// </summary>
public static class DemoSeeder
{
    public const string EmailDomain = "@demo.spaceshare.local";

    // ---- the example data ----

    private record Person(string Name, string Email, string Role);
    private record Offer(string Unit, string Temperature, int Capacity, decimal Price, int MinWeeks);
    private record Listing(
        string Name, string City, string Address, string Description, string Hours, string[] Features,
        string Status, string? ReviewNote, string[] Photos, Offer[] Offers);
    private record Company(string Name, string Type, string Status, string City, Person[] People, Listing[] Listings);

    private static readonly Company[] Companies =
    {
        new("Sahab Logistics Park", OrganizationTypes.Provider, OrganizationStatuses.Active, "Amman",
            [new("Rami Haddad", "rami", Roles.ProviderOwner), new("Omar Saleh", "omar", Roles.ProviderStaff)],
            [
                new("Sahab Industrial Warehouse", "Amman", "King Abdullah II Industrial City, Sahab",
                    "A 4,000 m² ambient warehouse with selective pallet racking, two loading docks and forklifts on site. Ten minutes from the Desert Highway.",
                    "Sun–Thu 8:00–17:00, Sat 9:00–13:00",
                    [WarehouseFeatures.Cctv, WarehouseFeatures.LoadingDock, WarehouseFeatures.Forklift, WarehouseFeatures.Racking, WarehouseFeatures.FireSystem],
                    WarehouseStatuses.Approved, null,
                    ["exterior-day.jpg", "racks-open.jpg", "loading-dock.jpg"],
                    [new(SpaceUnits.Pallet, Temperatures.Ambient, 400, 2.75m, 2), new(SpaceUnits.Shelf, Temperatures.Ambient, 120, 1.25m, 1)]),
                new("Marka Annex", "Amman", "Marka, near the airport road",
                    "Open floor space for bulky goods, with a roller door for vans.",
                    "Sun–Thu 9:00–16:00",
                    [WarehouseFeatures.Cctv],
                    WarehouseStatuses.Rejected, "The photos don’t show the storage area. Please add photos of the inside.",
                    ["exterior-night.jpg"],
                    [new(SpaceUnits.SquareMeter, Temperatures.Ambient, 200, 0.90m, 4)]),
            ]),
        new("Aqaba Gateway Storage", OrganizationTypes.Provider, OrganizationStatuses.Active, "Aqaba",
            [new("Lina Khoury", "lina", Roles.ProviderOwner)],
            [
                new("Aqaba Port South Depot", "Aqaba", "South Industrial Zone, Aqaba",
                    "Next to the port, for importers who need goods stored close to customs. Chilled rooms for food and medicine.",
                    "Open every day, 24 hours",
                    [WarehouseFeatures.Cctv, WarehouseFeatures.SecurityGuards, WarehouseFeatures.Access24h, WarehouseFeatures.LoadingDock, WarehouseFeatures.Forklift],
                    WarehouseStatuses.Approved, null,
                    ["sunset.jpg", "from-above.jpg"],
                    [new(SpaceUnits.Pallet, Temperatures.Ambient, 250, 2.40m, 1), new(SpaceUnits.Pallet, Temperatures.Chilled, 80, 3.80m, 2)]),
            ]),
        new("Zarqa Cold Chain", OrganizationTypes.Provider, OrganizationStatuses.Active, "Zarqa",
            [new("Sami Nasser", "sami", Roles.ProviderOwner)],
            [
                new("Zarqa Cold Store", "Zarqa", "Awajan Industrial Area, Zarqa",
                    "Chilled and frozen storage with temperature logs you can ask for any time.",
                    "Sun–Thu 7:00–19:00",
                    [WarehouseFeatures.Cctv, WarehouseFeatures.Forklift, WarehouseFeatures.Racking, WarehouseFeatures.FireSystem],
                    WarehouseStatuses.Approved, null,
                    ["racks-night.jpg", "racks-close.jpg"],
                    [new(SpaceUnits.Pallet, Temperatures.Chilled, 150, 3.60m, 2), new(SpaceUnits.Pallet, Temperatures.Frozen, 90, 4.75m, 2), new(SpaceUnits.Shelf, Temperatures.Chilled, 60, 1.90m, 1)]),
                new("Zarqa Free Zone Depot", "Zarqa", "Zarqa Free Zone",
                    "Ambient pallet storage inside the free zone.",
                    "Sun–Thu 8:00–16:00",
                    [WarehouseFeatures.SecurityGuards, WarehouseFeatures.Racking],
                    WarehouseStatuses.Pending, null,
                    ["racks-open.jpg"],
                    [new(SpaceUnits.Pallet, Temperatures.Ambient, 300, 2.20m, 1)]),
            ]),
        new("Irbid Storage Hub", OrganizationTypes.Provider, OrganizationStatuses.Pending, "Irbid",
            [new("Hiba Jaber", "hiba", Roles.ProviderOwner)], []),
        new("Bayt Coffee Roasters", OrganizationTypes.Client, OrganizationStatuses.Active, "Amman",
            [new("Nadia Odeh", "nadia", Roles.ClientOwner), new("Yousef Odeh", "yousef", Roles.ClientMember)], []),
        new("Irbid Textile Co.", OrganizationTypes.Client, OrganizationStatuses.Active, "Irbid",
            [new("Khaled Mansour", "khaled", Roles.ClientOwner)], []),
        new("Aqaba Marine Spares", OrganizationTypes.Client, OrganizationStatuses.Pending, "Aqaba",
            [new("Tariq Saeed", "tariq", Roles.ClientOwner)], []),
    };

    public static async Task SeedAsync(IServiceProvider services)
    {
        var config = services.GetRequiredService<IConfiguration>();
        var password = config["Seed:DemoPassword"];
        if (string.IsNullOrWhiteSpace(password)) return;

        var db = services.GetRequiredService<AppDbContext>();
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(DemoSeeder));
        var hasher = services.GetRequiredService<IPasswordHasher<User>>();

        var existing = await db.Users.IgnoreQueryFilters().Where(u => u.Email.EndsWith(EmailDomain)).ToListAsync();
        if (existing.Count > 0)
        {
            // Already added: just make sure the demo accounts sign in with the current secret.
            var stale = existing.Where(u => hasher.VerifyHashedPassword(u, u.PasswordHash, password) == PasswordVerificationResult.Failed).ToList();
            foreach (var u in stale) u.PasswordHash = hasher.HashPassword(u, password);
            if (stale.Count > 0)
            {
                await db.SaveChangesAsync();
                logger.LogInformation("Updated {Count} demo accounts to the current Seed:DemoPassword.", stale.Count);
            }
            return;
        }

        var photos = services.GetRequiredService<PhotoStorage>();
        var photoFolder = Path.Combine(services.GetRequiredService<IWebHostEnvironment>().ContentRootPath, "DemoData", "photos");
        var adminId = await db.Users.IgnoreQueryFilters().Where(u => u.Role == Roles.PlatformAdmin).Select(u => (int?)u.Id).FirstOrDefaultAsync();
        var now = DateTime.UtcNow;

        var daysAgo = 30;
        foreach (var c in Companies)
        {
            var created = now.AddDays(-daysAgo);
            daysAgo -= 3;
            var reviewed = c.Status == OrganizationStatuses.Pending;
            var org = new Organization
            {
                Name = c.Name, Type = c.Type, Status = c.Status, City = c.City, CreatedAt = created,
                ReviewedAt = reviewed ? null : created.AddDays(1), ReviewedById = reviewed ? null : adminId,
            };
            db.Organizations.Add(org);
            await db.SaveChangesAsync();

            foreach (var p in c.People)
            {
                var user = new User { OrganizationId = org.Id, Email = p.Email + EmailDomain, FullName = p.Name, Role = p.Role, CreatedAt = created };
                user.PasswordHash = hasher.HashPassword(user, password);
                db.Users.Add(user);
            }

            foreach (var l in c.Listings)
            {
                var submitted = l.Status == WarehouseStatuses.Draft ? (DateTime?)null : created.AddDays(2);
                var decided = l.Status is WarehouseStatuses.Approved or WarehouseStatuses.Rejected;
                var warehouse = new Warehouse
                {
                    OrganizationId = org.Id, Name = l.Name, City = l.City, Address = l.Address, Description = l.Description,
                    OpeningHours = l.Hours, Features = [.. l.Features], Status = l.Status, ReviewNote = l.ReviewNote,
                    SubmittedAt = submitted, ReviewedAt = decided ? created.AddDays(3) : null, ReviewedById = decided ? adminId : null,
                    CreatedAt = created.AddDays(1), UpdatedAt = created.AddDays(2),
                };
                for (var i = 0; i < l.Photos.Length; i++)
                {
                    var source = Path.Combine(photoFolder, l.Photos[i]);
                    if (!File.Exists(source)) { logger.LogWarning("Demo photo {Photo} is missing; skipped.", source); continue; }
                    warehouse.Photos.Add(new WarehousePhoto
                    {
                        OrganizationId = org.Id, StoredName = photos.SaveCopy(source), ContentType = "image/jpeg",
                        SizeBytes = new FileInfo(source).Length, SortOrder = i,
                    });
                }
                foreach (var o in l.Offers)
                {
                    warehouse.Offers.Add(new SpaceOffer
                    {
                        OrganizationId = org.Id, UnitType = o.Unit, Temperature = o.Temperature,
                        Capacity = o.Capacity, PricePerWeek = o.Price, MinWeeks = o.MinWeeks,
                    });
                }
                db.Warehouses.Add(warehouse);
            }
            await db.SaveChangesAsync();
        }

        logger.LogInformation(
            "Added demo data: {Companies} companies. Sign in as any of {Emails} with Seed:DemoPassword.",
            Companies.Length, string.Join(", ", Companies.SelectMany(c => c.People).Select(p => p.Email + EmailDomain)));
    }
}
