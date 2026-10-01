using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpaceShare.Api.Auth;
using SpaceShare.Api.Data;
using SpaceShare.Api.Dtos;
using SpaceShare.Api.Models;

namespace SpaceShare.Api.Tests;

/// <summary>
/// The most important promise of the whole app: one organisation can never see
/// or change another organisation's data.
/// </summary>
public class TenantIsolationTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Each_organization_only_sees_its_own_team()
    {
        var (a, _) = await api.ApprovedOrg(OrganizationTypes.Provider, "Warehouse A");
        var (b, _) = await api.ApprovedOrg(OrganizationTypes.Client, "Shop B");

        var aStaff = await AddMember(a, "A Staff", Roles.ProviderStaff);
        var bMember = await AddMember(b, "B Member", Roles.ClientMember);

        var aTeam = await a.GetFromJsonAsync<List<TeamMemberDto>>("/api/team");
        var bTeam = await b.GetFromJsonAsync<List<TeamMemberDto>>("/api/team");

        Assert.Equal(["A Staff", "Warehouse A Owner"], aTeam!.Select(m => m.FullName).Order());
        Assert.Equal(["B Member", "Shop B Owner"], bTeam!.Select(m => m.FullName).Order());
        Assert.DoesNotContain(aTeam!, m => m.Id == bMember.Id);
        Assert.DoesNotContain(bTeam!, m => m.Id == aStaff.Id);
    }

    [Fact]
    public async Task Another_organizations_user_cannot_be_changed_even_by_id()
    {
        var (a, _) = await api.ApprovedOrg(OrganizationTypes.Client, "Shop C");
        var (b, _) = await api.ApprovedOrg(OrganizationTypes.Client, "Shop D");
        var victim = await AddMember(b, "D Member", Roles.ClientMember);

        // A guesses B's user id and tries to deactivate them: to A, that user doesn't exist.
        var response = await a.PutAsJsonAsync($"/api/team/{victim.Id}", new TeamMemberUpdateDto(Roles.ClientOwner, false));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var bTeam = await b.GetFromJsonAsync<List<TeamMemberDto>>("/api/team");
        var unchanged = bTeam!.Single(m => m.Id == victim.Id);
        Assert.True(unchanged.IsActive);
        Assert.Equal(Roles.ClientMember, unchanged.Role);
    }

    [Fact]
    public async Task Nobody_signed_in_sees_no_tenant_data_at_all()
    {
        await api.SignUp(OrganizationTypes.Client, "Shop E");

        // Outside a request there's no signed-in user, so no organisation to show.
        using var scope = api.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        Assert.Equal(0, await db.Users.CountAsync());
        Assert.Equal(0, await db.Organizations.CountAsync());
        Assert.True(await db.Users.IgnoreQueryFilters().CountAsync() > 0); // they do exist
    }

    [Fact]
    public void Every_tenant_owned_entity_has_the_tenant_filter()
    {
        using var scope = api.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var unfiltered = db.Model.GetEntityTypes()
            .Where(t => typeof(ITenantOwned).IsAssignableFrom(t.ClrType) && t.GetQueryFilter() is null)
            .Select(t => t.ClrType.Name);
        Assert.Empty(unfiltered);
    }

    [Fact]
    public async Task Owners_cannot_reach_the_admin_screens()
    {
        var (owner, _) = await api.ApprovedOrg(OrganizationTypes.Provider, "Warehouse F");

        var response = await owner.GetAsync("/api/admin/organizations");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private static async Task<TeamMemberDto> AddMember(HttpClient owner, string name, string role)
    {
        var response = await owner.PostAsJsonAsync("/api/team",
            new TeamMemberInputDto(name, ApiFactory.NewEmail("member"), role, ApiFactory.Password));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<TeamMemberDto>())!;
    }
}
