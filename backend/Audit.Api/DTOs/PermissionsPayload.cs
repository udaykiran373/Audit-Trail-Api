namespace Audit.Api.DTOs;

/// <summary>
/// Data Transfer Object for hardware permission states.
/// </summary>
public class PermissionsPayload
{
    public bool Granted { get; set; }
    public bool CameraGranted { get; set; }
    public bool MicrophoneGranted { get; set; }
}
