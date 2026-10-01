using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using SpaceShare.Api.Data;
using SpaceShare.Api.Models;

namespace SpaceShare.Api.Auth;

public static class Policies
{
    // Signed in, whatever the state of the account (used by "who am I?", so a
    // pending or suspended organisation can still see why it's blocked).
    public const string SignedIn = "SignedIn";
}

/// <summary>
/// The default rule behind every [Authorize]: the user is still active AND their
/// organisation is approved. Checked against the database on each request, so
/// approving, suspending or deactivating takes effect at once — no new token needed.
/// </summary>
public class ActiveAccountRequirement : IAuthorizationRequirement;

public class ActiveAccountHandler(AppDbContext db, CurrentUser me) : AuthorizationHandler<ActiveAccountRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, ActiveAccountRequirement requirement)
    {
        if (me.UserId is not int userId || me.OrganizationId is not int orgId) return;

        var userActive = await db.Users.AnyAsync(u => u.Id == userId && u.IsActive);
        var orgActive = await db.Organizations.AnyAsync(o => o.Id == orgId && o.Status == OrganizationStatuses.Active);
        if (userActive && orgActive) context.Succeed(requirement);
    }
}
