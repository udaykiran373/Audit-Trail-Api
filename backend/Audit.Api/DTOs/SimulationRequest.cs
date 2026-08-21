namespace Audit.Api.DTOs;

public class SimulationRequest
{
    public string UserId { get; set; } = "user_demo_1";
    public string SessionId { get; set; } = "sess_demo_abc123";
    public bool Success { get; set; } = true;
}
