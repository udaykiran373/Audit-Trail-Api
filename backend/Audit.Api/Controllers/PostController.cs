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

    /// <summary>
    /// Initializes a new instance of the <see cref="PostController"/> class.
    /// </summary>
    /// <param name="postSupervisor">The supervisor used for post operations.</param>
    public PostController(IPostSupervisor postSupervisor)
    {
        // Inject the post supervisor dependency
        _postSupervisor = postSupervisor;
    }

    /// <summary>
    /// Retrieves a list of all posts.
    /// </summary>
    /// <returns>A list of <see cref="Post"/> objects.</returns>
    [HttpGet]
    public async Task<ActionResult<List<Post>>> GetPosts()
    {
        // Extract context information for auditing
        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = HttpContext.Items["SessionId"]?.ToString() ?? "anonymous";

        // Delegate logic and auditing to the supervisor
        var posts = await _postSupervisor.GetPostsAsync(userId, userAgent, ipAddress, requestPath, correlationId, sessionId);

        // Mark audit log as written for middleware
        HttpContext.Items["AuditLogWritten"] = true;

        return Ok(posts);
    }

    /// <summary>
    /// Creates a new post.
    /// </summary>
    /// <param name="post">The post data to create.</param>
    /// <returns>The created <see cref="Post"/> object.</returns>
    [HttpPost]
    public async Task<ActionResult<Post>> CreatePost([FromBody] Post post)
    {
        // Validate post content
        if (string.IsNullOrWhiteSpace(post.Content))
        {
            return BadRequest(new { Message = "Post content cannot be empty." });
        }

        // Extract context information for auditing
        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = HttpContext.Items["SessionId"]?.ToString() ?? "anonymous";

        // Delegate creation logic and auditing to the supervisor
        var created = await _postSupervisor.CreatePostAsync(post, userId, userAgent, ipAddress, requestPath, correlationId, sessionId);

        // Mark audit log as written for middleware
        HttpContext.Items["AuditLogWritten"] = true;

        return Ok(created);
    }

    /// <summary>
    /// Toggles a like on a specific post for the active user.
    /// </summary>
    /// <param name="id">The unique identifier of the post.</param>
    /// <returns>An object containing the updated like count and the user's like status.</returns>
    [HttpPost("{id}/like")]
    public async Task<IActionResult> LikePost(string id)
    {
        // Extract context information for auditing
        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = HttpContext.Items["SessionId"]?.ToString() ?? "anonymous";

        // Delegate like toggling logic and auditing to the supervisor
        var updated = await _postSupervisor.LikePostAsync(id, userId, userAgent, ipAddress, requestPath, correlationId, sessionId);

        // Mark audit log as written for middleware
        HttpContext.Items["AuditLogWritten"] = true;

        // Return 404 if the post was not found
        if (updated == null) return NotFound();

        // Determine if the current user has liked the post
        var isLiked = updated.LikedBy != null && updated.LikedBy.Contains(userId);

        return Ok(new { likes = updated.Likes, isLiked });
    }

    /// <summary>
    /// Deletes a specific post by its ID.
    /// </summary>
    /// <param name="id">The unique identifier of the post to delete.</param>
    /// <returns>An HTTP 200 OK result if successful, or HTTP 404 Not Found if the post does not exist.</returns>   
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePost(string id)
    {
        // Extract context information for auditing
        var userId = GetActiveUser();
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var requestPath = HttpContext.Request.Path;
        var correlationId = GetCorrelationId();
        var sessionId = HttpContext.Items["SessionId"]?.ToString() ?? "anonymous";

        // Delegate deletion logic and auditing to the supervisor
        var success = await _postSupervisor.DeletePostAsync(id, userId, userAgent, ipAddress, requestPath, correlationId, sessionId);

        // Mark audit log as written for middleware
        HttpContext.Items["AuditLogWritten"] = true;

        // Return 404 if the post was not found or deletion failed
        if (!success) return NotFound();

        return Ok();
    }

    // Helper Methods

    /// <summary>
    /// Retrieves the ID of the currently active user from headers or cookies.
    /// </summary>
    /// <returns>The active user's ID, or "anonymous" if not found.</returns>
    private string GetActiveUser()
    {
        // Check for user ID in the custom header
        var userId = Request.Headers["X-User-ID"].ToString();
        if (string.IsNullOrWhiteSpace(userId))
        {
            // Fallback to cookie if header is not present
            userId = Request.Cookies["AuditSession"] ?? "anonymous";
        }
        return userId;
    }

    /// <summary>
    /// Retrieves the correlation ID for the current request.
    /// </summary>
    /// <returns>The existing correlation ID, or a newly generated one.</returns>
    private string GetCorrelationId()
    {
        // Retrieve correlation ID from HttpContext items or generate a new GUID
        return HttpContext.Items.TryGetValue("X-Correlation-ID", out var cid)
            ? cid?.ToString() ?? Guid.NewGuid().ToString()
            : Guid.NewGuid().ToString();
    }
}