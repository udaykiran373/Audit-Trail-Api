using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Supervisors;
using Audit.Api.Models;
using Audit.Api.DTOs;
using Audit.Api.Middleware;
using Microsoft.AspNetCore.Mvc;

namespace Audit.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SimulationController : ControllerBase
{
    private readonly IAuditLoggingSupervisor _loggingService;

    public SimulationController(IAuditLoggingSupervisor loggingService)
    {
        _loggingService = loggingService;
    }

    [HttpPost("login")]
    public async Task<IActionResult> SimulateLogin([FromBody] SimulationRequest request)
    {
        var correlationId = GetCorrelationId();
        var status = request.Success ? "SUCCESS" : "FAILED";
        var metadata = new Dictionary<string, object>
        {
            { "Method", "PasswordAuth" },
            { "Username", request.UserId }
        };

        if (!request.Success)
        {
            metadata["FailureReason"] = "Invalid credentials";
        }

        var log = CreateAuditLog(
            request.UserId,
            request.SessionId,
            "AUTHENTICATION",
            "Auth",
            "LOGIN",
            status,
            correlationId,
            metadata
        );

        await _loggingService.LogAsync(log);
        // Mark that this request has been audited by the controller
        HttpContext.Items["AuditLogWritten"] = true;

        if (!request.Success)
        {
            return BadRequest(new { Message = "Simulated login failed: Invalid credentials." });
        }

        return Ok(new { Message = "Simulated login successful.", UserId = request.UserId, SessionId = request.SessionId });
    }

    [HttpPost("interview/{actionName}")]
    public async Task<IActionResult> SimulateInterview(string actionName, [FromBody] SimulationRequest request)
    {
        var correlationId = GetCorrelationId();
        var action = actionName.ToUpperInvariant();

        var validActions = new HashSet<string> { "START", "PAUSE", "RESUME", "COMPLETE", "CANCEL" };
        if (!validActions.Contains(action))
        {
            return BadRequest(new { Message = $"Invalid interview action: {actionName}. Allowed actions are START, PAUSE, RESUME, COMPLETE, CANCEL." });
        }

        var metadata = new Dictionary<string, object>
        {
            { "InterviewId", Guid.NewGuid().ToString() },
            { "Position", "Senior Software Engineer" },
            { "TemplateId", "temp_dotnet_core_10" }
        };

        if (action == "PAUSE")
        {
            metadata["PauseReason"] = "User requested a short break";
            metadata["TimeElapsedSeconds"] = 184;
        }
        else if (action == "COMPLETE")
        {
            metadata["QuestionsAnswered"] = 8;
            metadata["TotalDurationSeconds"] = 1205;
        }
        else if (action == "CANCEL")
        {
            metadata["CancelReason"] = "User closed tab / abandoned session";
        }

        var log = CreateAuditLog(
            request.UserId,
            request.SessionId,
            "INTERVIEW",
            "Interview",
            $"{action}_INTERVIEW",
            "SUCCESS",
            correlationId,
            metadata
        );

        await _loggingService.LogAsync(log);
        // Mark that this request has been audited by the controller
        HttpContext.Items["AuditLogWritten"] = true;
        return Ok(new { Message = $"Interview action '{action}' logged successfully." });
    }

    [HttpPost("assessment")]
    public async Task<IActionResult> SimulateAssessment([FromBody] AssessmentRequest request)
    {
        var correlationId = GetCorrelationId();
        var metadata = new Dictionary<string, object>
        {
            { "AssessmentId", request.AssessmentId },
            { "Score", request.Score },
            { "Language", "C#" }
        };

        var log = CreateAuditLog(
            request.UserId,
            request.SessionId,
            "ASSESSMENT",
            "Assessment",
            "SUBMIT_ASSESSMENT",
            request.Passed ? "SUCCESS" : "FAILED",
            correlationId,
            metadata
        );

        await _loggingService.LogAsync(log);
        // Mark that this request has been audited by the controller
        HttpContext.Items["AuditLogWritten"] = true;
        return Ok(new { Message = $"Assessment submission logged as {(request.Passed ? "PASSED" : "FAILED")}." });
    }

    [HttpPost("api-failure")]
    public async Task<IActionResult> SimulateApiFailure()
    {
        throw new InvalidOperationException("Simulated API failure: Unable to write to the primary data stream because the channel connection timed out.");
    }

    private string GetCorrelationId()
    {
        return HttpContext.Items.TryGetValue(CorrelationIdMiddleware.CorrelationIdHeaderKey, out var cid)
            ? cid?.ToString() ?? Guid.NewGuid().ToString()
            : Guid.NewGuid().ToString();
    }

    private AuditLog CreateAuditLog(
        string userId,
        string sessionId,
        string eventType,
        string module,
        string action,
        string status,
        string correlationId,
        Dictionary<string, object> metadata)
    {
        return new AuditLog
        {
            Timestamp = DateTime.UtcNow,
            UserId = userId,
            SessionId = sessionId,
            EventType = eventType,
            Module = module,
            Action = action,
            Status = status,
            CorrelationId = correlationId,
            RequestPath = HttpContext.Request.Path,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
            UserAgent = Request.Headers.UserAgent.ToString(),
            Metadata = metadata
        };
    }
}
