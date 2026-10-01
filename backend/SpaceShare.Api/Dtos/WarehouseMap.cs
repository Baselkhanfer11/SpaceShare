using SpaceShare.Api.Models;

namespace SpaceShare.Api.Dtos;

/// <summary>Turns warehouses into the shapes the app shows (shared by owner, admin and search).</summary>
public static class WarehouseMap
{
    public static string? PhotoUrl(string? storedName) => storedName is null ? null : $"/api/photos/{storedName}";

    /// <summary>Photos in display order: the cover first.</summary>
    public static IEnumerable<WarehousePhoto> Ordered(IEnumerable<WarehousePhoto> photos) =>
        photos.OrderBy(p => p.SortOrder).ThenBy(p => p.Id);

    public static string? CoverUrl(Warehouse w) => PhotoUrl(Ordered(w.Photos).FirstOrDefault()?.StoredName);

    public static SpaceOfferDto ToDto(SpaceOffer o) =>
        new(o.Id, o.UnitType, o.Temperature, o.Capacity, o.PricePerWeek, o.MinWeeks, o.IsActive, o.Notes);

    /// <summary>Needs Photos, Offers and Organization loaded.</summary>
    public static WarehouseDetailDto ToDetail(Warehouse w) => new(
        w.Id, w.Name, w.City, w.Address, w.Description, w.OpeningHours, w.Features, w.Status, w.ReviewNote,
        w.SubmittedAt, w.Organization?.Name ?? "",
        Ordered(w.Photos).Select(p => new PhotoDto(p.Id, PhotoUrl(p.StoredName)!)).ToList(),
        w.Offers.OrderBy(o => o.UnitType).ThenBy(o => o.PricePerWeek).Select(ToDto).ToList());
}
