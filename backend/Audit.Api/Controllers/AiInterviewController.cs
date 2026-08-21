using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Audit.Api.Models;
using Audit.Api.Services;
using Audit.Api.Supervisors;
using System.Collections.Generic;

namespace Audit.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AiInterviewController : ControllerBase
    {
        private readonly IAiInterviewService _interviewService;
        private readonly IAuditLoggingSupervisor _auditService;
        private readonly IWebHostEnvironment _env;

        public AiInterviewController(IAiInterviewService interviewService, IAuditLoggingSupervisor auditService, IWebHostEnvironment env)
        {
            _interviewService = interviewService;
            _auditService = auditService;
            _env = env;
        }

        [HttpPost("submit")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> SubmitInterview([FromForm] string username, [FromForm] string role, [FromForm] string question, [FromForm] string transcript, [FromForm] int warningsCount, [FromForm] string warningsLogJson, IFormFile? videoFile)
        {
            var correlationId = HttpContext.Items.TryGetValue("X-Correlation-ID", out var cid) 
                ? cid?.ToString() ?? Guid.NewGuid().ToString() 
                : Guid.NewGuid().ToString();
            
            string videoUrl = "";

            if (videoFile != null && videoFile.Length > 0)
            {
                var uploadDir = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", "interviews");
                Directory.CreateDirectory(uploadDir);
                var fileName = $"{Guid.NewGuid()}_{videoFile.FileName}";
                if (string.IsNullOrEmpty(Path.GetExtension(videoFile.FileName)))
                {
                    fileName += ".webm";
                }
                using (var stream = new FileStream(Path.Combine(uploadDir, fileName), FileMode.Create))
                {
                    await videoFile.CopyToAsync(stream);
                }
                videoUrl = $"/uploads/interviews/{fileName}";
            }

            var warningsLog = new List<string>();
            try
            {
                if (!string.IsNullOrWhiteSpace(warningsLogJson))
                {
                    warningsLog = System.Text.Json.JsonSerializer.Deserialize<List<string>>(warningsLogJson) ?? new();
                }
            }
            catch { }

            var score = "Pending"; 
            var aiFeedback = "Analysis queued. Video and transcript have been securely captured.";

            var interviewRecord = new AiInterview
            {
                Username = username,
                RoleAppliedFor = role,
                QuestionText = question,
                CandidateTranscript = transcript,
                Score = score,
                AiFeedback = aiFeedback,
                VideoUrl = videoUrl,
                WarningsCount = warningsCount,
                WarningsLog = warningsLog
            };
            await _interviewService.SaveInterviewAsync(interviewRecord);

            var userAgent = Request.Headers.UserAgent.ToString();
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            var requestPath = HttpContext.Request.Path;

            var sessionId = HttpContext.Items["SessionId"]?.ToString() ?? ("sess_" + username);

            await _auditService.LogAsync(new AuditLog
            {
                Timestamp = DateTime.UtcNow,
                UserId = username,
                SessionId = sessionId,
                EventType = "Business",
                Module = "Interview",
                Action = "InterviewCompleted",
                Status = "SUCCESS",
                CorrelationId = correlationId,
                RequestPath = requestPath,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                Metadata = new Dictionary<string, object> { 
                    { "InterviewId", interviewRecord.Id ?? "" }, 
                    { "Role", role }, 
                    { "Score", score },
                    { "Warnings", warningsCount }
                }
            });

            return Ok(new { Message = "Interview processed successfully", Score = score, Feedback = aiFeedback, WarningsCount = warningsCount });
        }

        [HttpGet("history/{username}")]
        public async Task<IActionResult> GetHistory(string username)
        {
            var history = await _interviewService.GetHistoryByUsernameAsync(username);
            return Ok(history);
        }
    }
}
