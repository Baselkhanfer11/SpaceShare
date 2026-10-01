using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SpaceShare.Api.Data;
using SpaceShare.Api.Dtos;

namespace SpaceShare.Api.Tests;

/// <summary>
/// Runs the real API in memory, on a throwaway SQLite database, with a test
/// admin and signing key. Shared by the tests in a class, so every test uses
/// its own unique names and emails.
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>
{
    // Test-only values: they exist only inside this in-memory test run.
    public const string AdminEmail = "admin@test.local";
    public const string AdminPassword = "test-admin-password";
    public const string Password = "test-password-123";

    private readonly SqliteConnection _connection = new("DataSource=:memory:");

    // Uploaded photos go to a throwaway folder, removed when the tests finish.
    private readonly string _photos = Path.Combine(Path.GetTempPath(), $"spaceshare-test-photos-{Guid.NewGuid():N}");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        _connection.Open(); // the in-memory database lives as long as this connection

        builder.UseEnvironment("Testing");
        builder.UseSetting("Database:Setup", "EnsureCreated");
        builder.UseSetting("Jwt:Key", "test-signing-key-that-is-long-enough-0123456789");
        builder.UseSetting("Seed:AdminEmail", AdminEmail);
        builder.UseSetting("Seed:AdminPassword", AdminPassword);
        builder.UseSetting("Storage:PhotosPath", _photos);

        builder.ConfigureServices(services =>
        {
            // Swap SQL Server for SQLite.
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<AppDbContext>>();
            services.AddDbContext<AppDbContext>(options => options
                .UseSqlite(_connection)
                .ConfigureWarnings(w => w.Ignore(CoreEventId.PossibleIncorrectRequiredNavigationWithQueryFilterInteractionWarning)));
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            _connection.Dispose();
            if (Directory.Exists(_photos)) Directory.Delete(_photos, recursive: true);
        }
    }

    // ---- helpers for the tests ----

    /// <summary>A unique email, so tests sharing the database never collide.</summary>
    public static string NewEmail(string who) => $"{who}-{Guid.NewGuid():N}@test.local";

    /// <summary>A client that sends this token on every request.</summary>
    public HttpClient ClientWith(string token)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>Signs up a new organisation; returns its owner's client and the sign-up answer.</summary>
    public async Task<(HttpClient Client, AuthResponseDto Auth)> SignUp(string type, string name)
    {
        var response = await CreateClient().PostAsJsonAsync("/api/auth/register", new RegisterDto(
            type, name, "Amman", null, $"{name} Owner", NewEmail("owner"), Password));
        response.EnsureSuccessStatusCode();
        var auth = (await response.Content.ReadFromJsonAsync<AuthResponseDto>())!;
        return (ClientWith(auth.Token), auth);
    }

    /// <summary>Signs in; returns the answer (or throws if it failed).</summary>
    public async Task<AuthResponseDto> SignIn(string email, string password)
    {
        var response = await CreateClient().PostAsJsonAsync("/api/auth/login", new LoginDto(email, password));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<AuthResponseDto>())!;
    }

    public async Task<HttpClient> Admin() => ClientWith((await SignIn(AdminEmail, AdminPassword)).Token);

    /// <summary>Signs up an organisation and has the admin approve it.</summary>
    public async Task<(HttpClient Client, AuthResponseDto Auth)> ApprovedOrg(string type, string name)
    {
        var org = await SignUp(type, name);
        var admin = await Admin();
        (await admin.PostAsJsonAsync($"/api/admin/organizations/{org.Auth.Me.Organization.Id}/approve", new ReviewNoteDto(null)))
            .EnsureSuccessStatusCode();
        return org;
    }
}
