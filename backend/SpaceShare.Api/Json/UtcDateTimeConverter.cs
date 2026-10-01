using System.Text.Json;
using System.Text.Json.Serialization;

namespace SpaceShare.Api.Json;

/// <summary>
/// Ensures every DateTime we send is tagged as UTC (with a trailing 'Z'). We
/// store all times as UTC, but SQL Server returns them with an "unspecified"
/// kind, so without this the browser would read them as local time.
/// </summary>
public class UtcDateTimeConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => reader.GetDateTime();

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
        => writer.WriteStringValue(DateTime.SpecifyKind(value, DateTimeKind.Utc).ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'"));
}
