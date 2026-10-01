using System.Reflection;
using Microsoft.EntityFrameworkCore;
using SpaceShare.Api.Auth;
using SpaceShare.Api.Models;

namespace SpaceShare.Api.Data;

/// <summary>
/// The database. Its most important job is TENANT ISOLATION: every query on an
/// organisation's data is automatically limited to the signed-in user's own
/// organisation, by the query filters set up below.
///
/// The only way past them is an explicit .IgnoreQueryFilters() — used for
/// signing in (the user isn't known yet), the seeder and the platform admin's
/// screens. Search for IgnoreQueryFilters to audit every place that does it.
/// </summary>
public class AppDbContext(DbContextOptions<AppDbContext> options, ITenantProvider tenant) : DbContext(options)
{
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<SpaceOffer> SpaceOffers => Set<SpaceOffer>();
    public DbSet<WarehousePhoto> WarehousePhotos => Set<WarehousePhoto>();

    // The organisation this context may see (null = nobody signed in → nothing).
    // The filters read it on every query, so it's always the current request's value.
    private int? TenantId => tenant.OrganizationId;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Organization>(e =>
        {
            e.Property(o => o.Name).HasMaxLength(200);
            e.Property(o => o.Type).HasMaxLength(20);
            e.Property(o => o.Status).HasMaxLength(20);
            e.Property(o => o.City).HasMaxLength(100);
            e.Property(o => o.Phone).HasMaxLength(40);
            e.Property(o => o.ReviewNote).HasMaxLength(1000);
            e.HasIndex(o => o.Status);

            // An organisation only sees itself.
            e.HasQueryFilter(o => o.Id == TenantId);
        });

        modelBuilder.Entity<User>(e =>
        {
            e.Property(u => u.Email).HasMaxLength(256);
            e.Property(u => u.FullName).HasMaxLength(200);
            e.Property(u => u.Role).HasMaxLength(40);

            // One account per email address, across ALL organisations.
            e.HasIndex(u => u.Email).IsUnique();

            // Organisations aren't deleted while they have users.
            e.HasOne(u => u.Organization)
                .WithMany(o => o.Users)
                .HasForeignKey(u => u.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Warehouse>(e =>
        {
            e.Property(w => w.Name).HasMaxLength(200);
            e.Property(w => w.City).HasMaxLength(100);
            e.Property(w => w.Address).HasMaxLength(300);
            e.Property(w => w.Description).HasMaxLength(2000);
            e.Property(w => w.OpeningHours).HasMaxLength(200);
            e.Property(w => w.Status).HasMaxLength(20);
            e.Property(w => w.ReviewNote).HasMaxLength(1000);
            e.HasIndex(w => new { w.Status, w.City }); // search: approved listings in a city

            // A provider with warehouses can't be deleted.
            e.HasOne(w => w.Organization)
                .WithMany()
                .HasForeignKey(w => w.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SpaceOffer>(e =>
        {
            e.Property(o => o.UnitType).HasMaxLength(20);
            e.Property(o => o.Temperature).HasMaxLength(20);
            e.Property(o => o.PricePerWeek).HasPrecision(18, 2);
            e.Property(o => o.Notes).HasMaxLength(500);

            // Offers are part of their warehouse.
            e.HasOne(o => o.Warehouse)
                .WithMany(w => w.Offers)
                .HasForeignKey(o => o.WarehouseId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WarehousePhoto>(e =>
        {
            e.Property(p => p.StoredName).HasMaxLength(100);
            e.Property(p => p.ContentType).HasMaxLength(50);
            e.HasIndex(p => p.StoredName).IsUnique();

            // Photos are part of their warehouse (the files are removed in code).
            e.HasOne(p => p.Warehouse)
                .WithMany(w => w.Photos)
                .HasForeignKey(p => p.WarehouseId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Every ITenantOwned entity only shows the current organisation's rows.
        // Done by reflection so a new entity can't be forgotten.
        var filterByTenant = typeof(AppDbContext).GetMethod(nameof(FilterByTenant), BindingFlags.NonPublic | BindingFlags.Instance)!;
        foreach (var entity in modelBuilder.Model.GetEntityTypes().Where(t => typeof(ITenantOwned).IsAssignableFrom(t.ClrType)))
            filterByTenant.MakeGenericMethod(entity.ClrType).Invoke(this, [modelBuilder]);
    }

    private void FilterByTenant<T>(ModelBuilder modelBuilder) where T : class, ITenantOwned =>
        modelBuilder.Entity<T>().HasQueryFilter(e => e.OrganizationId == TenantId);
}
