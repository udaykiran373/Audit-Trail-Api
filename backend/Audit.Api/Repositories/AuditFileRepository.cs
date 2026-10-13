using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Repositories;

/// <summary>
/// A thread-safe, file-based implementation of the IAuditLogRepository.
/// This acts as the Data Access Layer (DAL), persisting audit logs to a local JSON-lines file.
/// It strictly executes queries and relies on the Supervisor layer for all business logic and data validation.
/// </summary>
public class AuditFileRepository : IAuditLogRepository
{
    /// <summary>
    /// The absolute file path where the audit logs are stored.
    /// </summary>
    private readonly String _logPathFile;

    /// <summary>
    /// A lightweight synchronization primitive to ensure thread safety 
    /// during concurrent read/write operations on the log file.
    /// </summary>
    private static readonly SemaphoreSlim _fileLock = new SemaphoreSlim(1, 1);

    /// <summary>
    /// Initializes a new instance of the <see cref="AuditFileRepository"/> class.
    /// Automatically provisions the "logs" directory and target file if they do not exist.
    /// </summary>
    public AuditFileRepository()
    {
        var logDir = Path.Combine(Directory.GetCurrentDirectory(), "logs");

        // Ensure the directory exists before attempting any file operations
        if (!Directory.Exists(logDir))
        {
            Directory.CreateDirectory(logDir);
        }

        _logPathFile = Path.Combine(logDir, "audit.log");
    }

    /// <summary>
    /// Appends a new audit log entry to the file asynchronously.
    /// </summary>
    /// <param name="log">The audit log entity to persist.</param>
    public async Task InsertAsync(AuditLog log)
    {
        // Auto-generate a unique identifier if one was not provided
        if (string.IsNullOrEmpty(log.Id))
        {
            log.Id = Guid.NewGuid().ToString();
        }

        // Serialize the object to a single line of JSON (JSON-Lines format)
        var jsonLine = JsonSerializer.Serialize(log) + Environment.NewLine;

        // Lock the file to prevent corruption from concurrent HTTP requests writing simultaneously
        await _fileLock.WaitAsync();
        try
        {
            await File.AppendAllTextAsync(_logPathFile, jsonLine);
        }
        finally
        {
            // Always release the lock, even if an exception occurs
            _fileLock.Release();
        }
    }

    /// <summary>
    /// Retrieves a single audit log by its unique identifier.
    /// </summary>
    /// <param name="id">The unique GUID string of the log.</param>
    /// <returns>The matching AuditLog, or null if not found.</returns>
    public async Task<AuditLog?> GetByIdAsync(String id)
    {
        var logs = await ReadAllLogsAsync();
        return logs.FirstOrDefault(x => x.Id == id);
    }

    /// <summary>
    /// Retrieves a paginated, filtered, and sorted list of audit logs.
    /// Assumes all business logic (e.g., UTC conversion, default sorting) has already been applied by the Supervisor.
    /// </summary>
    public async Task<(List<AuditLog> Items, long TotalCount)> GetFilteredAsync(
        string? search, string? userId, string? sessionId, string? eventType,
        string? status, string? module, string? correlationId,
        DateTime? fromDate, DateTime? toDate,
        int page, int pageSize, string sortBy, bool isAscending)
    {
        var logs = await ReadAllLogsAsync();
        var query = logs.AsQueryable();

        // 1. Apply generic multi-field text search
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                (x.UserId != null && x.UserId.Contains(search, StringComparison.OrdinalIgnoreCase)) ||
                (x.SessionId != null && x.SessionId.Contains(search, StringComparison.OrdinalIgnoreCase)) ||
                (x.EventType != null && x.EventType.Contains(search, StringComparison.OrdinalIgnoreCase)) ||
                (x.Module != null && x.Module.Contains(search, StringComparison.OrdinalIgnoreCase)) ||
                (x.RequestPath != null && x.RequestPath.Contains(search, StringComparison.OrdinalIgnoreCase))
            );
        }

        // 2. Apply strict exact-match filters
        if (!string.IsNullOrWhiteSpace(userId)) query = query.Where(x => x.UserId == userId);
        if (!string.IsNullOrWhiteSpace(sessionId)) query = query.Where(x => x.SessionId == sessionId);
        if (!string.IsNullOrWhiteSpace(eventType)) query = query.Where(x => x.EventType == eventType);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        if (!string.IsNullOrWhiteSpace(module)) query = query.Where(x => x.Module == module);
        if (!string.IsNullOrWhiteSpace(correlationId)) query = query.Where(x => x.CorrelationId == correlationId);

        // 3. Apply timestamp boundary filters 
        // (Architectural Note: Supervisor guarantees these are already in UTC)
        if (fromDate.HasValue) query = query.Where(x => x.Timestamp >= fromDate.Value);
        if (toDate.HasValue) query = query.Where(x => x.Timestamp <= toDate.Value);

        // 4. Apply dynamic sorting 
        // (Architectural Note: Supervisor guarantees sortBy is populated, no fallback needed here)
        if (sortBy.Equals("Timestamp", StringComparison.OrdinalIgnoreCase))
            query = isAscending ? query.OrderBy(x => x.Timestamp) : query.OrderByDescending(x => x.Timestamp);
        else
            query = isAscending ? query.OrderBy(x => x.Module) : query.OrderByDescending(x => x.Module);

        // 5. Execute count query before applying pagination
        var totalCount = query.Count();

        // 6. Apply pagination (Skip & Take) and materialize the list
        var items = query.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return (items, totalCount);
    }

    /// <summary>
    /// Retrieves a chronological timeline of events for a specific user or session.
    /// Assumes the Supervisor has already validated that at least one ID is provided.
    /// </summary>
    public async Task<List<AuditLog>> GetTimelineAsync(string? userId, string? sessionId)
    {
        var logs = await ReadAllLogsAsync();
        var query = logs.AsQueryable();

        // Filter based on which identifiers were provided by the Supervisor
        if (!string.IsNullOrWhiteSpace(userId) && !string.IsNullOrWhiteSpace(sessionId))
        {
            query = query.Where(x => x.UserId == userId || x.SessionId == sessionId);
        }
        else if (!string.IsNullOrWhiteSpace(userId))
        {
            query = query.Where(x => x.UserId == userId);
        }
        else
        {
            query = query.Where(x => x.SessionId == sessionId);
        }

        // Timeline data must always strictly adhere to chronological ascending order
        return query.OrderBy(x => x.Timestamp).ToList();
    }

    /// <summary>
    /// Safely reads and deserializes all log entries from the physical file.
    /// Employs fault-tolerance to skip corrupted JSON lines without crashing the application.
    /// </summary>
    /// <returns>A materialized list of valid AuditLog objects.</returns>
    private async Task<List<AuditLog>> ReadAllLogsAsync()
    {
        var logs = new List<AuditLog>();

        // Return empty list if the file hasn't been created yet
        if (!File.Exists(_logPathFile)) return logs;

        string[] lines;

        // Lock the file during read to prevent reading while another thread is writing
        await _fileLock.WaitAsync();
        try
        {
            lines = await File.ReadAllLinesAsync(_logPathFile);
        }
        finally
        {
            _fileLock.Release();
        }

        // Deserialize each line independently
        foreach (var line in lines)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;

            try
            {
                var log = JsonSerializer.Deserialize<AuditLog>(line);
                if (log != null)
                {
                    logs.Add(log);
                }
            }
            catch
            {
                // Fault tolerance: Skip gracefully if a single line is corrupted
                // This prevents a single bad write from breaking the entire audit system
            }
        }

        return logs;
    }
}