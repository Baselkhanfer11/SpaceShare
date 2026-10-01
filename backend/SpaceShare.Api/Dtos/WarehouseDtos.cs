namespace SpaceShare.Api.Dtos;

// ---- what the owner sends ----

public record WarehouseInputDto(
    string Name,
    string City,
    string Address,
    string? Description,
    string? OpeningHours,
    List<string>? Features);

public record SpaceOfferInputDto(
    string UnitType,
    string Temperature,
    int Capacity,
    decimal PricePerWeek,
    int MinWeeks,
    bool IsActive,
    string? Notes);

// ---- what the app shows ----

public record PhotoDto(int Id, string Url);

public record SpaceOfferDto(
    int Id,
    string UnitType,
    string Temperature,
    int Capacity,
    decimal PricePerWeek,
    int MinWeeks,
    bool IsActive,
    string? Notes);

// One of the owner's warehouses in their list.
public record WarehouseSummaryDto(
    int Id,
    string Name,
    string City,
    string Status,
    string? CoverUrl,
    int PhotoCount,
    int ActiveOfferCount,
    DateTime UpdatedAt);

// A warehouse in full — for its owner, the platform admin, and (approved only) searchers.
public record WarehouseDetailDto(
    int Id,
    string Name,
    string City,
    string Address,
    string? Description,
    string? OpeningHours,
    List<string> Features,
    string Status,
    string? ReviewNote,
    DateTime? SubmittedAt,
    string ProviderName,
    List<PhotoDto> Photos,
    List<SpaceOfferDto> Offers);

// A search result: the warehouse and the offers that match the filters.
public record SearchResultDto(
    int Id,
    string Name,
    string City,
    string ProviderName,
    string? CoverUrl,
    List<string> Features,
    List<SpaceOfferDto> Offers);

// A listing in the platform admin's review queue.
public record AdminWarehouseDto(
    int Id,
    string Name,
    string City,
    string Status,
    string ProviderName,
    string? CoverUrl,
    int PhotoCount,
    int ActiveOfferCount,
    DateTime? SubmittedAt,
    string? ReviewNote);
