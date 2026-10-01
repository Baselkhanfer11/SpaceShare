using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using SpaceShare.Api.Auth;
using SpaceShare.Api.Dtos;
using SpaceShare.Api.Models;

namespace SpaceShare.Api.Tests;

/// <summary>
/// Listings: owners build them, the admin reviews them, businesses search them —
/// and search never shows anything that isn't approved.
/// </summary>
public class ListingTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    // A real 1×1 PNG, so it passes the "is this really an image?" check.
    private static readonly byte[] Png = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");

    [Fact]
    public async Task A_draft_is_invisible_to_search_and_to_the_admin()
    {
        var (owner, _) = await api.ApprovedOrg(OrganizationTypes.Provider, "Draft Depot");
        var draft = await CreateWarehouse(owner, "Hidden Draft", "Zarqa");

        var client = await AClient();
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/search/warehouses/{draft.Id}")).StatusCode);
        Assert.DoesNotContain(await Search(client, "?city=Zarqa"), r => r.Id == draft.Id);

        var admin = await api.Admin();
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync($"/api/admin/warehouses/{draft.Id}")).StatusCode);
    }

    [Fact]
    public async Task Submitting_needs_a_photo_and_an_active_offer()
    {
        var (owner, _) = await api.ApprovedOrg(OrganizationTypes.Provider, "Empty Depot");
        var w = await CreateWarehouse(owner, "Bare Warehouse", "Irbid");

        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsync($"/api/warehouses/{w.Id}/submit", null)).StatusCode);
        await AddPhoto(owner, w.Id);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsync($"/api/warehouses/{w.Id}/submit", null)).StatusCode);
        await AddOffer(owner, w.Id, SpaceUnits.Pallet, Temperatures.Ambient, 50, 2.5m);
        Assert.Equal(HttpStatusCode.NoContent, (await owner.PostAsync($"/api/warehouses/{w.Id}/submit", null)).StatusCode);

        var mine = await owner.GetFromJsonAsync<WarehouseDetailDto>($"/api/warehouses/{w.Id}");
        Assert.Equal(WarehouseStatuses.Pending, mine!.Status);
    }

    [Fact]
    public async Task Only_approved_listings_appear_in_search()
    {
        var (owner, _) = await api.ApprovedOrg(OrganizationTypes.Provider, "Review Depot");
        var pending = await ReadyListing(owner, "Waiting Warehouse", "Aqaba");
        Assert.Equal(HttpStatusCode.NoContent, (await owner.PostAsync($"/api/warehouses/{pending.Id}/submit", null)).StatusCode);

        var client = await AClient();
        Assert.Empty(await Search(client, "?city=Aqaba"));

        var admin = await api.Admin();
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsync($"/api/admin/warehouses/{pending.Id}/approve", null)).StatusCode);
        Assert.Single(await Search(client, "?city=Aqaba"));
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/search/warehouses/{pending.Id}")).StatusCode);
        Assert.Contains("Aqaba", (await client.GetFromJsonAsync<List<string>>("/api/search/cities"))!);
    }

    [Fact]
    public async Task Search_filters_offers_by_unit_temperature_price_and_size()
    {
        var w = await LiveListing("Filter Warehouse", "Madaba",
            (SpaceUnits.Pallet, Temperatures.Chilled, 100, 4.00m),
            (SpaceUnits.Pallet, Temperatures.Ambient, 20, 2.00m),
            (SpaceUnits.Shelf, Temperatures.Ambient, 300, 1.00m));
        var client = await AClient();

        var chilled = await Search(client, "?city=Madaba&unitType=Pallet&temperature=Chilled");
        Assert.Equal([4.00m], chilled.Single(r => r.Id == w).Offers.Select(o => o.PricePerWeek));

        var cheapPallets = await Search(client, "?city=Madaba&unitType=Pallet&maxPrice=3");
        Assert.Equal([2.00m], cheapPallets.Single(r => r.Id == w).Offers.Select(o => o.PricePerWeek));

        // 50 ambient pallets: the only ambient pallet offer has 20 → no match at all.
        Assert.Empty(await Search(client, "?city=Madaba&unitType=Pallet&temperature=Ambient&minUnits=50"));
    }

    [Fact]
    public async Task Inactive_offers_are_never_shown_in_search()
    {
        var w = await LiveListing("Paused Offer Warehouse", "Ajloun",
            (SpaceUnits.Pallet, Temperatures.Ambient, 40, 3.00m),
            (SpaceUnits.Shelf, Temperatures.Ambient, 40, 1.50m));
        var ownerClient = _owners[w];
        var detail = await ownerClient.GetFromJsonAsync<WarehouseDetailDto>($"/api/warehouses/{w}");
        var shelf = detail!.Offers.Single(o => o.UnitType == SpaceUnits.Shelf);
        (await ownerClient.PutAsJsonAsync($"/api/warehouses/{w}/offers/{shelf.Id}",
            new SpaceOfferInputDto(shelf.UnitType, shelf.Temperature, shelf.Capacity, shelf.PricePerWeek, shelf.MinWeeks, false, null)))
            .EnsureSuccessStatusCode();

        var client = await AClient();
        var listing = await client.GetFromJsonAsync<WarehouseDetailDto>($"/api/search/warehouses/{w}");
        Assert.Equal([SpaceUnits.Pallet], listing!.Offers.Select(o => o.UnitType));
        Assert.Empty(await Search(client, "?city=Ajloun&unitType=Shelf"));
    }

    [Fact]
    public async Task Providers_cannot_see_or_change_each_others_warehouses()
    {
        var (a, _) = await api.ApprovedOrg(OrganizationTypes.Provider, "Provider A");
        var (b, _) = await api.ApprovedOrg(OrganizationTypes.Provider, "Provider B");
        var bWarehouse = await ReadyListing(b, "B's Warehouse", "Salt");
        var bPhoto = (await b.GetFromJsonAsync<WarehouseDetailDto>($"/api/warehouses/{bWarehouse.Id}"))!.Photos[0];
        var bOffer = (await b.GetFromJsonAsync<WarehouseDetailDto>($"/api/warehouses/{bWarehouse.Id}"))!.Offers[0];

        Assert.DoesNotContain((await a.GetFromJsonAsync<List<WarehouseSummaryDto>>("/api/warehouses"))!, w => w.Id == bWarehouse.Id);
        Assert.Equal(HttpStatusCode.NotFound, (await a.GetAsync($"/api/warehouses/{bWarehouse.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await a.PutAsJsonAsync($"/api/warehouses/{bWarehouse.Id}", Input("Hijacked", "Salt"))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await a.PostAsync($"/api/warehouses/{bWarehouse.Id}/submit", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await a.DeleteAsync($"/api/warehouses/{bWarehouse.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await a.DeleteAsync($"/api/warehouses/{bWarehouse.Id}/photos/{bPhoto.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await a.DeleteAsync($"/api/warehouses/{bWarehouse.Id}/offers/{bOffer.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await a.PostAsJsonAsync($"/api/warehouses/{bWarehouse.Id}/offers",
            new SpaceOfferInputDto(SpaceUnits.Pallet, Temperatures.Ambient, 1, 1m, 1, true, null))).StatusCode);

        var still = await b.GetFromJsonAsync<WarehouseDetailDto>($"/api/warehouses/{bWarehouse.Id}");
        Assert.Equal("B's Warehouse", still!.Name);
        Assert.Single(still.Photos);
        Assert.Single(still.Offers);
    }

    [Fact]
    public async Task Only_a_provider_owner_can_create_listings()
    {
        var client = await AClient();
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/warehouses", Input("Not Mine", "Amman"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/warehouses")).StatusCode);

        var (owner, _) = await api.ApprovedOrg(OrganizationTypes.Provider, "Staffed Depot");
        var email = ApiFactory.NewEmail("staff");
        (await owner.PostAsJsonAsync("/api/team", new TeamMemberInputDto("Staff", email, Roles.ProviderStaff, ApiFactory.Password)))
            .EnsureSuccessStatusCode();
        var staff = api.ClientWith((await api.SignIn(email, ApiFactory.Password)).Token);

        Assert.Equal(HttpStatusCode.OK, (await staff.GetAsync("/api/warehouses")).StatusCode); // can look
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.PostAsJsonAsync("/api/warehouses", Input("Staff's", "Amman"))).StatusCode);
    }

    [Fact]
    public async Task A_file_that_only_pretends_to_be_an_image_is_refused()
    {
        var (owner, _) = await api.ApprovedOrg(OrganizationTypes.Provider, "Fake Photo Depot");
        var w = await CreateWarehouse(owner, "Fake Photo Warehouse", "Amman");

        var fake = PhotoForm("this is not a picture"u8.ToArray(), "image/jpeg", "photo.jpg");
        var response = await owner.PostAsync($"/api/warehouses/{w.Id}/photos", fake);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var detail = await owner.GetFromJsonAsync<WarehouseDetailDto>($"/api/warehouses/{w.Id}");
        Assert.Empty(detail!.Photos);
    }

    [Fact]
    public async Task Photos_are_served_and_gone_once_deleted()
    {
        var (owner, _) = await api.ApprovedOrg(OrganizationTypes.Provider, "Photo Depot");
        var w = await CreateWarehouse(owner, "Photo Warehouse", "Amman");
        var photo = await AddPhoto(owner, w.Id);

        var anonymous = api.CreateClient();
        var served = await anonymous.GetAsync(photo.Url);
        Assert.Equal(HttpStatusCode.OK, served.StatusCode);
        Assert.Equal("image/png", served.Content.Headers.ContentType?.MediaType);

        (await owner.DeleteAsync($"/api/warehouses/{w.Id}/photos/{photo.Id}")).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync(photo.Url)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync("/api/photos/..%2F..%2Fappsettings.json")).StatusCode);
    }

    [Fact]
    public async Task Taking_a_listing_down_needs_a_reason_the_owner_sees_and_they_can_resubmit()
    {
        var w = await LiveListing("Taken Down Warehouse", "Karak", (SpaceUnits.Pallet, Temperatures.Ambient, 10, 2m));
        var owner = _owners[w];
        var admin = await api.Admin();

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync($"/api/admin/warehouses/{w}/reject", new ReviewNoteDto(""))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await admin.PostAsJsonAsync($"/api/admin/warehouses/{w}/reject", new ReviewNoteDto("Photos don't match the address"))).StatusCode);

        var client = await AClient();
        Assert.Empty(await Search(client, "?city=Karak"));

        var mine = await owner.GetFromJsonAsync<WarehouseDetailDto>($"/api/warehouses/{w}");
        Assert.Equal(WarehouseStatuses.Rejected, mine!.Status);
        Assert.Equal("Photos don't match the address", mine.ReviewNote);
        Assert.Equal(HttpStatusCode.NoContent, (await owner.PostAsync($"/api/warehouses/{w}/submit", null)).StatusCode);
    }

    [Fact]
    public async Task A_suspended_providers_listings_leave_search()
    {
        var w = await LiveListing("Suspended Warehouse", "Mafraq", (SpaceUnits.Pallet, Temperatures.Frozen, 30, 6m));
        var client = await AClient();
        Assert.Single(await Search(client, "?city=Mafraq"));

        var admin = await api.Admin();
        var orgs = await admin.GetFromJsonAsync<List<AdminOrganizationDto>>("/api/admin/organizations?status=Active");
        var provider = orgs!.Single(o => o.Name == "Suspended Warehouse Co");
        (await admin.PostAsJsonAsync($"/api/admin/organizations/{provider.Id}/suspend", new ReviewNoteDto("Test"))).EnsureSuccessStatusCode();

        Assert.Empty(await Search(client, "?city=Mafraq"));
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/search/warehouses/{w}")).StatusCode);
    }

    // ---- helpers ----

    // The owner's client for each live listing made by LiveListing (by warehouse id).
    private readonly Dictionary<int, HttpClient> _owners = new();

    private static WarehouseInputDto Input(string name, string city) =>
        new(name, city, "1 Test Street", "Clean, dry, secure.", "Sun–Thu 8–17", [WarehouseFeatures.Cctv, WarehouseFeatures.LoadingDock]);

    private static async Task<WarehouseDetailDto> CreateWarehouse(HttpClient owner, string name, string city)
    {
        var response = await owner.PostAsJsonAsync("/api/warehouses", Input(name, city));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<WarehouseDetailDto>())!;
    }

    private static MultipartFormDataContent PhotoForm(byte[] bytes, string contentType, string fileName)
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return new MultipartFormDataContent { { file, "file", fileName } };
    }

    private static async Task<PhotoDto> AddPhoto(HttpClient owner, int warehouseId)
    {
        var response = await owner.PostAsync($"/api/warehouses/{warehouseId}/photos", PhotoForm(Png, "image/png", "photo.png"));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<PhotoDto>())!;
    }

    private static async Task AddOffer(HttpClient owner, int warehouseId, string unit, string temperature, int capacity, decimal price) =>
        (await owner.PostAsJsonAsync($"/api/warehouses/{warehouseId}/offers",
            new SpaceOfferInputDto(unit, temperature, capacity, price, 1, true, null))).EnsureSuccessStatusCode();

    /// <summary>A warehouse with a photo and one offer — ready to submit.</summary>
    private static async Task<WarehouseDetailDto> ReadyListing(HttpClient owner, string name, string city)
    {
        var w = await CreateWarehouse(owner, name, city);
        await AddPhoto(owner, w.Id);
        await AddOffer(owner, w.Id, SpaceUnits.Pallet, Temperatures.Ambient, 25, 3m);
        return w;
    }

    /// <summary>A new provider ("{name} Co") with one approved listing carrying these offers; returns its id.</summary>
    private async Task<int> LiveListing(string name, string city,
        params (string Unit, string Temp, int Capacity, decimal Price)[] offers)
    {
        var (owner, _) = await api.ApprovedOrg(OrganizationTypes.Provider, $"{name} Co");
        var w = await CreateWarehouse(owner, name, city);
        await AddPhoto(owner, w.Id);
        foreach (var o in offers) await AddOffer(owner, w.Id, o.Unit, o.Temp, o.Capacity, o.Price);
        (await owner.PostAsync($"/api/warehouses/{w.Id}/submit", null)).EnsureSuccessStatusCode();
        (await (await api.Admin()).PostAsync($"/api/admin/warehouses/{w.Id}/approve", null)).EnsureSuccessStatusCode();
        _owners[w.Id] = owner;
        return w.Id;
    }

    private async Task<HttpClient> AClient() =>
        (await api.ApprovedOrg(OrganizationTypes.Client, $"Shopper {Guid.NewGuid():N}"[..20])).Client;

    private static async Task<List<SearchResultDto>> Search(HttpClient client, string query) =>
        (await client.GetFromJsonAsync<List<SearchResultDto>>($"/api/search/warehouses{query}"))!;
}
