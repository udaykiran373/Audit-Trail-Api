using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.Repositories;

namespace Audit.Api.Supervisors;

/// <summary>
/// The Business Logic Layer (Supervisor) for writing and processing audit logs.
/// This class ensures all incoming logs are validated, sanitized, and enriched with 
/// system defaults before they are handed off to the Data Access Layer (Repository).
/// </summary>
public class AuditLoggingSupervisor : IAuditLoggingSupervisor
{
    private readonly IAuditLogRepository _repository;

    /// <summary>
    /// Initializes a new instance of the <see cref="AuditLoggingSupervisor"/> class.
    /// </summary>
    /// <param name="repository">The data access layer used for audit log persistence.</param>
    public AuditLoggingSupervisor(IAuditLogRepository repository)
    {
        _repository = repository;
    }

    /// <summary>
    /// Normalizes the timestamp and persists the audit event asynchronously.
    /// </summary>
    /// <param name="log">The audit log model containing event details.</param>
    public async Task LogAsync(AuditLog log)
    {
        // BUSINESS LOGIC: Ensure all logs are strictly saved in UTC time
        if (log.Timestamp == default)
        {
            log.Timestamp = DateTime.UtcNow;
        }
        else if (log.Timestamp.Kind != DateTimeKind.Utc)
        {
            log.Timestamp = log.Timestamp.ToUniversalTime();
        }

        // Delegate persistence to the Repository
        await _repository.InsertAsync(log);
    }

    /// <summary>
    /// The primary orchestration method for new logs. It enforces business rules, 
    /// applies default fallbacks from the HTTP context, and sanitizes complex JSON metadata.
    /// </summary>
    public async Task<AuditLog> ProcessAndLogAsync(AuditLog log, string? ipAddress, string? userAgent, string? correlationId)
    {
        // BUSINESS LOGIC: Validate strict domain requirements
        // (Moved here from the Controller to keep the HTTP layer "dumb")
        if (string.IsNullOrWhiteSpace(log.SessionId))
            throw new ArgumentException("SessionId is required.");

        if (string.IsNullOrWhiteSpace(log.EventType))
            throw new ArgumentException("EventType is required.");

        // BUSINESS LOGIC: Apply intelligent defaults for missing environmental data
        if (log.Timestamp == default) log.Timestamp = DateTime.UtcNow;
        if (string.IsNullOrWhiteSpace(log.IpAddress)) log.IpAddress = ipAddress ?? "127.0.0.1";
        if (string.IsNullOrWhiteSpace(log.UserAgent)) log.UserAgent = userAgent ?? string.Empty;

        // Ensure every request can be traced across microservices
        if (string.IsNullOrWhiteSpace(log.CorrelationId))
        {
            log.CorrelationId = correlationId ?? Guid.NewGuid().ToString();
        }

        // BUSINESS LOGIC: Sanitize dynamic metadata payload
        if (log.Metadata != null)
        {
            var cleanedMetadata = new System.Collections.Generic.Dictionary<string, object>();
            foreach (var kvp in log.Metadata)
            {
                // Unwrap ASP.NET JsonElements into native C# types so the Repository 
                // (MongoDB or File System) can serialize them cleanly
                cleanedMetadata[kvp.Key] = UnwrapJsonElement(kvp.Value) ?? "null";
            }
            log.Metadata = cleanedMetadata;
        }

        // Proceed to final normalization and database insertion
        await LogAsync(log);
        return log;
    }

    /// <summary>
    /// Recursively unwraps System.Text.Json.JsonElement objects into native C# primitives.
    /// This prevents serialization errors when passing dynamic dictionary objects to MongoDB or File writers.
    /// </summary>
    private static object? UnwrapJsonElement(object? value)
    {
        if (value is System.Text.Json.JsonElement element)
        {
            switch (element.ValueKind)
            {
                case System.Text.Json.JsonValueKind.String:
                    return element.GetString();

                case System.Text.Json.JsonValueKind.Number:
                    if (element.TryGetInt64(out long l)) return l;
                    return element.GetDouble();

                case System.Text.Json.JsonValueKind.True:
                    return true;

                case System.Text.Json.JsonValueKind.False:
                    return false;

                case System.Text.Json.JsonValueKind.Null:
                    return null;

                case System.Text.Json.JsonValueKind.Object:
                    var dict = new System.Collections.Generic.Dictionary<string, object?>();
                    foreach (var prop in element.EnumerateObject())
                    {
                        dict[prop.Name] = UnwrapJsonElement(prop.Value);
                    }
                    return dict;

                case System.Text.Json.JsonValueKind.Array:
                    var list = new System.Collections.Generic.List<object?>();
                    foreach (var item in element.EnumerateArray())
                    {
                        list.Add(UnwrapJsonElement(item));
                    }
                    return list;
            }
        }
        return value;
    }
}