namespace SpaceShare.Api.Dtos;

public record LoginDto(string Email, string Password);

// Sign-up creates an organisation (Provider or Client) and its owner in one go.
public record RegisterDto(
    string OrganizationType,
    string OrganizationName,
    string? City,
    string? Phone,
    string FullName,
    string Email,
    string Password);

public record MeUserDto(int Id, string FullName, string Email, string Role);

public record MeOrganizationDto(int Id, string Name, string Type, string Status, string? ReviewNote);

// "Who am I?" — the user and their organisation, including its approval status.
public record MeDto(MeUserDto User, MeOrganizationDto Organization);

public record AuthResponseDto(string Token, DateTime ExpiresAt, MeDto Me);
