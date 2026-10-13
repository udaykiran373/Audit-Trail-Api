using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Supervisors;

/// <summary>
/// Defines the contract for authentication supervisory operations.
/// </summary>
public interface IAuthSupervisor
{
    /// <summary>
    /// Registers a new user asynchronously.
    /// </summary>
    /// <param name="username">The desired username.</param>
    /// <param name="password">The password for the new user.</param>
    /// <param name="userAgent">The client's user agent string.</param>
    /// <param name="ipAddress">The client's IP address.</param>
    /// <param name="requestPath">The path of the incoming request.</param>
    /// <param name="correlationId">The correlation ID for tracing the request.</param>
    /// <returns>A tuple containing the success status, a message, and the generated session ID.</returns>
    Task<(bool Success, string Message, string SessionId)> SignUpAsync(string username, string password, string userAgent, string ipAddress, string requestPath, string correlationId);

    /// <summary>
    /// Authenticates a user asynchronously.
    /// </summary>
    /// <param name="username">The username of the user attempting to log in.</param>
    /// <param name="password">The password provided by the user.</param>
    /// <param name="userAgent">The client's user agent string.</param>
    /// <param name="ipAddress">The client's IP address.</param>
    /// <param name="requestPath">The path of the incoming request.</param>
    /// <param name="correlationId">The correlation ID for tracing the request.</param>
    /// <returns>A tuple containing the success status, a message, the session ID, and the authenticated user object (if successful).</returns>
    Task<(bool Success, string Message, string SessionId, User? User)> LoginAsync(string username, string password, string userAgent, string ipAddress, string requestPath, string correlationId);

    /// <summary>
    /// Logs out a user asynchronously.
    /// </summary>
    /// <param name="username">The username of the user logging out.</param>
    /// <param name="sessionId">The current session ID being terminated.</param>
    /// <param name="userAgent">The client's user agent string.</param>
    /// <param name="ipAddress">The client's IP address.</param>
    /// <param name="requestPath">The path of the incoming request.</param>
    /// <param name="correlationId">The correlation ID for tracing the request.</param>
    /// <returns>A task that represents the asynchronous logout operation.</returns>
    Task LogoutAsync(string username, string sessionId, string userAgent, string ipAddress, string requestPath, string correlationId);
}