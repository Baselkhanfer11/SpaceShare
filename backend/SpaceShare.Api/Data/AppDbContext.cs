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

        // Every ITenantOwned entity only shows the current organisation's rows.
        // Done by reflection so a new entity can't be forgotten.
        var filterByTenant = typeof(AppDbContext).GetMethod(nameof(FilterByTenant), BindingFlags.NonPublic | BindingFlags.Instance)!;
        foreach (var entity in modelBuilder.Model.GetEntityTypes().Where(t => typeof(ITenantOwned).IsAssignableFrom(t.ClrType)))
            filterByTenant.MakeGenericMethod(entity.ClrType).Invoke(this, [modelBuilder]);
    }

    private void FilterByTenant<T>(ModelBuilder modelBuilder) where T : class, ITenantOwned =>
        modelBuilder.Entity<T>().HasQueryFilter(e => e.OrganizationId == TenantId);
}
