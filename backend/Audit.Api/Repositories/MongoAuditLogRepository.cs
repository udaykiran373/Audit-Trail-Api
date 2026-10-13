using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Audit.Api.Repositories;

/// <summary>
/// Data Access Layer for MongoDB, strictly executing database operations for audit logs without enforcing business rules.
/// </summary>
public class MongoAuditLogRepository : IAuditLogRepository
{
    private readonly MongoDbContext _context;

    /// <summary> Injects the scoped MongoDB context to establish a direct connection to the database. </summary>
    public MongoAuditLogRepository(MongoDbContext context)
    {
        _context = context;
    }

    /// <summary> Persists a fully validated AuditLog entity directly into the database. </summary>
    public async Task InsertAsync(AuditLog log)
    {
        // DATA ACCESS: Inserts the document without modification, trusting the Supervisor's validation.
        await _context.AuditLogs.InsertOneAsync(log);
    }

    /// <summary> Retrieves a specific log by ID, pre-validating the 24-character MongoDB ObjectId format to prevent database exceptions. </summary>
    public async Task<AuditLog?> GetByIdAsync(string id)
    {
        if (id.Length != 24) return null; // Quick format check before hitting the database
        return await _context.AuditLogs.Find(x => x.Id == id).FirstOrDefaultAsync();
    }

    /// <summary> Executes a paginated, sorted, and filtered query, running the total count and data retrieval in parallel for high performance. </summary>
    public async Task<(List<AuditLog> Items, long TotalCount)> GetFilteredAsync(
        string? search, string? userId, string? sessionId, string? eventType, string? status,
        string? module, string? correlationId, DateTime? fromDate, DateTime? toDate,
        int page, int pageSize, string sortBy, bool isAscending)
    {
        var filter = BuildFilter(search, userId, sessionId, eventType, status, module, correlationId, fromDate, toDate);
        var sortBuilder = Builders<AuditLog>.Sort;

        // DATA ACCESS: Supervisor guarantees 'sortBy' is not null, so we apply the native sort directly.
        SortDefinition<AuditLog> sort = isAscending
            ? sortBuilder.Ascending(sortBy)
            : sortBuilder.Descending(sortBy);

        var query = _context.AuditLogs.Find(filter);

        // ARCHITECTURE NOTE: Executes the Count and Fetch queries in parallel using Task.WhenAll to halve the database latency.
        var totalCountTask = query.CountDocumentsAsync();
        var itemsTask = query.Sort(sort)
                             .Skip((page - 1) * pageSize)
                             .Limit(pageSize)
                             .ToListAsync();

        await Task.WhenAll(totalCountTask, itemsTask);

        return (itemsTask.Result, totalCountTask.Result);
    }

    /// <summary> Fetches a chronological timeline of events for a user or session, trusting the Supervisor has already validated the inputs. </summary>
    public async Task<List<AuditLog>> GetTimelineAsync(string? userId, string? sessionId)
    {
        var builder = Builders<AuditLog>.Filter;
        FilterDefinition<AuditLog> filter;

        // DATA ACCESS: Builds a dynamic OR/AND filter based on provided identifiers.
        if (!string.IsNullOrWhiteSpace(userId) && !string.IsNullOrWhiteSpace(sessionId))
        {
            filter = builder.Or(
                builder.Eq(x => x.UserId, userId),
                builder.Eq(x => x.SessionId, sessionId)
            );
        }
        else if (!string.IsNullOrWhiteSpace(userId))
        {
            filter = builder.Eq(x => x.UserId, userId);
        }
        else
        {
            filter = builder.Eq(x => x.SessionId, sessionId);
        }

        // Retrieves the timeline using native MongoDB sorting for chronological accuracy.
        return await _context.AuditLogs.Find(filter)
                                       .SortBy(x => x.Timestamp)
                                       .ToListAsync();
    }

    /// <summary> Dynamically constructs a MongoDB filter definition, using Regex for text searches and strict equality for exact matches. </summary>
    private FilterDefinition<AuditLog> BuildFilter(
        string? search, string? userId, string? sessionId, string? eventType, string? status,
        string? module, string? correlationId, DateTime? fromDate, DateTime? toDate)
    {
        var builder = Builders<AuditLog>.Filter;
        var filter = builder.Empty;

        // Uses a case-insensitive Regex ("i") to scan multiple fields simultaneously for the search string.
        if (!string.IsNullOrWhiteSpace(search))
        {
            var regex = new BsonRegularExpression(search, "i");
            var searchFilter = builder.Or(
                builder.Regex(x => x.UserId, regex),
                builder.Regex(x => x.SessionId, regex),
                builder.Regex(x => x.EventType, regex),
                builder.Regex(x => x.Module, regex),
                builder.Regex(x => x.RequestPath, regex)
            );
            filter &= searchFilter;
        }

        // Appends exact-match filters iteratively
        if (!string.IsNullOrWhiteSpace(userId)) filter &= builder.Eq(x => x.UserId, userId);
        if (!string.IsNullOrWhiteSpace(sessionId)) filter &= builder.Eq(x => x.SessionId, sessionId);
        if (!string.IsNullOrWhiteSpace(eventType)) filter &= builder.Eq(x => x.EventType, eventType);
        if (!string.IsNullOrWhiteSpace(status)) filter &= builder.Eq(x => x.Status, status);
        if (!string.IsNullOrWhiteSpace(module)) filter &= builder.Eq(x => x.Module, module);
        if (!string.IsNullOrWhiteSpace(correlationId)) filter &= builder.Eq(x => x.CorrelationId, correlationId);

        // DATA ACCESS: Supervisor already converted dates to UTC, so we query the range directly.
        if (fromDate.HasValue) filter &= builder.Gte(x => x.Timestamp, fromDate.Value);
        if (toDate.HasValue) filter &= builder.Lte(x => x.Timestamp, toDate.Value);

        return filter;
    }
}