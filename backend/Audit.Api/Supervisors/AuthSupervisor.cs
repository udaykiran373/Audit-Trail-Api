using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.Repositories;

namespace Audit.Api.Supervisors;

/// <summary>
/// Provides supervisory logic for authentication operations, including user registration, login, and logout.
/// </summary>
    public class AuthSupervisor : IAuthSupervisor
    {
        private readonly IAuthRepository _authRepository;
        private readonly IAuditLogRepository _auditRepository;

        /// <summary>
        /// Initializes a new instance of the <see cref="AuthSupervisor"/> class.
        /// </summary>
        /// <param name="authRepository">The repository used for authentication data access.</param>
        /// <param name="auditRepository">The repository used for logging audit events.</param>
        public AuthSupervisor(IAuthRepository authRepository, IAuditLogRepository auditRepository)
        {
            _authRepository = authRepository;
            _auditRepository = auditRepository;
        }

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
        public async Task<(bool Success, string Message, string SessionId)> SignUpAsync(string username, string password, string userAgent, string ipAddress, string requestPath, string correlationId)
        {
            // Check if a user with the given username already exists
            if (await _authRepository.UserExistsAsync(username))
            {
                return (false, "Username already exists.", string.Empty);
            }

            // Initialize the new user object with trimmed credentials
            var newUser = new User
            {
                Username = username.Trim(),
                Password = password.Trim(),
                CreatedAt = DateTime.UtcNow
            };

            // Persist the new user to the database
            await _authRepository.CreateUserAsync(newUser);

            // Generate a unique session identifier for the newly registered user
            var uniqueSessionId = Guid.NewGuid().ToString();

            // Log the successful registration event
            await LogEventAsync(newUser.Username, "USER_REGISTERED", "SUCCESS", uniqueSessionId, userAgent, ipAddress, requestPath, correlationId, new Dictionary<string, object>
            {
                { "registeredUsername", newUser.Username }
            });

            return (true, "Registration successful.", uniqueSessionId);
        }

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
        public async Task<(bool Success, string Message, string SessionId, User? User)> LoginAsync(string username, string password, string userAgent, string ipAddress, string requestPath, string correlationId)
        {
            // Retrieve the user record from the repository
            var user = await _authRepository.GetUserByUsernameAsync(username);

            // Verify that the user exists and the provided password matches
            if (user == null || user.Password != password.Trim())
            {
                // Generate a distinct session ID to track the failed attempt
                var failedSessionId = "failed_" + Guid.NewGuid().ToString();

                // Log the failed login attempt
                await LogEventAsync(username, "LOGIN_FAILED", "FAILED", failedSessionId, userAgent, ipAddress, requestPath, correlationId, new Dictionary<string, object>
                {
                    { "usernameTried", username },
                    { "reason", "Invalid credentials" }
                });

                return (false, "Invalid username or password.", string.Empty, null);
            }

            // Generate a new session identifier for the successful login
            var uniqueSessionId = Guid.NewGuid().ToString();

            // Log the successful login event
            await LogEventAsync(user.Username, "LOGIN_SUCCESS", "SUCCESS", uniqueSessionId, userAgent, ipAddress, requestPath, correlationId, new Dictionary<string, object>
            {
                { "username", user.Username }
            });

            return (true, "Login successful.", uniqueSessionId, user);
        }

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
        public async Task LogoutAsync(string username, string sessionId, string userAgent, string ipAddress, string requestPath, string correlationId)
        {
            // Log the logout event
            await LogEventAsync(username, "LOGOUT", "SUCCESS", sessionId, userAgent, ipAddress, requestPath, correlationId, new Dictionary<string, object>
            {
                { "username", username }
            });
        }

        /// <summary>
        /// Helper method to create and record an audit log event.
        /// </summary>
        /// <param name="userId">The ID or username of the user associated with the event.</param>
        /// <param name="action">The action being performed.</param>
        /// <param name="status">The result status of the action (e.g., SUCCESS, FAILED).</param>
        /// <param name="sessionId">The session ID associated with the event.</param>
        /// <param name="userAgent">The client's user agent string.</param>
        /// <param name="ipAddress">The client's IP address.</param>
        /// <param name="requestPath">The path of the incoming request.</param>
        /// <param name="correlationId">The correlation ID for tracing the request.</param>
        /// <param name="metadata">Additional metadata related to the event.</param>
        /// <returns>A task that represents the asynchronous logging operation.</returns>
        private async Task LogEventAsync(string userId, string action, string status, string sessionId, string userAgent, string ipAddress, string requestPath, string correlationId, Dictionary<string, object> metadata)
        {
            // Construct the audit log entry with the provided context
            var log = new AuditLog
            {
                Timestamp = DateTime.UtcNow,
                UserId = userId,
                SessionId = sessionId,
                EventType = "Authentication",
                Module = action,
                Status = status,
                CorrelationId = correlationId,
                RequestPath = requestPath,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                Metadata = metadata
            };

            // Delegate the logging to the audit log repository
            await _auditRepository.InsertAsync(log);
        }
    }