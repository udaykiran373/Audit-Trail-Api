using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Audit.Api.DTOs;
using Audit.Api.Models;
using Audit.Api.Supervisors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Audit.Api.Controllers;

/// <summary>
/// The Presentation Layer (Controller) for handling assessment and proctoring operations.
/// Acts as the HTTP ingress router, extracting network context (Headers, IP, Cookies) 
/// and delegating all core business logic and persistence to the Assessment Supervisor.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class AssessmentController : ControllerBase
{
    private readonly IAssessmentSupervisor _assessmentSupervisor;

    public AssessmentController(IAssessmentSupervisor assessmentSupervisor)
    {
        _assessmentSupervisor = assessmentSupervisor;
    }

    /// <summary>
    /// Retrieves a list of assessment questions for a specific category.
    /// </summary>
    [HttpGet("questions/{category}")]
    public async Task<ActionResult<List<Question>>> GetQuestions(string category)
    {
        // Decode the URL parameter safely
        var decodedCategory = Uri.UnescapeDataString(category);

        // HTTP context keeps the endpoint handlers clean and readable.
        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = GetSessionId(userId);

        var questions = await _assessmentSupervisor.GetQuestionsByCategoryAsync(decodedCategory, userId, userAgent, ipAddress, requestPath, correlationId, sessionId);

        HttpContext.Items["AuditLogWritten"] = true;
        return Ok(questions);
    }

    /// <summary>
    /// Logs hardware permissions (Camera/Microphone) granted or denied by the user.
    /// </summary>
    [HttpPost("log-permissions")]
    public async Task<IActionResult> LogPermissions([FromBody] PermissionsPayload payload)
    {
        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = GetSessionId(userId);

        await _assessmentSupervisor.LogPermissionsAsync(payload, userId, userAgent, ipAddress, requestPath, correlationId, sessionId);

        HttpContext.Items["AuditLogWritten"] = true;
        return Ok();
    }

    /// <summary>
    /// Logs live proctoring warnings (e.g., user looked away, multiple faces detected).
    /// </summary>
    [HttpPost("log-warning")]
    public async Task<IActionResult> LogProctoringWarning([FromBody] WarningPayload payload)
    {
        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = GetSessionId(userId);

        await _assessmentSupervisor.LogProctoringWarningAsync(payload, userId, userAgent, ipAddress, requestPath, correlationId, sessionId);

        HttpContext.Items["AuditLogWritten"] = true;
        return Ok();
    }

    /// <summary>
    /// Submits a completed assessment, including answers, proctoring warnings, and the recorded video stream.
    /// </summary>
    [HttpPost("submit")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<Assessment>> SubmitAssessment(
        [FromForm] string username,
        [FromForm] string quizCategory,
        [FromForm] string? answersJson,
        [FromForm] int warningsCount,
        [FromForm] string? warningsLogJson,
        IFormFile? videoFile) // ARCHITECTURE NOTE: IFormFile allows the server to stream the video efficiently without buffering to RAM.
    {
        // HTTP layer validation: Ensure minimum required routing payload is present
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(quizCategory))
        {
            return BadRequest(new { Message = "Username and QuizCategory are required." });
        }

        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = GetSessionId(username);

        try
        {
            // Delegate heavy processing (video storage, score calculation, audit logging) to the Supervisor
            var result = await _assessmentSupervisor.SubmitAssessmentAsync(
                username,
                quizCategory,
                answersJson ?? "",
                warningsCount,
                warningsLogJson ?? "",
                videoFile,
                userAgent,
                ipAddress,
                requestPath,
                correlationId,
                sessionId
            );

            HttpContext.Items["AuditLogWritten"] = true;
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            // Gracefully catch domain validation errors thrown by the Supervisor and return a 400 Bad Request
            return BadRequest(new { Message = ex.Message });
        }
    }

    /// <summary>
    /// Retrieves the assessment history for a specific user.
    /// </summary>
    [HttpGet("history/{username}")]
    public async Task<ActionResult<List<Assessment>>> GetHistory(string username)
    {
        var history = await _assessmentSupervisor.GetHistoryByUsernameAsync(username);
        return Ok(history);
    }

    /// <summary>
    /// Logs a page view event for the assessment dashboard.
    /// </summary>
    [HttpPost("log-view")]
    public async Task<IActionResult> LogView()
    {
        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = GetSessionId(userId);

        await _assessmentSupervisor.LogViewAsync(userId, userAgent, ipAddress, requestPath, correlationId, sessionId);

        HttpContext.Items["AuditLogWritten"] = true;
        return Ok();
    }

    #region HTTP Context Extraction Helpers

    // ARCHITECTURE NOTE: These helper methods encapsulate the logic for extracting 
    // custom headers and cookies, keeping the endpoint methods DRY and focused on routing.

    private string GetActiveUser()
    {
        var userId = Request.Headers["X-User-ID"].ToString();
        if (string.IsNullOrWhiteSpace(userId))
        {
            // Fallback to cookie if the header is missing
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

    private string GetSessionId(string userId)
    {
        var sessionId = Request.Headers["X-Session-ID"].ToString();
        if (string.IsNullOrWhiteSpace(sessionId))
        {
            sessionId = "sess_" + userId;
        }
        return sessionId;
    }

    #endregion
}