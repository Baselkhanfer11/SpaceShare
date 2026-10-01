namespace SpaceShare.Api.Dtos;

public record TeamMemberDto(
    int Id,
    string FullName,
    string Email,
    string Role,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? LastLoginAt);

// An owner adds a colleague with a starting password (to hand over in person).
public record TeamMemberInputDto(string FullName, string Email, string Role, string Password);

public record TeamMemberUpdateDto(string Role, bool IsActive);
