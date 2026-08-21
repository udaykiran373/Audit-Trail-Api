using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Supervisors;
using Audit.Api.Models;
using Microsoft.AspNetCore.Http;

namespace Audit.Api.Middleware;

public class AuditLoggingMiddleware
{
    private readonly RequestDelegate _next;

    public AuditLoggingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IAuditLoggingSupervisor auditLoggingService)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        // Skip logging for read queries or dashboard components to prevent infinite recursion loop
        bool shouldSkipAutoLogging = path.StartsWith("/api/audit", StringComparison.OrdinalIgnoreCase) ||
                                     path.Equals("/") ||
                                     path.Contains(".") ||
                                     context.Request.Method.Equals("OPTIONS", StringComparison.OrdinalIgnoreCase);

        if (shouldSkipAutoLogging)
        {
            await _next(context);
            return;
        }

        var timestamp = DateTime.UtcNow;
        var correlationId = context.Items.TryGetValue(CorrelationIdMiddleware.CorrelationIdHeaderKey, out var val)
            ? val?.ToString() ?? Guid.NewGuid().ToString()
            : Guid.NewGuid().ToString();

        context.Request.Headers.TryGetValue("X-Session-ID", out var sessionIdHeader);
        context.Request.Headers.TryGetValue("X-User-ID", out var userIdHeader);

        var sessionId = sessionIdHeader.ToString();
        var userId = !string.IsNullOrWhiteSpace(userIdHeader.ToString()) ? userIdHeader.ToString() : null;

        // Fallback: Use cookie if X-User-ID header is not present
        if (string.IsNullOrWhiteSpace(userId))
        {
            if (context.Request.Cookies.TryGetValue("AuditSession", out var cookieUser) && !string.IsNullOrWhiteSpace(cookieUser))
            {
                userId = cookieUser;
            }
        }

        if (string.IsNullOrWhiteSpace(sessionId))
        {
            sessionId = !string.IsNullOrWhiteSpace(userId) ? $"sess_{userId}" : "Anonymous-Session";
        }

        context.Items["SessionId"] = sessionId;

        Exception? exception = null;
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            exception = ex;
            throw;
        }
        finally
        {
            // Only perform middleware logging when an audit wasn't written by downstream components.
            if (!context.Items.ContainsKey("AuditLogWritten"))
            {
                var status = exception != null || context.Response.StatusCode >= 500 ? "FAILED" : "SUCCESS";

                var eventType = "API_CALL";
                if (exception != null || context.Response.StatusCode >= 500)
                {
                    eventType = "ERROR";
                }
                else if (context.Response.StatusCode >= 400)
                {
                    eventType = "API_FAILURE";
                }

                var module = "API";
                if (path.Contains("/simulation/"))
                {
                    module = "Simulation";
                    eventType = "BUSINESS_EVENT";
                }

                var action = $"{context.Request.Method} {path}";

                var metadata = new Dictionary<string, object>
            {
                { "StatusCode", context.Response.StatusCode },
                { "QueryString", context.Request.QueryString.ToString() }
            };

                if (exception != null)
                {
                    metadata["ExceptionType"] = exception.GetType().FullName ?? "UnknownException";
                    metadata["ExceptionMessage"] = exception.Message;
                    metadata["StackTrace"] = exception.StackTrace ?? string.Empty;
                }

                var ip = context.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
                var ua = context.Request.Headers.UserAgent.ToString();

                var auditLog = new AuditLog
                {
                    Timestamp = timestamp,
                    UserId = userId,
                    SessionId = sessionId,
                    EventType = eventType,
                    Module = module,
                    Action = action,
                    Status = status,
                    CorrelationId = correlationId,
                    RequestPath = path,
                    IpAddress = ip,
                    UserAgent = ua,
                    Metadata = metadata
                };

                try
                {
                    await auditLoggingService.LogAsync(auditLog);
                }
                catch
                {
                    // Prevent failures in audit database from crashing the web request
                }
            }
        }
    }
}
