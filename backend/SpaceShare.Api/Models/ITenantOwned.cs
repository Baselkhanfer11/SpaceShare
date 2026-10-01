namespace SpaceShare.Api.Models;

/// <summary>
/// Marks a record that belongs to one organisation. AppDbContext gives every
/// ITenantOwned entity a query filter, so queries only ever return the signed-in
/// user's own organisation's rows — without anyone remembering a Where.
/// </summary>
public interface ITenantOwned
{
    int OrganizationId { get; set; }
}
