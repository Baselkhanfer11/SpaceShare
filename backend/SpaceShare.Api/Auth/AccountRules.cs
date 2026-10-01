using System.Net.Mail;

namespace SpaceShare.Api.Auth;

/// <summary>The rules for emails and passwords, shared by sign-up and adding a team member.</summary>
public static class AccountRules
{
    public const int MinPasswordLength = 8;

    /// <summary>Emails are compared trimmed and lower-case.</summary>
    public static string NormalizeEmail(string? email) => (email ?? string.Empty).Trim().ToLowerInvariant();

    public static bool IsValidEmail(string email) =>
        email.Length <= 256 && MailAddress.TryCreate(email, out var parsed) && parsed.Address == email;

    /// <summary>Why this password isn't allowed, or null when it's fine.</summary>
    public static string? PasswordProblem(string? password) =>
        string.IsNullOrEmpty(password) || password.Length < MinPasswordLength
            ? $"The password must be at least {MinPasswordLength} characters."
            : null;
}
