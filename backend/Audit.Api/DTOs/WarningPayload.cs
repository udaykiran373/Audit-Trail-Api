namespace Audit.Api.DTOs;

/// <summary>
/// Data Transfer Object for live proctoring warnings.
/// </summary>
public class WarningPayload
{
    public string WarningType { get; set; } = string.Empty;
    public string VideoTimestamp { get; set; } = string.Empty;
}
