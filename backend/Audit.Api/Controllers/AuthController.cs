using System;
using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.Supervisors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Audit.Api.Supervisors;

namespace Audit.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthSupervisor _authSupervisor;

    public AuthController(IAuthSupervisor authSupervisor)
    {
        _authSupervisor = authSupervisor;
    }

    [HttpPost("signup")]
    public async Task<IActionResult> SignUp([FromBody] User signupRequest)
    {
        if (string.IsNullOrWhiteSpace(signupRequest.Username) || string.IsNullOrWhiteSpace(signupRequest.Password))
        {
            return BadRequest(new { Message = "Username and password are required." });
        }

        var result = await _authSupervisor.SignUpAsync(
            signupRequest.Username,
            signupRequest.Password,
            Request.Headers.UserAgent.ToString(),
            HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
            HttpContext.Request.Path,
            GetCorrelationId()
        );

        if (!result.Success) return BadRequest(new { Message = result.Message });

        HttpContext.Items["AuditLogWritten"] = true;
        return Ok(new { Message = result.Message, Username = signupRequest.Username, SessionId = result.SessionId });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] User loginRequest)
    {
        if (string.IsNullOrWhiteSpace(loginRequest.Username) || string.IsNullOrWhiteSpace(loginRequest.Password))
        {
            return BadRequest(new { Message = "Username and password are required." });
        }

        var result = await _authSupervisor.LoginAsync(
            loginRequest.Username,
            loginRequest.Password,
            Request.Headers.UserAgent.ToString(),
            HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
            HttpContext.Request.Path,
            GetCorrelationId()
        );

        if (!result.Success) return Unauthorized(new { Message = result.Message });

        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = false,
            SameSite = SameSiteMode.Lax,
            Expires = DateTime.UtcNow.AddDays(7)
        };
        Response.Cookies.Append("AuditSession", result.User!.Username, cookieOptions);

        HttpContext.Items["AuditLogWritten"] = true;
        return Ok(new { Message = result.Message, Username = result.User.Username, SessionId = result.SessionId });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var activeUser = Request.Cookies["AuditSession"] ?? "anonymous";
        var sessionId = GetSessionId(activeUser);

        Response.Cookies.Delete("AuditSession");

        await _authSupervisor.LogoutAsync(
            activeUser,
            sessionId,
            Request.Headers.UserAgent.ToString(),
            HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
            HttpContext.Request.Path,
            GetCorrelationId()
        );

        HttpContext.Items["AuditLogWritten"] = true;
        return Ok(new { Message = "Logout successful." });
    }

    [HttpGet("me")]
    public IActionResult GetCurrentUser()
    {
        var activeUser = Request.Cookies["AuditSession"];
        if (string.IsNullOrEmpty(activeUser))
        {
            return Unauthorized(new { Message = "Not authenticated." });
        }
        return Ok(new { Username = activeUser });
    }

    // --- Controller Web Helpers ---

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
}