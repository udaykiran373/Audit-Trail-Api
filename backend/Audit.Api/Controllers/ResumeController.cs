using System;
using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.Supervisors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using System.IO;

namespace Audit.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ResumeController : ControllerBase
{
    private readonly IResumeSupervisor _resumeSupervisor;
    private readonly IWebHostEnvironment _env;

    /// <summary>
    /// Initializes a new instance of the <see cref="ResumeController"/> class.
    /// </summary>
    /// <param name="resumeSupervisor">The resume supervisor used for business logic operations.</param>
    /// <param name="env">The web host environment.</param>
    public ResumeController(IResumeSupervisor resumeSupervisor, IWebHostEnvironment env)
    {
        // Inject required dependencies
        _resumeSupervisor = resumeSupervisor;
        _env = env;
    }

    /// <summary>
    /// Retrieves the resume for a given username.
    /// </summary>
    /// <param name="username">The username of the resume owner.</param>
    /// <returns>An <see cref="ActionResult{Resume}"/> containing the requested resume, or an empty resume if not found.</returns>
    [HttpGet("{username}")]
    public async Task<ActionResult<Resume>> GetResume(string username)
    {
        // 1. Extract context including the dynamic Session ID and other audit details
        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = HttpContext.Items["SessionId"]?.ToString() ?? "anonymous";

        // 2. Pass everything down to the Supervisor for retrieval and logging
        var resume = await _resumeSupervisor.GetResumeAsync(username, userId, userAgent, ipAddress, requestPath, correlationId, sessionId);

        // 3. Suppress the duplicate System middleware log to avoid redundant audit entries
        HttpContext.Items["AuditLogWritten"] = true;

        // If the resume is not found, return an empty resume with the username set
        if (resume == null)
        {
            return Ok(new Resume { Username = username });
        }

        return Ok(resume);
    }

    /// <summary>
    /// Saves or updates a resume.
    /// </summary>
    /// <param name="resume">The resume object to save.</param>
    /// <returns>An <see cref="ActionResult{Resume}"/> containing the saved resume.</returns>
    [HttpPost]
    public async Task<ActionResult<Resume>> SaveResume([FromBody] Resume resume)
    {
        // Validate that a username is provided before saving
        if (string.IsNullOrWhiteSpace(resume.Username))
        {
            return BadRequest(new { Message = "Username is required." });
        }

        // Extract context details for auditing
        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = HttpContext.Items["SessionId"]?.ToString() ?? "anonymous";
        
        // Pass the resume and context to the supervisor to perform the save and logging
        var saved = await _resumeSupervisor.SaveResumeAsync(resume, userId, userAgent, ipAddress, requestPath, correlationId, sessionId);
        
        // Suppress the duplicate System middleware log
        HttpContext.Items["AuditLogWritten"] = true;
        
        return Ok(saved);
    }

    /// <summary>
    /// Determines the active user ID from the request headers or cookies.
    /// </summary>
    /// <returns>The active user ID as a string, or "anonymous" if not found.</returns>
    private string GetActiveUser()
    {
        // Attempt to get the user ID from a custom header
        var userId = Request.Headers["X-User-ID"].ToString();
        
        // Fall back to a session cookie if the header is not present
        if (string.IsNullOrWhiteSpace(userId))
        {
            userId = Request.Cookies["AuditSession"] ?? "anonymous";
        }
        
        return userId;
    }

    /// <summary>
    /// Retrieves or generates a correlation ID for the current request.
    /// </summary>
    /// <returns>A string representing the correlation ID.</returns>
    private string GetCorrelationId()
    {
        // Check if the correlation ID is already present in HttpContext.Items
        return HttpContext.Items.TryGetValue("X-Correlation-ID", out var cid)
            ? cid?.ToString() ?? Guid.NewGuid().ToString() // Use existing or generate new if null
            : Guid.NewGuid().ToString(); // Generate new if not present
    }
}
