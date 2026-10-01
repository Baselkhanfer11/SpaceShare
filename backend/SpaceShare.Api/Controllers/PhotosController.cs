using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpaceShare.Api.Services;

namespace SpaceShare.Api.Controllers;

/// <summary>
/// Serves warehouse photos. Open to everyone, because an &lt;img&gt; tag can't
/// send a sign-in token — and listing photos are meant to be seen. The names
/// are random (32 hex characters), so a photo can't be found without its link.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/photos")]
public class PhotosController(PhotoStorage photos) : ControllerBase
{
    // GET /api/photos/3f2b…9c.jpg
    [HttpGet("{name}")]
    public IActionResult Get(string name)
    {
        var stream = photos.Open(name);
        if (stream is null) return NotFound();

        // A name is never reused, so browsers may keep the photo for good.
        Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        return File(stream, PhotoStorage.ContentTypeOf(name));
    }
}
