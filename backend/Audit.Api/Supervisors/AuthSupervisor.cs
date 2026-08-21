using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.Repositories;

namespace Audit.Api.Supervisors;

public class AuthSupervisor : IAuthSupervisor
{
    private readonly IAuthRepository _authRepository;
    private readonly IAuditLoggingSupervisor _loggingSupervisor;

    public AuthSupervisor(IAuthRepository authRepository, IAuditLoggingSupervisor loggingSupervisor)
    {
        _authRepository = authRepository;
        _loggingSupervisor = loggingSupervisor;
    }

    public async Task<(bool Success, string Message, string SessionId)> SignUpAsync(string username, string password, string userAgent, string ipAddress, string requestPath, string correlationId)
    {
        if (await _authRepository.UserExistsAsync(username))
        {
            return (false, "Username already exists.", string.Empty);
        }

        var newUser = new User
        {
            Username = username.Trim(),
            Password = password.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        await _authRepository.CreateUserAsync(newUser);

        var uniqueSessionId = Guid.NewGuid().ToString();

        await LogEventAsync(newUser.Username, "USER_REGISTERED", "SUCCESS", uniqueSessionId, userAgent, ipAddress, requestPath, correlationId, new Dictionary<string, object>
        {
            { "registeredUsername", newUser.Username }
        });

        return (true, "Registration successful.", uniqueSessionId);
    }

    public async Task<(bool Success, string Message, string SessionId, User? User)> LoginAsync(string username, string password, string userAgent, string ipAddress, string requestPath, string correlationId)
    {
        var user = await _authRepository.GetUserByUsernameAsync(username);

        if (user == null || user.Password != password.Trim())
        {
            var failedSessionId = "failed_" + Guid.NewGuid().ToString();
            await LogEventAsync(username, "LOGIN_FAILED", "FAILED", failedSessionId, userAgent, ipAddress, requestPath, correlationId, new Dictionary<string, object>
            {
                { "usernameTried", username },
                { "reason", "Invalid credentials" }
            });

            return (false, "Invalid username or password.", string.Empty, null);
        }

        var uniqueSessionId = Guid.NewGuid().ToString();

        await LogEventAsync(user.Username, "LOGIN_SUCCESS", "SUCCESS", uniqueSessionId, userAgent, ipAddress, requestPath, correlationId, new Dictionary<string, object>
        {
            { "username", user.Username }
        });

        return (true, "Login successful.", uniqueSessionId, user);
    }

    public async Task LogoutAsync(string username, string sessionId, string userAgent, string ipAddress, string requestPath, string correlationId)
    {
        await LogEventAsync(username, "LOGOUT", "SUCCESS", sessionId, userAgent, ipAddress, requestPath, correlationId, new Dictionary<string, object>
        {
            { "username", username }
        });
    }

    private async Task LogEventAsync(string userId, string action, string status, string sessionId, string userAgent, string ipAddress, string requestPath, string correlationId, Dictionary<string, object> metadata)
    {
        var log = new AuditLog
        {
            Timestamp = DateTime.UtcNow,
            UserId = userId,
            SessionId = sessionId,
            EventType = "AUTHENTICATION",
            Module = "Auth",
            Action = action,
            Status = status,
            CorrelationId = correlationId,
            RequestPath = requestPath,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Metadata = metadata
        };
        await _loggingSupervisor.LogAsync(log);
    }
}