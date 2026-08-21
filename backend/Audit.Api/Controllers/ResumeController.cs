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

    public ResumeController(IResumeSupervisor resumeSupervisor, IWebHostEnvironment env)
    {
        _resumeSupervisor = resumeSupervisor;
        _env = env;
    }

    [HttpGet("{username}")]
    public async Task<ActionResult<Resume>> GetResume(string username)
    {
        // 1. Extract context including the dynamic Session ID
        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = GetSessionId(userId); // Uses your new helper method

        // 2. Pass everything down to the Supervisor
        var resume = await _resumeSupervisor.GetResumeAsync(username, userId, userAgent, ipAddress, requestPath, correlationId, sessionId);

        // 3. Suppress the duplicate System middleware log
        HttpContext.Items["AuditLogWritten"] = true;

        if (resume == null)
        {
            return Ok(new Resume { Username = username });
        }

        return Ok(resume);
    }

    [HttpPost]
    public async Task<ActionResult<Resume>> SaveResume([FromBody] Resume resume)
    {
        if (string.IsNullOrWhiteSpace(resume.Username))
        {
            return BadRequest(new { Message = "Username is required." });
        }

        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = GetSessionId(userId);
        var saved = await _resumeSupervisor.SaveResumeAsync(resume, userId, userAgent, ipAddress, requestPath, correlationId, sessionId);
        HttpContext.Items["AuditLogWritten"] = true;
        return Ok(saved);
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

    [HttpPost("upload-video")]
    public async Task<IActionResult> UploadVideo([FromForm] IFormFile videoFile, [FromForm] string username)
    {
        if (videoFile == null || videoFile.Length == 0)
        {
            return BadRequest(new { Message = "No video file provided." });
        }

        var uploadsRoot = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads", "resumes");
        Directory.CreateDirectory(uploadsRoot);

        var ext = Path.GetExtension(videoFile.FileName);
        var safeName = string.IsNullOrWhiteSpace(username) ? "anon" : username.Replace("@", "_").Replace(" ", "_");
        var fileName = $"{safeName}_{Guid.NewGuid().ToString("N")}{ext}";
        var savePath = Path.Combine(uploadsRoot, fileName);

        await using (var fs = System.IO.File.Create(savePath))
        {
            await videoFile.CopyToAsync(fs);
        }

        var relative = $"/uploads/resumes/{fileName}";
        HttpContext.Items["AuditLogWritten"] = true;
        return Ok(new { url = relative });
    }
    // Paste this at the bottom of ResumeController.cs
    private string GetSessionId(string userId)
    {
        var sessionId = Request.Headers["X-Session-ID"].ToString();
        if (string.IsNullOrWhiteSpace(sessionId))
        {
            sessionId = "sess_" + userId; // Fallback for older sessions
        }
        return sessionId;
    }
}
