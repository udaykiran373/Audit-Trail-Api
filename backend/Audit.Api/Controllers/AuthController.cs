using System;
using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.Repositories;
using Audit.Api.Supervisors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;

namespace Audit.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IMongoCollection<User> _usersCollection;
    private readonly IAuditLoggingSupervisor _loggingSupervisor;

    public AuthController(MongoDbContext dbContext, IAuditLoggingSupervisor loggingSupervisor)
    {
        _usersCollection = dbContext.Database.GetCollection<User>("users");
        _loggingSupervisor = loggingSupervisor;
    }

    [HttpPost("signup")]
    public async Task<IActionResult> SignUp([FromBody] User signupRequest)
    {
        if (string.IsNullOrWhiteSpace(signupRequest.Username) || string.IsNullOrWhiteSpace(signupRequest.Password))
        {
            return BadRequest(new { Message = "Username and password are required." });
        }

        var usernameLower = signupRequest.Username.Trim().ToLowerInvariant();
        var userExists = await _usersCollection.Find(u => u.Username.ToLower() == usernameLower).AnyAsync();
        if (userExists)
        {
            return BadRequest(new { Message = "Username already exists." });
        }

        var newUser = new User
        {
            Username = signupRequest.Username.Trim(),
            Password = signupRequest.Password.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        await _usersCollection.InsertOneAsync(newUser);

        // Log the signup to the Audit Trail in real-time
        await LogAuthenticationEventAsync(newUser.Username, "USER_REGISTERED", "SUCCESS", new()
        {
            { "registeredUsername", newUser.Username }
        });

        return Ok(new { Message = "Registration successful." });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] User loginRequest)
    {
        if (string.IsNullOrWhiteSpace(loginRequest.Username) || string.IsNullOrWhiteSpace(loginRequest.Password))
        {
            return BadRequest(new { Message = "Username and password are required." });
        }

        var usernameLower = loginRequest.Username.Trim().ToLowerInvariant();
        var user = await _usersCollection.Find(u => u.Username.ToLower() == usernameLower && u.Password == loginRequest.Password.Trim()).FirstOrDefaultAsync();

        if (user == null)
        {
            // Log failed login event in real-time
            await LogAuthenticationEventAsync(loginRequest.Username, "LOGIN_FAILED", "FAILED", new()
            {
                { "usernameTried", loginRequest.Username },
                { "reason", "Invalid credentials" }
            });

            return Unauthorized(new { Message = "Invalid username or password." });
        }

        // Set Cookie containing the username session
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = false, // Set false for HTTP local dev testing
            SameSite = SameSiteMode.Lax,
            Expires = DateTime.UtcNow.AddDays(7)
        };
        Response.Cookies.Append("AuditSession", user.Username, cookieOptions);

        // Log successful login event in real-time
        await LogAuthenticationEventAsync(user.Username, "LOGIN_SUCCESS", "SUCCESS", new()
        {
            { "username", user.Username }
        });

        return Ok(new { Message = "Login successful.", Username = user.Username });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var activeUser = Request.Cookies["AuditSession"] ?? "anonymous";

        Response.Cookies.Delete("AuditSession");

        // Log logout event in real-time
        await LogAuthenticationEventAsync(activeUser, "LOGOUT", "SUCCESS", new()
        {
            { "username", activeUser }
        });

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

    private async Task LogAuthenticationEventAsync(string userId, string action, string status, System.Collections.Generic.Dictionary<string, object> metadata)
    {
        var sessionId = "sess_" + userId;
        var log = new AuditLog
        {
            Timestamp = DateTime.UtcNow,
            UserId = userId,
            SessionId = sessionId,
            EventType = "AUTHENTICATION",
            Module = "Auth",
            Action = action,
            Status = status,
            CorrelationId = HttpContext.Items.TryGetValue("X-Correlation-ID", out var cid) ? cid?.ToString() ?? Guid.NewGuid().ToString() : Guid.NewGuid().ToString(),
            RequestPath = HttpContext.Request.Path,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
            UserAgent = Request.Headers.UserAgent.ToString(),
            Metadata = metadata
        };
        await _loggingSupervisor.LogAsync(log);
        // Mark that an audit log was written by the controller for this request
        HttpContext.Items["AuditLogWritten"] = true;
    }
}
