using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SpaceShare.Api.Auth;
using SpaceShare.Api.Data;
using SpaceShare.Api.Dtos;
using SpaceShare.Api.Models;
using SpaceShare.Api.Services;

namespace SpaceShare.Api.Controllers;

/// <summary>
/// A warehouse business manages its own listings: details, photos and space
/// offers, then submits them for review. Owners change things; staff can look.
/// Like the team, there's no "Where OrganizationId == …": the tenant filter
/// means another provider's warehouses simply aren't found here.
/// </summary>
[ApiController]
[Authorize(Roles = Roles.Providers)]
[Route("api/warehouses")]
public class WarehousesController(AppDbContext db, PhotoStorage photos, CurrentUser me) : ControllerBase
{
    public const int MaxPhotos = 10;

    // GET /api/warehouses → my warehouses, most recently changed first
    [HttpGet]
    public async Task<ActionResult<IEnumerable<WarehouseSummaryDto>>> List()
    {
        var rows = await db.Warehouses.AsNoTracking()
            .OrderByDescending(w => w.UpdatedAt)
            .Select(w => new
            {
                w.Id, w.Name, w.City, w.Status, w.UpdatedAt,
                Cover = w.Photos.OrderBy(p => p.SortOrder).ThenBy(p => p.Id).Select(p => p.StoredName).FirstOrDefault(),
                PhotoCount = w.Photos.Count,
                ActiveOffers = w.Offers.Count(o => o.IsActive),
            })
            .ToListAsync();

        return Ok(rows.Select(r => new WarehouseSummaryDto(
            r.Id, r.Name, r.City, r.Status, WarehouseMap.PhotoUrl(r.Cover), r.PhotoCount, r.ActiveOffers, r.UpdatedAt)));
    }

    // GET /api/warehouses/5 → one of my warehouses in full
    [HttpGet("{id:int}")]
    public async Task<ActionResult<WarehouseDetailDto>> Get(int id) =>
        await Detail(id) is { } detail ? detail : NotFound();

    // POST /api/warehouses → a new draft listing
    [Authorize(Roles = Roles.ProviderOwner)]
    [HttpPost]
    public async Task<ActionResult<WarehouseDetailDto>> Create(WarehouseInputDto input)
    {
        if (Problem(input) is string problem) return BadRequest(new { message = problem });

        var warehouse = new Warehouse { OrganizationId = me.OrganizationId!.Value };
        Apply(warehouse, input);
        db.Warehouses.Add(warehouse);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(Get), new { id = warehouse.Id }, await Detail(warehouse.Id));
    }

    // PUT /api/warehouses/5 → change the details. An approved listing stays live.
    [Authorize(Roles = Roles.ProviderOwner)]
    [HttpPut("{id:int}")]
    public async Task<ActionResult<WarehouseDetailDto>> Update(int id, WarehouseInputDto input)
    {
        var warehouse = await db.Warehouses.FirstOrDefaultAsync(w => w.Id == id);
        if (warehouse is null) return NotFound();
        if (Problem(input) is string problem) return BadRequest(new { message = problem });

        Apply(warehouse, input);
        await db.SaveChangesAsync();
        return (await Detail(id))!;
    }

    // DELETE /api/warehouses/5 → only a draft or rejected listing (nothing booked yet)
    [Authorize(Roles = Roles.ProviderOwner)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var warehouse = await db.Warehouses.Include(w => w.Photos).FirstOrDefaultAsync(w => w.Id == id);
        if (warehouse is null) return NotFound();
        if (warehouse.Status is WarehouseStatuses.Pending or WarehouseStatuses.Approved)
            return Conflict(new { message = "Only a draft or rejected listing can be deleted." });

        var files = warehouse.Photos.Select(p => p.StoredName).ToList();
        db.Warehouses.Remove(warehouse); // offers and photo rows go with it
        await db.SaveChangesAsync();
        foreach (var file in files) photos.Delete(file);
        return NoContent();
    }

    // POST /api/warehouses/5/submit → send a draft (or a fixed rejected listing) for review
    [Authorize(Roles = Roles.ProviderOwner)]
    [HttpPost("{id:int}/submit")]
    public async Task<IActionResult> Submit(int id)
    {
        var warehouse = await db.Warehouses.Include(w => w.Photos).Include(w => w.Offers).FirstOrDefaultAsync(w => w.Id == id);
        if (warehouse is null) return NotFound();
        if (warehouse.Status is not (WarehouseStatuses.Draft or WarehouseStatuses.Rejected))
            return Conflict(new { message = $"This listing is already {warehouse.Status}." });

        // Businesses decide from the photos and the prices, so both are required.
        if (warehouse.Photos.Count == 0)
            return BadRequest(new { message = "Add at least one photo before submitting." });
        if (!warehouse.Offers.Any(o => o.IsActive))
            return BadRequest(new { message = "Add at least one active space offer before submitting." });

        warehouse.Status = WarehouseStatuses.Pending;
        warehouse.SubmittedAt = DateTime.UtcNow;
        warehouse.ReviewNote = null;
        Touch(warehouse);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---- space offers ----

    // POST /api/warehouses/5/offers
    [Authorize(Roles = Roles.ProviderOwner)]
    [HttpPost("{id:int}/offers")]
    public async Task<ActionResult<SpaceOfferDto>> AddOffer(int id, SpaceOfferInputDto input)
    {
        var warehouse = await db.Warehouses.FirstOrDefaultAsync(w => w.Id == id);
        if (warehouse is null) return NotFound();
        if (OfferProblem(input) is string problem) return BadRequest(new { message = problem });

        var offer = new SpaceOffer { WarehouseId = id, OrganizationId = warehouse.OrganizationId };
        ApplyOffer(offer, input);
        db.SpaceOffers.Add(offer);
        Touch(warehouse);
        await db.SaveChangesAsync();
        return WarehouseMap.ToDto(offer);
    }

    // PUT /api/warehouses/5/offers/7
    [Authorize(Roles = Roles.ProviderOwner)]
    [HttpPut("{id:int}/offers/{offerId:int}")]
    public async Task<ActionResult<SpaceOfferDto>> UpdateOffer(int id, int offerId, SpaceOfferInputDto input)
    {
        var offer = await db.SpaceOffers.Include(o => o.Warehouse).FirstOrDefaultAsync(o => o.Id == offerId && o.WarehouseId == id);
        if (offer is null) return NotFound();
        if (OfferProblem(input) is string problem) return BadRequest(new { message = problem });

        ApplyOffer(offer, input);
        Touch(offer.Warehouse!);
        await db.SaveChangesAsync();
        return WarehouseMap.ToDto(offer);
    }

    // DELETE /api/warehouses/5/offers/7
    [Authorize(Roles = Roles.ProviderOwner)]
    [HttpDelete("{id:int}/offers/{offerId:int}")]
    public async Task<IActionResult> DeleteOffer(int id, int offerId)
    {
        var offer = await db.SpaceOffers.Include(o => o.Warehouse).FirstOrDefaultAsync(o => o.Id == offerId && o.WarehouseId == id);
        if (offer is null) return NotFound();

        db.SpaceOffers.Remove(offer);
        Touch(offer.Warehouse!);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---- photos ----

    // POST /api/warehouses/5/photos   (multipart form, field "file")
    [Authorize(Roles = Roles.ProviderOwner)]
    [HttpPost("{id:int}/photos")]
    [RequestSizeLimit(PhotoStorage.MaxBytes + 64 * 1024)]
    public async Task<ActionResult<PhotoDto>> AddPhoto(int id, IFormFile? file)
    {
        var warehouse = await db.Warehouses.Include(w => w.Photos).FirstOrDefaultAsync(w => w.Id == id);
        if (warehouse is null) return NotFound();
        if (warehouse.Photos.Count >= MaxPhotos)
            return Conflict(new { message = $"A listing can have at most {MaxPhotos} photos." });
        if (await PhotoStorage.Problem(file) is string problem) return BadRequest(new { message = problem });

        var storedName = await photos.Save(file!);
        var photo = new WarehousePhoto
        {
            WarehouseId = id,
            OrganizationId = warehouse.OrganizationId,
            StoredName = storedName,
            ContentType = file!.ContentType,
            SizeBytes = file.Length,
            SortOrder = warehouse.Photos.Count == 0 ? 0 : warehouse.Photos.Max(p => p.SortOrder) + 1,
        };
        db.WarehousePhotos.Add(photo);
        Touch(warehouse);
        try { await db.SaveChangesAsync(); }
        catch { photos.Delete(storedName); throw; } // don't leave a file nobody points to

        return new PhotoDto(photo.Id, WarehouseMap.PhotoUrl(storedName)!);
    }

    // DELETE /api/warehouses/5/photos/9
    [Authorize(Roles = Roles.ProviderOwner)]
    [HttpDelete("{id:int}/photos/{photoId:int}")]
    public async Task<IActionResult> DeletePhoto(int id, int photoId)
    {
        var photo = await db.WarehousePhotos.Include(p => p.Warehouse).FirstOrDefaultAsync(p => p.Id == photoId && p.WarehouseId == id);
        if (photo is null) return NotFound();

        db.WarehousePhotos.Remove(photo);
        Touch(photo.Warehouse!);
        await db.SaveChangesAsync();
        photos.Delete(photo.StoredName);
        return NoContent();
    }

    // POST /api/warehouses/5/photos/9/cover → show this photo first
    [Authorize(Roles = Roles.ProviderOwner)]
    [HttpPost("{id:int}/photos/{photoId:int}/cover")]
    public async Task<IActionResult> MakeCover(int id, int photoId)
    {
        var warehouse = await db.Warehouses.Include(w => w.Photos).FirstOrDefaultAsync(w => w.Id == id);
        var photo = warehouse?.Photos.FirstOrDefault(p => p.Id == photoId);
        if (warehouse is null || photo is null) return NotFound();

        photo.SortOrder = warehouse.Photos.Min(p => p.SortOrder) - 1;
        Touch(warehouse);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---- helpers ----

    private async Task<WarehouseDetailDto?> Detail(int id)
    {
        var warehouse = await db.Warehouses.AsNoTracking()
            .Include(w => w.Organization).Include(w => w.Photos).Include(w => w.Offers)
            .FirstOrDefaultAsync(w => w.Id == id);
        return warehouse is null ? null : WarehouseMap.ToDetail(warehouse);
    }

    private static string? Problem(WarehouseInputDto input)
    {
        if (string.IsNullOrWhiteSpace(input.Name)) return "The warehouse name is required.";
        if (string.IsNullOrWhiteSpace(input.City)) return "The city is required.";
        if (string.IsNullOrWhiteSpace(input.Address)) return "The address is required.";
        if (input.Name.Trim().Length > 200 || input.City.Trim().Length > 100 || input.Address.Trim().Length > 300)
            return "The name, city or address is too long.";
        if (input.Description?.Length > 2000) return "The description can be at most 2000 characters.";
        if (input.OpeningHours?.Length > 200) return "The opening hours can be at most 200 characters.";
        if (input.Features?.FirstOrDefault(f => !WarehouseFeatures.IsValid(f)) is string bad)
            return $"Feature '{bad}' is not valid.";
        return null;
    }

    private static void Apply(Warehouse w, WarehouseInputDto input)
    {
        w.Name = input.Name.Trim();
        w.City = input.City.Trim();
        w.Address = input.Address.Trim();
        w.Description = Clean(input.Description);
        w.OpeningHours = Clean(input.OpeningHours);
        // Always the same order, whatever order they were ticked in.
        w.Features = WarehouseFeatures.All.Where(f => input.Features?.Contains(f) == true).ToList();
        Touch(w);
    }

    private static string? OfferProblem(SpaceOfferInputDto input)
    {
        if (!SpaceUnits.IsValid(input.UnitType)) return $"Unit '{input.UnitType}' is not valid.";
        if (!Temperatures.IsValid(input.Temperature)) return $"Temperature '{input.Temperature}' is not valid.";
        if (input.Capacity is < 1 or > 1_000_000) return "The capacity must be between 1 and 1,000,000.";
        if (input.PricePerWeek is <= 0 or > 100_000) return "The weekly price must be more than 0.";
        if (decimal.Round(input.PricePerWeek, 2) != input.PricePerWeek) return "The price can have at most 2 decimals.";
        if (input.MinWeeks is < 1 or > 104) return "The minimum stay must be between 1 and 104 weeks.";
        if (input.Notes?.Length > 500) return "The notes can be at most 500 characters.";
        return null;
    }

    private static void ApplyOffer(SpaceOffer offer, SpaceOfferInputDto input)
    {
        offer.UnitType = input.UnitType;
        offer.Temperature = input.Temperature;
        offer.Capacity = input.Capacity;
        offer.PricePerWeek = input.PricePerWeek;
        offer.MinWeeks = input.MinWeeks;
        offer.IsActive = input.IsActive;
        offer.Notes = Clean(input.Notes);
    }

    private static void Touch(Warehouse w) => w.UpdatedAt = DateTime.UtcNow;

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
