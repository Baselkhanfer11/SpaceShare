using Microsoft.AspNetCore.Mvc;

namespace SpaceShare.Api.Controllers;

/// <summary>
/// A simple "is the API up?" check. The frontend calls it on startup.
/// </summary>
[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    // GET /api/health
    [HttpGet]
    public IActionResult Get() => Ok(new { status = "ok", time = DateTime.UtcNow });
}
