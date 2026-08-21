using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.Supervisors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Audit.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AssessmentController : ControllerBase
{
    private readonly IAssessmentSupervisor _assessmentSupervisor;
    private readonly IAuditLoggingSupervisor _loggingService;

    public AssessmentController(IAssessmentSupervisor assessmentSupervisor, IAuditLoggingSupervisor loggingService)
    {
        _assessmentSupervisor = assessmentSupervisor;
        _loggingService = loggingService;
    }

    [HttpGet("questions/{category}")]
    public async Task<ActionResult<List<Question>>> GetQuestions(string category)
    {
        var decodedCategory = Uri.UnescapeDataString(category);

        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = Request.Headers["X-Session-ID"].ToString();
        if (string.IsNullOrWhiteSpace(sessionId)) sessionId = "sess_" + userId;

        var questions = await _assessmentSupervisor.GetQuestionsByCategoryAsync(decodedCategory, userId, userAgent, ipAddress, requestPath, correlationId, sessionId);

        // Supervisor logged the AssessmentStarted business event; mark the request as already audited.
        HttpContext.Items["AuditLogWritten"] = true;
        return Ok(questions);
    }

    [HttpPost("log-permissions")]
    public async Task<IActionResult> LogPermissions([FromBody] PermissionsPayload payload)
    {
        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = Request.Headers["X-Session-ID"].ToString();
        if (string.IsNullOrWhiteSpace(sessionId)) sessionId = "sess_" + userId;

        var status = payload.Granted ? "SUCCESS" : "FAILED";
        var action = payload.Granted ? "PermissionsGranted" : "PermissionsDenied";

        var log = new AuditLog
        {
            Timestamp = DateTime.UtcNow,
            UserId = userId,
            SessionId = "sess_" + userId,
            EventType = "Business",
            Module = "Assessment",
            Action = action,
            Status = status,
            CorrelationId = correlationId,
            RequestPath = requestPath,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Metadata = new Dictionary<string, object>
            {
                { "CameraGranted", payload.CameraGranted },
                { "MicrophoneGranted", payload.MicrophoneGranted }
            }
        };

        await _loggingService.LogAsync(log);

        // Mark that the controller successfully wrote a business/security audit entry.
        HttpContext.Items["AuditLogWritten"] = true;

        return Ok();
    }

    [HttpPost("log-warning")]
    public async Task<IActionResult> LogProctoringWarning([FromBody] WarningPayload payload)
    {
        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = Request.Headers["X-Session-ID"].ToString();
        if (string.IsNullOrWhiteSpace(sessionId)) sessionId = "sess_" + userId;

        var log = new AuditLog
        {
            Timestamp = DateTime.UtcNow,
            UserId = userId,
            SessionId = "sess_" + userId,
            EventType = "Security",
            Module = "Assessment",
            Action = "ProctoringWarning",
            Status = "WARNING",
            CorrelationId = correlationId,
            RequestPath = requestPath,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Metadata = new Dictionary<string, object>
            {
                { "WarningType", payload.WarningType },
                { "VideoTimestamp", payload.VideoTimestamp }
            }
        };

        await _loggingService.LogAsync(log);

        // Mark that the controller successfully wrote a security audit entry.
        HttpContext.Items["AuditLogWritten"] = true;

        return Ok();
    }

    [HttpPost("submit")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<Assessment>> SubmitAssessment(
        [FromForm] string username,
        [FromForm] string quizCategory,
        [FromForm] string answersJson,
        [FromForm] int warningsCount,
        [FromForm] string warningsLogJson,
        IFormFile? videoFile)
    {
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(quizCategory))
        {
            return BadRequest(new { Message = "Username and QuizCategory are required." });
        }

        var answers = new Dictionary<string, int>();
        try
        {
            if (!string.IsNullOrWhiteSpace(answersJson))
            {
                answers = JsonSerializer.Deserialize<Dictionary<string, int>>(answersJson) ?? new();
            }
        }
        catch { }

        var warningsLog = new List<string>();
        try
        {
            if (!string.IsNullOrWhiteSpace(warningsLogJson))
            {
                warningsLog = JsonSerializer.Deserialize<List<string>>(warningsLogJson) ?? new();
            }
        }
        catch { }

        string videoPlaybackUrl = string.Empty;
        if (videoFile != null && videoFile.Length > 0)
        {
            try
            {
                var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "assessments");
                if (!Directory.Exists(uploadsFolder))
                {
                    Directory.CreateDirectory(uploadsFolder);
                }

                var uniqueFileName = $"{Guid.NewGuid()}{Path.GetExtension(videoFile.FileName)}";
                if (string.IsNullOrEmpty(Path.GetExtension(videoFile.FileName)))
                {
                    uniqueFileName += ".webm";
                }
                var filePath = Path.Combine(uploadsFolder, uniqueFileName);

                using (var fileStream = new FileStream(filePath, FileMode.Create))
                {
                    await videoFile.CopyToAsync(fileStream);
                }

                videoPlaybackUrl = $"/uploads/assessments/{uniqueFileName}";
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Failed to save proctor video file: {ex.Message}");
            }
        }

        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = Request.Headers["X-Session-ID"].ToString();
        if (string.IsNullOrWhiteSpace(sessionId)) sessionId = "sess_" + username;

        try
        {
            var result = await _assessmentSupervisor.SubmitAssessmentAsync(
                username,
                quizCategory,
                answers,
                warningsCount,
                warningsLog,
                videoPlaybackUrl,
                userAgent,
                ipAddress,
                requestPath,
                correlationId,
                sessionId
            );
            // Supervisor created the AssessmentSubmitted business log. Mark request audited so middleware won't duplicate.
            HttpContext.Items["AuditLogWritten"] = true;

            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpGet("history/{username}")]
    public async Task<ActionResult<List<Assessment>>> GetHistory(string username)
    {
        var history = await _assessmentSupervisor.GetHistoryByUsernameAsync(username);
        return Ok(history);
    }

    private string GetActiveUser()
    {
        var userId = Request.Headers["X-User-ID"].ToString();
        if (string.IsNullOrWhiteSpace(userId))
        {
            userId = Request.Cookies["AuditSession"] ?? "anonymous";
        }
        return userId;
    }

    private string GetCorrelationId()
    {
        return HttpContext.Items.TryGetValue("X-Correlation-ID", out var cid)
            ? cid?.ToString() ?? Guid.NewGuid().ToString()
            : Guid.NewGuid().ToString();
    }
}

public class PermissionsPayload
{
    public bool Granted { get; set; }
    public bool CameraGranted { get; set; }
    public bool MicrophoneGranted { get; set; }
}

public class WarningPayload
{
    public string WarningType { get; set; } = string.Empty;
    public string VideoTimestamp { get; set; } = string.Empty;
}
