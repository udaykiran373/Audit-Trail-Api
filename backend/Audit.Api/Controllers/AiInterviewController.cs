using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Audit.Api.DTOs;
using Audit.Api.Models;
using Audit.Api.Supervisors;
using System.Collections.Generic;

namespace Audit.Api.Controllers
{
    /// <summary>
    /// The Presentation Layer for AI Interview workflows.
    /// Acts strictly as an HTTP ingress router. Its only responsibilities are mapping 
    /// multipart form data, streaming video files, and extracting ambient network context 
    /// (Headers, IP, Session) before delegating all persistence and business logic to the Supervisor.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class AiInterviewController : ControllerBase
    {
        private readonly IAiInterviewSupervisor _interviewSupervisor;

        public AiInterviewController(IAiInterviewSupervisor interviewSupervisor)
        {
            _interviewSupervisor = interviewSupervisor;
        }

        /// <summary>
        /// Intercepts a completed AI interview submission, including the video stream and metadata.
        /// </summary>
        [HttpPost("submit")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> SubmitInterview(
            [FromForm] string username,
            [FromForm] string role,
            [FromForm] string question,
            [FromForm] string? transcript,
            [FromForm] int warningsCount,
            [FromForm] string? warningsLogJson,
            IFormFile? videoFile) // ARCHITECTURE NOTE: IFormFile allows efficient memory streaming of the video instead of buffering it all at once.
        {
            // ARCHITECTURE NOTE: The Controller's only job is to extract network-specific ambient data.
            var correlationId = HttpContext.Items.TryGetValue("X-Correlation-ID", out var cid) ? cid?.ToString() ?? Guid.NewGuid().ToString() : Guid.NewGuid().ToString();
            var userAgent = Request.Headers.UserAgent.ToString();
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            var requestPath = HttpContext.Request.Path;
            var sessionId = HttpContext.Items["SessionId"]?.ToString() ?? ("sess_" + username);


            var result = await _interviewSupervisor.SubmitInterviewAsync(username, role, question, transcript, warningsCount, warningsLogJson, videoFile, ipAddress, userAgent, correlationId, sessionId, requestPath);

            // Flag for middleware to know the operation succeeded
            HttpContext.Items["AuditLogWritten"] = true;
            return Ok(result);
        }

        /// <summary>
        /// Retrieves the interview history for a specific user.
        /// </summary>
        [HttpGet("history/{username}")]
        public async Task<ActionResult<List<AiInterview>>> GetHistory(string username)
        {
            // Blindly routes the request to the Supervisor
            var history = await _interviewSupervisor.GetHistoryByUsernameAsync(username);
            return Ok(history);
        }

        /// <summary>
        /// Records an audit log when a user views the AI Interview dashboard.
        /// </summary>
        [HttpPost("log-view")]
        public async Task<IActionResult> LogView()
        {
            // ARCHITECTURE NOTE: Extracts custom frontend identifiers directly from HTTP Headers
            var username = Request.Headers["X-User-ID"].ToString();

            var userAgent = Request.Headers.UserAgent.ToString();
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            var requestPath = HttpContext.Request.Path;
            var correlationId = HttpContext.Items.TryGetValue("X-Correlation-ID", out var cid) ? cid?.ToString() ?? Guid.NewGuid().ToString() : Guid.NewGuid().ToString();
            var sessionId = HttpContext.Items["SessionId"]?.ToString() ?? ("sess_" + username);

            await _interviewSupervisor.LogViewAsync(username, ipAddress, userAgent, correlationId, sessionId, requestPath);

            HttpContext.Items["AuditLogWritten"] = true;
            return Ok();
        }

        /// <summary>
        /// Records an audit log detailing which hardware permissions (camera/mic) were granted or denied.
        /// </summary>
        [HttpPost("log-permissions")]
        public async Task<IActionResult> LogPermissions([FromBody] PermissionsPayload payload)
        {
            var username = Request.Headers["X-User-ID"].ToString();

            var userAgent = Request.Headers.UserAgent.ToString();
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            var requestPath = HttpContext.Request.Path;
            var correlationId = HttpContext.Items.TryGetValue("X-Correlation-ID", out var cid) ? cid?.ToString() ?? Guid.NewGuid().ToString() : Guid.NewGuid().ToString();
            var sessionId = HttpContext.Items["SessionId"]?.ToString() ?? ("sess_" + username);

            await _interviewSupervisor.LogPermissionsAsync(payload, username, ipAddress, userAgent, correlationId, sessionId, requestPath);

            HttpContext.Items["AuditLogWritten"] = true;
            return Ok(new { Message = "Permissions logged successfully" });
        }
    }
}