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
/// Signing up, signing in, and "who am I?". Signing up and in happen before
/// anyone is known, so those two look users up with IgnoreQueryFilters().
/// </summary>
[ApiController]
[Route("api/auth")]
public class AuthController(
    AppDbContext db,
    JwtTokenService tokens,
    IPasswordHasher<User> hasher,
    CurrentUser me) : ControllerBase
{
    // POST /api/auth/register → a new organisation (waiting for approval) + its owner, signed in.
    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponseDto>> Register(RegisterDto input)
    {
        if (!OrganizationTypes.SignUp.Contains(input.OrganizationType))
            return BadRequest(new { message = "Choose whether you have space to rent out or need space." });
        if (string.IsNullOrWhiteSpace(input.OrganizationName))
            return BadRequest(new { message = "Your company name is required." });
        if (string.IsNullOrWhiteSpace(input.FullName))
            return BadRequest(new { message = "Your name is required." });

        var email = AccountRules.NormalizeEmail(input.Email);
        if (!AccountRules.IsValidEmail(email))
            return BadRequest(new { message = "Enter a valid email address." });
        if (AccountRules.PasswordProblem(input.Password) is string problem)
            return BadRequest(new { message = problem });

        // Emails are unique across every organisation.
        if (await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == email))
            return Conflict(new { message = "An account with this email already exists." });

        var org = new Organization
        {
            Name = input.OrganizationName.Trim(),
            Type = input.OrganizationType,
            Status = OrganizationStatuses.Pending,
            City = Clean(input.City),
            Phone = Clean(input.Phone),
        };
        var owner = new User
        {
            Organization = org,
            Email = email,
            FullName = input.FullName.Trim(),
            Role = Roles.OwnerFor(org.Type),
            LastLoginAt = DateTime.UtcNow,
        };
        owner.PasswordHash = hasher.HashPassword(owner, input.Password);
        db.Users.Add(owner); // adds the organisation too — one SaveChanges, both or neither

        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException)
        {
            // Someone else signed up with this email at the same moment?
            if (await db.Users.IgnoreQueryFilters().AsNoTracking().AnyAsync(u => u.Email == email))
                return Conflict(new { message = "An account with this email already exists." });
            throw;
        }

        return Ok(Respond(owner, org));
    }

    // POST /api/auth/login → a token. Works for any organisation status, so a
    // pending, rejected or suspended organisation can sign in and see why it's blocked.
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login(LoginDto input)
    {
        var email = AccountRules.NormalizeEmail(input.Email);
        var user = await db.Users.IgnoreQueryFilters()
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Email == email);

        // The same answer for "no such email" and "wrong password", so the form
        // can't be used to find out who has an account.
        if (user is null || string.IsNullOrEmpty(input.Password) ||
            hasher.VerifyHashedPassword(user, user.PasswordHash, input.Password) == PasswordVerificationResult.Failed)
            return Unauthorized(new { message = "Wrong email or password." });

        if (!user.IsActive)
            return Unauthorized(new { message = "This account has been deactivated. Ask your organisation's owner." });

        user.LastLoginAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(Respond(user, user.Organization!));
    }

    // GET /api/auth/me → the signed-in user and their organisation (any status).
    [Authorize(Policy = Policies.SignedIn)]
    [HttpGet("me")]
    public async Task<ActionResult<MeDto>> Me()
    {
        // No Where on the organisation: the tenant filter already limits both to the user's own.
        var user = await db.Users.Include(u => u.Organization).FirstOrDefaultAsync(u => u.Id == me.UserId);
        if (user?.Organization is null) return Unauthorized();
        return ToMe(user, user.Organization);
    }

    private AuthResponseDto Respond(User user, Organization org)
    {
        var (token, expiresAt) = tokens.Create(user, org);
        return new AuthResponseDto(token, expiresAt, ToMe(user, org));
    }

    private static MeDto ToMe(User user, Organization org) => new(
        new MeUserDto(user.Id, user.FullName, user.Email, user.Role),
        new MeOrganizationDto(org.Id, org.Name, org.Type, org.Status, org.ReviewNote));

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
