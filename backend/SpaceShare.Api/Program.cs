using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.IdentityModel.Tokens;
using SpaceShare.Api.Auth;
using SpaceShare.Api.Data;
using SpaceShare.Api.Json;
using SpaceShare.Api.Models;

var builder = WebApplication.CreateBuilder(args);

// ---- Who is signed in (and so which organisation's data they may see) ----
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<CurrentUser>();
builder.Services.AddScoped<ITenantProvider>(sp => sp.GetRequiredService<CurrentUser>());

// ---- Database (EF Core + SQL Server) ----
builder.Services.AddDbContext<AppDbContext>(options => options
    .UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"))
    // A user's organisation is filtered by the same tenant as the user, so
    // EF's warning about a filtered required navigation doesn't apply here.
    .ConfigureWarnings(w => w.Ignore(CoreEventId.PossibleIncorrectRequiredNavigationWithQueryFilterInteractionWarning)));

// ---- Sign-in ----
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
// Read the token settings when they're first needed (not now), so tests and
// user-secrets can supply them.
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IConfiguration>((options, config) =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = config["Jwt:Issuer"],
            ValidAudience = config["Jwt:Audience"],
            IssuerSigningKey = JwtTokenService.SigningKey(config),
        };
    });

// ---- Permissions ----
builder.Services.AddScoped<IAuthorizationHandler, ActiveAccountHandler>();
builder.Services.AddAuthorization(options =>
{
    // Every plain [Authorize] means: signed in, still active, and the
    // organisation is approved. Safe by default for every new endpoint.
    options.DefaultPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .AddRequirements(new ActiveAccountRequirement())
        .Build();
    options.AddPolicy(Policies.SignedIn, p => p.RequireAuthenticatedUser());
});

builder.Services
    .AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new UtcDateTimeConverter()));
// OpenAPI description of the API (served at /openapi/v1.json in Development).
builder.Services.AddOpenApi();

var app = builder.Build();

// Fail at startup (not at the first sign-in) if the signing key is missing.
JwtTokenService.SigningKey(app.Configuration);

// ---- Create / update the database, then make sure the platform admin exists ----
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    // "Migrate" normally; the tests use "EnsureCreated" on a throwaway database.
    if (app.Configuration["Database:Setup"] == "EnsureCreated") db.Database.EnsureCreated();
    else db.Database.Migrate();
    await DbSeeder.SeedAsync(scope.ServiceProvider);
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthentication(); // who are you? (reads the token)
app.UseAuthorization();  // are you allowed? (roles + active account)

app.MapControllers();

app.Run();

// Lets the test project start the app (WebApplicationFactory<Program>).
public partial class Program;
