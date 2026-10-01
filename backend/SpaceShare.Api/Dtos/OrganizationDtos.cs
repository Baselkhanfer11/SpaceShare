namespace SpaceShare.Api.Dtos;

// One organisation as the platform admin sees it in the review list.
public record AdminOrganizationDto(
    int Id,
    string Name,
    string Type,
    string Status,
    string? City,
    string? Phone,
    DateTime CreatedAt,
    string? OwnerName,
    string? OwnerEmail,
    int UserCount,
    DateTime? ReviewedAt,
    string? ReviewNote);

// A reason for the decision — required to reject or suspend, shown to the organisation.
public record ReviewNoteDto(string? Note);
