using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SpaceShare.Api.Data;
using SpaceShare.Api.Dtos;
using SpaceShare.Api.Models;

namespace SpaceShare.Api.Controllers;

/// <summary>
/// The marketplace: businesses find warehouse space. This is the one place
/// ordinary users see other organisations' data, so it skips the tenant filter
/// on purpose — and shows ONLY approved listings of active providers, and only
/// their active offers. Never drafts, pending or rejected listings.
/// </summary>
[ApiController]
[Authorize]
[Route("api/search")]
public class SearchController(AppDbContext db) : ControllerBase
{
    // Everything search may ever show starts here.
    private IQueryable<Warehouse> Live() => db.Warehouses.IgnoreQueryFilters().AsNoTracking()
        .Where(w => w.Status == WarehouseStatuses.Approved && w.Organization!.Status == OrganizationStatuses.Active);

    // GET /api/search/warehouses?city=Amman&unitType=Pallet&temperature=Chilled&maxPrice=5&minUnits=20
    // → listings with at least one active offer that fits every filter given, cheapest first.
    [HttpGet("warehouses")]
    public async Task<ActionResult<IEnumerable<SearchResultDto>>> Search(
        [FromQuery] string? city, [FromQuery] string? unitType, [FromQuery] string? temperature,
        [FromQuery] decimal? maxPrice, [FromQuery] int? minUnits)
    {
        if (unitType is not null && !SpaceUnits.IsValid(unitType))
            return BadRequest(new { message = $"Unit '{unitType}' is not valid." });
        if (temperature is not null && !Temperatures.IsValid(temperature))
            return BadRequest(new { message = $"Temperature '{temperature}' is not valid." });

        var query = Live();
        if (!string.IsNullOrWhiteSpace(city)) query = query.Where(w => w.City == city.Trim());

        var warehouses = await query
            .Include(w => w.Organization)
            .Include(w => w.Photos)
            .Include(w => w.Offers.Where(o => o.IsActive))
            .ToListAsync();

        // Offer filters run here, after loading: prices are decimals, which some
        // databases can't compare reliably, and an MVP city has few listings.
        bool Fits(SpaceOffer o) =>
            (unitType is null || o.UnitType == unitType) &&
            (temperature is null || o.Temperature == temperature) &&
            (maxPrice is null || o.PricePerWeek <= maxPrice) &&
            (minUnits is null || o.Capacity >= minUnits);

        var results = warehouses
            .Select(w => new { w, Matches = w.Offers.Where(Fits).OrderBy(o => o.PricePerWeek).ToList() })
            .Where(x => x.Matches.Count > 0)
            .OrderBy(x => x.Matches[0].PricePerWeek).ThenBy(x => x.w.Name)
            .Select(x => new SearchResultDto(
                x.w.Id, x.w.Name, x.w.City, x.w.Organization!.Name, WarehouseMap.CoverUrl(x.w), x.w.Features,
                x.Matches.Select(WarehouseMap.ToDto).ToList()));

        return Ok(results);
    }

    // GET /api/search/cities → the cities that have live listings (for the filter)
    [HttpGet("cities")]
    public async Task<ActionResult<IEnumerable<string>>> Cities() =>
        await Live().Select(w => w.City).Distinct().OrderBy(c => c).ToListAsync();

    // GET /api/search/warehouses/5 → one live listing in full (404 for anything not live)
    [HttpGet("warehouses/{id:int}")]
    public async Task<ActionResult<WarehouseDetailDto>> Get(int id)
    {
        var warehouse = await Live()
            .Include(w => w.Organization)
            .Include(w => w.Photos)
            .Include(w => w.Offers.Where(o => o.IsActive))
            .FirstOrDefaultAsync(w => w.Id == id);
        return warehouse is null ? NotFound() : WarehouseMap.ToDetail(warehouse);
    }
}
