using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SpaceShare.Api.Auth;
using SpaceShare.Api.Data;
using SpaceShare.Api.Dtos;
using SpaceShare.Api.Models;

namespace SpaceShare.Api.Controllers;

/// <summary>
/// The platform admin reviews listings before they go live, and can take a live
/// one down. Looks across organisations (IgnoreQueryFilters), PlatformAdmin only.
/// Drafts are the owner's private work, so the admin never sees them.
/// </summary>
[ApiController]
[Authorize(Roles = Roles.PlatformAdmin)]
[Route("api/admin/warehouses")]
public class AdminWarehousesController(AppDbContext db, CurrentUser me) : ControllerBase
{
    private IQueryable<Warehouse> Reviewable() =>
        db.Warehouses.IgnoreQueryFilters().Where(w => w.Status != WarehouseStatuses.Draft);

    // GET /api/admin/warehouses?status=Pending → listings, the longest-waiting first
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AdminWarehouseDto>>> List([FromQuery] string? status)
    {
        if (status is not null && !WarehouseStatuses.IsValid(status))
            return BadRequest(new { message = $"Status '{status}' is not valid." });

        var query = Reviewable();
        if (status is not null) query = query.Where(w => w.Status == status);

        var rows = await query.AsNoTracking()
            .OrderBy(w => w.SubmittedAt)
            .Select(w => new
            {
                w.Id, w.Name, w.City, w.Status, w.SubmittedAt, w.ReviewNote,
                Provider = w.Organization!.Name,
                Cover = w.Photos.OrderBy(p => p.SortOrder).ThenBy(p => p.Id).Select(p => p.StoredName).FirstOrDefault(),
                PhotoCount = w.Photos.Count,
                ActiveOffers = w.Offers.Count(o => o.IsActive),
            })
            .ToListAsync();

        return Ok(rows.Select(r => new AdminWarehouseDto(
            r.Id, r.Name, r.City, r.Status, r.Provider, WarehouseMap.PhotoUrl(r.Cover),
            r.PhotoCount, r.ActiveOffers, r.SubmittedAt, r.ReviewNote)));
    }

    // GET /api/admin/warehouses/5 → the listing as it would appear
    [HttpGet("{id:int}")]
    public async Task<ActionResult<WarehouseDetailDto>> Get(int id)
    {
        var warehouse = await Reviewable().AsNoTracking()
            .Include(w => w.Organization).Include(w => w.Photos).Include(w => w.Offers)
            .FirstOrDefaultAsync(w => w.Id == id);
        return warehouse is null ? NotFound() : WarehouseMap.ToDetail(warehouse);
    }

    // POST /api/admin/warehouses/5/approve   Pending → Approved (live in search)
    [HttpPost("{id:int}/approve")]
    public async Task<IActionResult> Approve(int id)
    {
        var warehouse = await Reviewable().FirstOrDefaultAsync(w => w.Id == id);
        if (warehouse is null) return NotFound();
        if (warehouse.Status != WarehouseStatuses.Pending)
            return Conflict(new { message = $"This listing is {warehouse.Status}, not Pending." });

        Decide(warehouse, WarehouseStatuses.Approved, note: null);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/admin/warehouses/5/reject   Pending → Rejected, or take a live listing down (a reason is required)
    [HttpPost("{id:int}/reject")]
    public async Task<IActionResult> Reject(int id, ReviewNoteDto input)
    {
        var note = string.IsNullOrWhiteSpace(input.Note) ? null : input.Note.Trim();
        if (note is null) return BadRequest(new { message = "Give a reason — the owner will see it." });

        var warehouse = await Reviewable().FirstOrDefaultAsync(w => w.Id == id);
        if (warehouse is null) return NotFound();
        if (warehouse.Status is not (WarehouseStatuses.Pending or WarehouseStatuses.Approved))
            return Conflict(new { message = $"This listing is already {warehouse.Status}." });

        Decide(warehouse, WarehouseStatuses.Rejected, note);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private void Decide(Warehouse w, string status, string? note)
    {
        w.Status = status;
        w.ReviewNote = note;
        w.ReviewedAt = DateTime.UtcNow;
        w.ReviewedById = me.UserId;
    }
}
