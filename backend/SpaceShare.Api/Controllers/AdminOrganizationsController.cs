using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SpaceShare.Api.Auth;
using SpaceShare.Api.Data;
using SpaceShare.Api.Dtos;
using SpaceShare.Api.Models;

namespace SpaceShare.Api.Controllers;

/// <summary>
/// The platform admin reviews organisations: approve new sign-ups, reject them,
/// suspend an active one or bring it back. This is the one place that looks
/// across organisations, so every query here uses IgnoreQueryFilters() — and
/// only the PlatformAdmin role can reach it.
/// </summary>
[ApiController]
[Authorize(Roles = Roles.PlatformAdmin)]
[Route("api/admin/organizations")]
public class AdminOrganizationsController(AppDbContext db, CurrentUser me) : ControllerBase
{
    // GET /api/admin/organizations?status=Pending → organisations, newest first (all statuses when none given)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AdminOrganizationDto>>> List([FromQuery] string? status)
    {
        if (status is not null && !OrganizationStatuses.IsValid(status))
            return BadRequest(new { message = $"Status '{status}' is not valid." });

        var query = db.Organizations.IgnoreQueryFilters().Where(o => o.Type != OrganizationTypes.Platform);
        if (status is not null) query = query.Where(o => o.Status == status);

        var rows = await query
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new
            {
                Org = o,
                // The first owner = whoever signed the organisation up.
                Owner = o.Users
                    .Where(u => u.Role == Roles.ProviderOwner || u.Role == Roles.ClientOwner)
                    .OrderBy(u => u.Id)
                    .Select(u => new { u.FullName, u.Email })
                    .FirstOrDefault(),
                UserCount = o.Users.Count,
            })
            .AsNoTracking()
            .ToListAsync();

        return Ok(rows.Select(r => new AdminOrganizationDto(
            r.Org.Id, r.Org.Name, r.Org.Type, r.Org.Status, r.Org.City, r.Org.Phone, r.Org.CreatedAt,
            r.Owner?.FullName, r.Owner?.Email, r.UserCount, r.Org.ReviewedAt, r.Org.ReviewNote)));
    }

    // POST /api/admin/organizations/5/approve   Pending → Active
    [HttpPost("{id:int}/approve")]
    public Task<IActionResult> Approve(int id, ReviewNoteDto? input) =>
        Review(id, OrganizationStatuses.Pending, OrganizationStatuses.Active, input?.Note, noteRequired: false);

    // POST /api/admin/organizations/5/reject   Pending → Rejected (a reason is required)
    [HttpPost("{id:int}/reject")]
    public Task<IActionResult> Reject(int id, ReviewNoteDto input) =>
        Review(id, OrganizationStatuses.Pending, OrganizationStatuses.Rejected, input.Note, noteRequired: true);

    // POST /api/admin/organizations/5/suspend   Active → Suspended (a reason is required)
    [HttpPost("{id:int}/suspend")]
    public Task<IActionResult> Suspend(int id, ReviewNoteDto input) =>
        Review(id, OrganizationStatuses.Active, OrganizationStatuses.Suspended, input.Note, noteRequired: true);

    // POST /api/admin/organizations/5/reactivate   Suspended → Active
    [HttpPost("{id:int}/reactivate")]
    public Task<IActionResult> Reactivate(int id, ReviewNoteDto? input) =>
        Review(id, OrganizationStatuses.Suspended, OrganizationStatuses.Active, input?.Note, noteRequired: false);

    // Moves an organisation from one status to the next, recording who decided and why.
    private async Task<IActionResult> Review(int id, string from, string to, string? note, bool noteRequired)
    {
        note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        if (noteRequired && note is null)
            return BadRequest(new { message = "Give a reason — the organisation will see it." });

        var org = await db.Organizations.IgnoreQueryFilters()
            .FirstOrDefaultAsync(o => o.Id == id && o.Type != OrganizationTypes.Platform);
        if (org is null) return NotFound();
        if (org.Status != from)
            return Conflict(new { message = $"This organisation is {org.Status}, not {from}." });

        org.Status = to;
        org.ReviewNote = note;
        org.ReviewedAt = DateTime.UtcNow;
        org.ReviewedById = me.UserId;
        await db.SaveChangesAsync();
        return NoContent();
    }
}
