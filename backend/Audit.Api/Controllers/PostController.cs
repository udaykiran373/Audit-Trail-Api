using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.Supervisors;
using Microsoft.AspNetCore.Mvc;

namespace Audit.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PostController : ControllerBase
{
    private readonly IPostSupervisor _postSupervisor;

    public PostController(IPostSupervisor postSupervisor)
    {
        _postSupervisor = postSupervisor;
    }

    [HttpGet]
    public async Task<ActionResult<List<Post>>> GetPosts()
    {
        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = GetSessionId(userId);

        // Supervisor now handles the logic and the logging
        var posts = await _postSupervisor.GetPostsAsync(userId, userAgent, ipAddress, requestPath, correlationId, sessionId);

        HttpContext.Items["AuditLogWritten"] = true;
        return Ok(posts);
    }

    [HttpPost]
    public async Task<ActionResult<Post>> CreatePost([FromBody] Post post)
    {
        if (string.IsNullOrWhiteSpace(post.Content))
        {
            return BadRequest(new { Message = "Post content cannot be empty." });
        }

        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = GetSessionId(userId);

        var created = await _postSupervisor.CreatePostAsync(post, userId, userAgent, ipAddress, requestPath, correlationId, sessionId);

        HttpContext.Items["AuditLogWritten"] = true;
        return Ok(created);
    }

    [HttpPost("{id}/like")]
    public async Task<IActionResult> LikePost(string id)
    {
        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = GetSessionId(userId);

        var updated = await _postSupervisor.LikePostAsync(id, userId, userAgent, ipAddress, requestPath, correlationId, sessionId);

        HttpContext.Items["AuditLogWritten"] = true;
        if (updated == null) return NotFound();

        var isLiked = updated.LikedBy != null && updated.LikedBy.Contains(userId);
        return Ok(new { likes = updated.Likes, isLiked });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePost(string id)
    {
        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = GetSessionId(userId);

        var success = await _postSupervisor.DeletePostAsync(id, userId, userAgent, ipAddress, requestPath, correlationId, sessionId);

        HttpContext.Items["AuditLogWritten"] = true;
        if (!success) return NotFound();
        return Ok();
    }

    // --- Helper Methods ---

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

    // NEW: Extracts the unique session ID sent from React
    private string GetSessionId(string userId)
    {
        var sessionId = Request.Headers["X-Session-ID"].ToString();
        if (string.IsNullOrWhiteSpace(sessionId))
        {
            sessionId = "sess_" + userId; // Fallback
        }
        return sessionId;
    }
}