namespace SpaceShare.Api.Services;

/// <summary>
/// Saves warehouse photos and reads them back. For the MVP they live on the
/// server's disk (Storage/photos, or "Storage:PhotosPath" in config); moving to
/// cloud blob storage later only means replacing this class.
/// </summary>
public class PhotoStorage
{
    public const long MaxBytes = 5 * 1024 * 1024; // 5 MB a photo

    // The image types we accept, by content type, with the file extension we save them as.
    private static readonly Dictionary<string, string> Extensions = new()
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp",
    };

    private readonly string _root;

    public PhotoStorage(IConfiguration config, IWebHostEnvironment env)
    {
        _root = config["Storage:PhotosPath"] is { Length: > 0 } path
            ? path
            : Path.Combine(env.ContentRootPath, "Storage", "photos");
        Directory.CreateDirectory(_root);
    }

    /// <summary>Why this upload isn't accepted, or null when it's a real JPEG / PNG / WebP under 5 MB.</summary>
    public static async Task<string?> Problem(IFormFile? file)
    {
        if (file is null || file.Length == 0) return "Choose a photo to upload.";
        if (file.Length > MaxBytes) return "Photos must be 5 MB or smaller.";
        if (!Extensions.ContainsKey(file.ContentType)) return "Only JPEG, PNG or WebP photos are accepted.";

        // Check the file really is that kind of image (not just named like one).
        var head = new byte[12];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAtLeastAsync(head, head.Length, throwOnEndOfStream: false);
        return LooksLike(file.ContentType, head.AsSpan(0, read)) ? null : "That file isn't a valid image.";
    }

    /// <summary>Saves the photo under a new random name and returns that name.</summary>
    public async Task<string> Save(IFormFile file)
    {
        var name = $"{Guid.NewGuid():N}{Extensions[file.ContentType]}";
        await using var target = File.Create(Path.Combine(_root, name));
        await file.CopyToAsync(target);
        return name;
    }

    /// <summary>Opens a stored photo for reading, or null if it's missing or the name looks wrong.</summary>
    public Stream? Open(string storedName)
    {
        if (!IsSafeName(storedName)) return null;
        var path = Path.Combine(_root, storedName);
        return File.Exists(path) ? File.OpenRead(path) : null;
    }

    public void Delete(string storedName)
    {
        if (!IsSafeName(storedName)) return;
        var path = Path.Combine(_root, storedName);
        if (File.Exists(path)) File.Delete(path);
    }

    public static string ContentTypeOf(string storedName) =>
        Extensions.FirstOrDefault(e => storedName.EndsWith(e.Value, StringComparison.OrdinalIgnoreCase)).Key
        ?? "application/octet-stream";

    // Only names we created: 32 hex characters + a known extension (so "../" can't escape the folder).
    private static bool IsSafeName(string name)
    {
        var dot = name.IndexOf('.');
        return dot == 32
            && name[..dot].All(Uri.IsHexDigit)
            && Extensions.ContainsValue(name[dot..]);
    }

    // The first bytes ("magic numbers") every file of that type starts with.
    private static bool LooksLike(string contentType, ReadOnlySpan<byte> head) => contentType switch
    {
        "image/jpeg" => head.Length >= 3 && head[0] == 0xFF && head[1] == 0xD8 && head[2] == 0xFF,
        "image/png" => head.Length >= 8 && head[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }),
        "image/webp" => head.Length >= 12 && head[..4].SequenceEqual("RIFF"u8) && head[8..12].SequenceEqual("WEBP"u8),
        _ => false,
    };
}
