using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpaceShare.Api.Data;
using SpaceShare.Api.Dtos;
using SpaceShare.Api.Models;

namespace SpaceShare.Api.Tests;

/// <summary>The API with a demo password set, so the demo data can be loaded into its throwaway database.</summary>
public class DemoApiFactory : ApiFactory
{
    public const string DemoPassword = "test-demo-password";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("Seed:DemoPassword", DemoPassword);
    }

    /// <summary>Runs the demo seeder (it only runs on its own in Development; the tests run as "Testing").</summary>
    public async Task SeedDemo()
    {
        using var scope = Services.CreateScope();
        await DemoSeeder.SeedAsync(scope.ServiceProvider);
    }
}

/// <summary>The demo data: example accounts can sign in, and it follows the same rules as real data.</summary>
public class DemoDataTests(DemoApiFactory api) : IClassFixture<DemoApiFactory>
{
    private static string Email(string who) => who + DemoSeeder.EmailDomain;

    [Fact]
    public async Task Businesses_see_only_the_live_demo_listings()
    {
        await api.SeedDemo();
        var client = api.ClientWith((await api.SignIn(Email("nadia"), DemoApiFactory.DemoPassword)).Token);

        var results = await client.GetFromJsonAsync<List<SearchResultDto>>("/api/search/warehouses");
        Assert.Equal(
            ["Aqaba Port South Depot", "Sahab Industrial Warehouse", "Zarqa Cold Store"],
            results!.Select(r => r.Name).Order());
        Assert.All(results!, r => Assert.NotNull(r.CoverUrl));
    }

    [Fact]
    public async Task An_owner_sees_their_own_listings_with_photos_and_review_notes()
    {
        await api.SeedDemo();
        var owner = api.ClientWith((await api.SignIn(Email("rami"), DemoApiFactory.DemoPassword)).Token);

        var mine = await owner.GetFromJsonAsync<List<WarehouseSummaryDto>>("/api/warehouses");
        Assert.Equal(2, mine!.Count);
        var rejected = mine.Single(w => w.Status == WarehouseStatuses.Rejected);
        var detail = await owner.GetFromJsonAsync<WarehouseDetailDto>($"/api/warehouses/{rejected.Id}");
        Assert.False(string.IsNullOrEmpty(detail!.ReviewNote));

        var live = mine.Single(w => w.Status == WarehouseStatuses.Approved);
        Assert.Equal(3, live.PhotoCount);
        var photo = await api.CreateClient().GetAsync(live.CoverUrl);
        photo.EnsureSuccessStatusCode();
        Assert.Equal("image/jpeg", photo.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Demo_accounts_follow_the_current_secret()
    {
        await api.SeedDemo();
        // As if the accounts had been created with an older password.
        using (var scope = api.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();
            var yousef = await db.Users.IgnoreQueryFilters().SingleAsync(u => u.Email == Email("yousef"));
            yousef.PasswordHash = hasher.HashPassword(yousef, "an-older-password");
            await db.SaveChangesAsync();
        }

        await api.SeedDemo(); // the next start
        await api.SignIn(Email("yousef"), DemoApiFactory.DemoPassword);
    }

    [Fact]
    public async Task Seeding_twice_adds_nothing_new()
    {
        await api.SeedDemo();
        await api.SeedDemo();
        var client = api.ClientWith((await api.SignIn(Email("khaled"), DemoApiFactory.DemoPassword)).Token);
        Assert.Equal(3, (await client.GetFromJsonAsync<List<SearchResultDto>>("/api/search/warehouses"))!.Count);
    }
}
