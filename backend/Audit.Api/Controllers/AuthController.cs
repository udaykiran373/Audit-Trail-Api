using System;
using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.Supervisors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Audit.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthSupervisor _authSupervisor;

    /// <summary>
    /// Initializes a new instance of the <see cref="AuthController"/> class.
    /// </summary>
    /// <param name="authSupervisor">The authentication supervisor handling auth operations.</param>
    public AuthController(IAuthSupervisor authSupervisor)
    {
        _authSupervisor = authSupervisor;
    }

    /// <summary>
    /// Handles user registration.
    /// </summary>
    /// <param name="signupRequest">The request payload containing username and password.</param>
    /// <returns>An IActionResult indicating the outcome of the signup operation.</returns>
    [HttpPost("signup")]
    public async Task<IActionResult> SignUp([FromBody] User signupRequest)
    {
        // Validate incoming request parameters
        if (string.IsNullOrWhiteSpace(signupRequest.Username) || string.IsNullOrWhiteSpace(signupRequest.Password))
        {
            return BadRequest(new { Message = "Username and password are required." });
        }

        // Delegate the actual signup logic to the supervisor
        var result = await _authSupervisor.SignUpAsync(
            signupRequest.Username,
            signupRequest.Password,
            Request.Headers.UserAgent.ToString(),
            HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
            HttpContext.Request.Path,
            GetCorrelationId()
        );

        // Check if signup was successful
        if (!result.Success) return BadRequest(new { Message = result.Message });

        // Mark context item to ensure audit logging logic registers it
        HttpContext.Items["AuditLogWritten"] = true;

        return Ok(new { Message = result.Message, Username = signupRequest.Username, SessionId = result.SessionId });
    }

    /// <summary>
    /// Authenticates a user and starts a session.
    /// </summary>
    /// <param name="loginRequest">The request payload containing username and password.</param>
    /// <returns>An IActionResult indicating success or failure of the login attempt.</returns>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] User loginRequest)
    {
        // Ensure credentials are provided
        if (string.IsNullOrWhiteSpace(loginRequest.Username) || string.IsNullOrWhiteSpace(loginRequest.Password))
        {
            return BadRequest(new { Message = "Username and password are required." });
        }

        // Attempt login via the supervisor
        var result = await _authSupervisor.LoginAsync(
            loginRequest.Username,
            loginRequest.Password,
            Request.Headers.UserAgent.ToString(),
            HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
            HttpContext.Request.Path,
            GetCorrelationId()
        );

        // Deny access if authentication fails
        if (!result.Success) return Unauthorized(new { Message = result.Message });

        // Create a cookie to maintain the user's session
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = false,
            SameSite = SameSiteMode.Lax,
            Expires = DateTime.UtcNow.AddDays(7)
        };

        // Append the session cookie to the response
        Response.Cookies.Append("AuditSession", result.User!.Username, cookieOptions);

        // Mark that an audit log should be noted for this action
        HttpContext.Items["AuditLogWritten"] = true;

        return Ok(new { Message = result.Message, Username = result.User.Username, SessionId = result.SessionId });
    }

    /// <summary>
    /// Logs out the current user and invalidates their session.
    /// </summary>
    /// <returns>An IActionResult confirming successful logout.</returns>
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        // Retrieve the current user from cookies, fallback to anonymous if not present
        var activeUser = Request.Cookies["AuditSession"] ?? "anonymous";

        // Determine the current session ID
        var sessionId = GetSessionId(activeUser);

        // Clear the session cookie from the client
        Response.Cookies.Delete("AuditSession");

        // Inform the supervisor to handle logout on the backend
        await _authSupervisor.LogoutAsync(
            activeUser,
            sessionId,
            Request.Headers.UserAgent.ToString(),
            HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
            HttpContext.Request.Path,
            GetCorrelationId()
        );

        // Note the audit event in the request context
        HttpContext.Items["AuditLogWritten"] = true;

        return Ok(new { Message = "Logout successful." });
    }

    /// <summary>
    /// Retrieves the username of the currently authenticated user.
    /// </summary>
    /// <returns>An IActionResult containing the current username, or an unauthorized error.</returns>
    [HttpGet("me")]
    public IActionResult GetCurrentUser()
    {
        // Extract the session cookie to determine the active user
        var activeUser = Request.Cookies["AuditSession"];

        // Return unauthorized if no session is active
        if (string.IsNullOrEmpty(activeUser))
        {
            return Unauthorized(new { Message = "Not authenticated." });
        }

        return Ok(new { Username = activeUser });
    }

    // --- Controller Web Helpers ---

    /// <summary>
    /// Gets the current correlation ID from the HTTP context, or generates a new one.
    /// </summary>
    /// <returns>A unique string representing the correlation ID.</returns>
    private string GetCorrelationId()
    {
        // Look for an existing correlation ID header/item, generate a new Guid if missing
        return HttpContext.Items.TryGetValue("X-Correlation-ID", out var cid)
            ? cid?.ToString() ?? Guid.NewGuid().ToString()
            : Guid.NewGuid().ToString();
    }

    /// <summary>
    /// Resolves the session ID for the request based on headers or the provided user ID.
    /// </summary>
    /// <param name="userId">The ID of the user, used as a fallback to generate a session ID.</param>
    /// <returns>The resolved session ID string.</returns>
    private string GetSessionId(string userId)
    {
        // First try to extract the session ID from the request headers
        var sessionId = Request.Headers["X-Session-ID"].ToString();

        // If not found in headers, generate a fallback ID using the user ID
        if (string.IsNullOrWhiteSpace(sessionId))
        {
            sessionId = "sess_" + userId;
        }

        return sessionId;
    }
}