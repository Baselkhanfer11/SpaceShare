using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SpaceShare.Api.Auth;
using SpaceShare.Api.Data;
using SpaceShare.Api.Dtos;
using SpaceShare.Api.Models;

namespace SpaceShare.Api.Controllers;

/// <summary>
/// The people in the signed-in user's organisation. Notice there's no
/// "Where OrganizationId == ..." anywhere: the tenant filter does it, so another
/// organisation's users simply don't exist here (their ids come back 404).
/// </summary>
[ApiController]
[Authorize] // signed in, active, and the organisation is approved
[Route("api/team")]
public class TeamController(AppDbContext db, IPasswordHasher<User> hasher, CurrentUser me) : ControllerBase
{
    // GET /api/team → everyone in my organisation
    [HttpGet]
    public async Task<ActionResult<IEnumerable<TeamMemberDto>>> List() =>
        await db.Users.AsNoTracking()
            .OrderByDescending(u => u.IsActive).ThenBy(u => u.FullName)
            .Select(u => new TeamMemberDto(u.Id, u.FullName, u.Email, u.Role, u.IsActive, u.CreatedAt, u.LastLoginAt))
            .ToListAsync();

    // POST /api/team → an owner adds a colleague
    [Authorize(Roles = Roles.Owners)]
    [HttpPost]
    public async Task<ActionResult<TeamMemberDto>> Add(TeamMemberInputDto input)
    {
        if (string.IsNullOrWhiteSpace(input.FullName))
            return BadRequest(new { message = "The name is required." });
        if (!Roles.ForType(me.OrganizationType ?? "").Contains(input.Role))
            return BadRequest(new { message = $"Role '{input.Role}' isn't available in your organisation." });

        var email = AccountRules.NormalizeEmail(input.Email);
        if (!AccountRules.IsValidEmail(email))
            return BadRequest(new { message = "Enter a valid email address." });
        if (AccountRules.PasswordProblem(input.Password) is string problem)
            return BadRequest(new { message = problem });

        // Emails are unique across every organisation, so this check looks everywhere.
        if (await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == email))
            return Conflict(new { message = "An account with this email already exists." });

        var user = new User
        {
            OrganizationId = me.OrganizationId!.Value,
            Email = email,
            FullName = input.FullName.Trim(),
            Role = input.Role,
        };
        user.PasswordHash = hasher.HashPassword(user, input.Password);
        db.Users.Add(user);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(List), null, ToDto(user));
    }

    // PUT /api/team/5 → an owner changes someone's role, or (de)activates them
    [Authorize(Roles = Roles.Owners)]
    [HttpPut("{id:int}")]
    public async Task<ActionResult<TeamMemberDto>> Update(int id, TeamMemberUpdateDto input)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return NotFound(); // includes every user of another organisation

        if (!Roles.ForType(me.OrganizationType ?? "").Contains(input.Role))
            return BadRequest(new { message = $"Role '{input.Role}' isn't available in your organisation." });
        if (user.Id == me.UserId && !input.IsActive)
            return Conflict(new { message = "You can't deactivate your own account." });

        // Someone must always be left to run the organisation.
        var staysOwner = Roles.IsOwner(input.Role) && input.IsActive;
        if (Roles.IsOwner(user.Role) && user.IsActive && !staysOwner &&
            !await db.Users.AnyAsync(u => u.Id != id && u.IsActive && (u.Role == Roles.ProviderOwner || u.Role == Roles.ClientOwner)))
            return Conflict(new { message = "Your organisation needs at least one active owner." });

        user.Role = input.Role;
        user.IsActive = input.IsActive;
        await db.SaveChangesAsync();
        return ToDto(user);
    }

    private static TeamMemberDto ToDto(User u) =>
        new(u.Id, u.FullName, u.Email, u.Role, u.IsActive, u.CreatedAt, u.LastLoginAt);
}
