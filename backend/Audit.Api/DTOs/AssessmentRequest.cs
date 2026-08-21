namespace Audit.Api.DTOs;

public class AssessmentRequest
{
    public string UserId { get; set; } = "user_demo_1";
    public string SessionId { get; set; } = "sess_demo_abc123";
    public string AssessmentId { get; set; } = "assess_net_10";
    public int Score { get; set; } = 85;
    public bool Passed { get; set; } = true;
}
