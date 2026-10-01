using System.Net;
using System.Net.Http.Json;
using SpaceShare.Api.Auth;
using SpaceShare.Api.Dtos;
using SpaceShare.Api.Models;

namespace SpaceShare.Api.Tests;

/// <summary>Signing up, approval, and who may do what in their organisation.</summary>
public class AccountTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Sign_up_creates_a_pending_organization_with_its_owner_signed_in()
    {
        var (client, auth) = await api.SignUp(OrganizationTypes.Provider, "Cold Store");

        Assert.Equal(OrganizationStatuses.Pending, auth.Me.Organization.Status);
        Assert.Equal(OrganizationTypes.Provider, auth.Me.Organization.Type);
        Assert.Equal(Roles.ProviderOwner, auth.Me.User.Role);

        var me = await client.GetFromJsonAsync<MeDto>("/api/auth/me");
        Assert.Equal("Cold Store", me!.Organization.Name);
    }

    [Fact]
    public async Task A_pending_organization_is_blocked_until_approved()
    {
        var (client, auth) = await api.SignUp(OrganizationTypes.Client, "Toy Shop");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/team")).StatusCode);

        var admin = await api.Admin();
        var approve = await admin.PostAsJsonAsync($"/api/admin/organizations/{auth.Me.Organization.Id}/approve", new ReviewNoteDto(null));
        Assert.Equal(HttpStatusCode.NoContent, approve.StatusCode);

        // The same token works now — approval is checked on every request.
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/team")).StatusCode);
    }

    [Fact]
    public async Task Rejecting_needs_a_reason_which_the_organization_sees()
    {
        var (client, auth) = await api.SignUp(OrganizationTypes.Client, "Odd Shop");
        var admin = await api.Admin();
        var url = $"/api/admin/organizations/{auth.Me.Organization.Id}/reject";

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync(url, new ReviewNoteDto(" "))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsJsonAsync(url, new ReviewNoteDto("Missing trade licence"))).StatusCode);

        var me = await client.GetFromJsonAsync<MeDto>("/api/auth/me");
        Assert.Equal(OrganizationStatuses.Rejected, me!.Organization.Status);
        Assert.Equal("Missing trade licence", me.Organization.ReviewNote);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/team")).StatusCode);
    }

    [Fact]
    public async Task Suspending_blocks_an_organization_at_once_and_reactivating_lets_it_back()
    {
        var (client, auth) = await api.ApprovedOrg(OrganizationTypes.Provider, "Big Depot");
        var admin = await api.Admin();
        var id = auth.Me.Organization.Id;

        Assert.Equal(HttpStatusCode.NoContent,
            (await admin.PostAsJsonAsync($"/api/admin/organizations/{id}/suspend", new ReviewNoteDto("Unpaid invoices"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/team")).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent,
            (await admin.PostAsJsonAsync($"/api/admin/organizations/{id}/reactivate", new ReviewNoteDto(null))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/team")).StatusCode);
    }

    [Fact]
    public async Task Approving_twice_is_refused()
    {
        var (_, auth) = await api.ApprovedOrg(OrganizationTypes.Client, "Twice Shop");
        var admin = await api.Admin();

        var again = await admin.PostAsJsonAsync($"/api/admin/organizations/{auth.Me.Organization.Id}/approve", new ReviewNoteDto(null));
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
    }

    [Fact]
    public async Task An_email_can_only_be_used_once_across_all_organizations()
    {
        var (owner, auth) = await api.ApprovedOrg(OrganizationTypes.Client, "Email Shop");
        var taken = auth.Me.User.Email;

        var signUp = await api.CreateClient().PostAsJsonAsync("/api/auth/register", new RegisterDto(
            OrganizationTypes.Provider, "Copycat", null, null, "Someone", taken.ToUpperInvariant(), ApiFactory.Password));
        Assert.Equal(HttpStatusCode.Conflict, signUp.StatusCode);

        var add = await owner.PostAsJsonAsync("/api/team", new TeamMemberInputDto("Twin", taken, Roles.ClientMember, ApiFactory.Password));
        Assert.Equal(HttpStatusCode.Conflict, add.StatusCode);
    }

    [Fact]
    public async Task A_wrong_password_and_an_unknown_email_get_the_same_answer()
    {
        var (_, auth) = await api.SignUp(OrganizationTypes.Client, "Quiet Shop");

        var wrong = await api.CreateClient().PostAsJsonAsync("/api/auth/login", new LoginDto(auth.Me.User.Email, "not-the-password"));
        var unknown = await api.CreateClient().PostAsJsonAsync("/api/auth/login", new LoginDto(ApiFactory.NewEmail("nobody"), "whatever-123"));

        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
        Assert.Equal(await wrong.Content.ReadAsStringAsync(), await unknown.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task A_deactivated_member_can_neither_sign_in_nor_use_their_token()
    {
        var (owner, _) = await api.ApprovedOrg(OrganizationTypes.Provider, "Staff Depot");
        var email = ApiFactory.NewEmail("staff");
        var added = await owner.PostAsJsonAsync("/api/team", new TeamMemberInputDto("Sam", email, Roles.ProviderStaff, ApiFactory.Password));
        var staff = (await added.Content.ReadFromJsonAsync<TeamMemberDto>())!;
        var staffClient = api.ClientWith((await api.SignIn(email, ApiFactory.Password)).Token);
        Assert.Equal(HttpStatusCode.OK, (await staffClient.GetAsync("/api/team")).StatusCode);

        var off = await owner.PutAsJsonAsync($"/api/team/{staff.Id}", new TeamMemberUpdateDto(Roles.ProviderStaff, false));
        Assert.Equal(HttpStatusCode.OK, off.StatusCode);

        Assert.Equal(HttpStatusCode.Forbidden, (await staffClient.GetAsync("/api/team")).StatusCode);
        var signIn = await api.CreateClient().PostAsJsonAsync("/api/auth/login", new LoginDto(email, ApiFactory.Password));
        Assert.Equal(HttpStatusCode.Unauthorized, signIn.StatusCode);
    }

    [Fact]
    public async Task The_last_owner_cannot_step_down_or_switch_themselves_off()
    {
        var (owner, auth) = await api.ApprovedOrg(OrganizationTypes.Client, "Solo Shop");
        var myId = auth.Me.User.Id;

        var demote = await owner.PutAsJsonAsync($"/api/team/{myId}", new TeamMemberUpdateDto(Roles.ClientMember, true));
        var deactivate = await owner.PutAsJsonAsync($"/api/team/{myId}", new TeamMemberUpdateDto(Roles.ClientOwner, false));

        Assert.Equal(HttpStatusCode.Conflict, demote.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, deactivate.StatusCode);
    }

    [Fact]
    public async Task Members_cannot_manage_the_team_and_roles_must_fit_the_organization()
    {
        var (owner, _) = await api.ApprovedOrg(OrganizationTypes.Client, "Role Shop");

        var wrongRole = await owner.PostAsJsonAsync("/api/team",
            new TeamMemberInputDto("Wrong", ApiFactory.NewEmail("wrong"), Roles.ProviderStaff, ApiFactory.Password));
        Assert.Equal(HttpStatusCode.BadRequest, wrongRole.StatusCode);

        var email = ApiFactory.NewEmail("member");
        (await owner.PostAsJsonAsync("/api/team", new TeamMemberInputDto("Mia", email, Roles.ClientMember, ApiFactory.Password)))
            .EnsureSuccessStatusCode();
        var member = api.ClientWith((await api.SignIn(email, ApiFactory.Password)).Token);

        var tryAdd = await member.PostAsJsonAsync("/api/team",
            new TeamMemberInputDto("Sneaky", ApiFactory.NewEmail("sneaky"), Roles.ClientOwner, ApiFactory.Password));
        Assert.Equal(HttpStatusCode.Forbidden, tryAdd.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await member.GetAsync("/api/team")).StatusCode); // can still look
    }
}
