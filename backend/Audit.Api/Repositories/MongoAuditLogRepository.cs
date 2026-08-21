using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Audit.Api.Repositories;

public class MongoAuditLogRepository : IAuditLogRepository
{
    private readonly MongoDbContext _context;

    public MongoAuditLogRepository(MongoDbContext context)
    {
        _context = context;
    }

    public async Task InsertAsync(AuditLog log)
    {
        await _context.AuditLogs.InsertOneAsync(log);
    }

    public async Task<AuditLog?> GetByIdAsync(string id)
    {
        if (id.Length != 24) return null;
        return await _context.AuditLogs.Find(x => x.Id == id).FirstOrDefaultAsync();
    }

    public async Task<(List<AuditLog> Items, long TotalCount)> GetFilteredAsync(
        string? search,
        string? userId,
        string? sessionId,
        string? eventType,
        string? status,
        string? module,
        string? correlationId,
        DateTime? fromDate,
        DateTime? toDate,
        int page,
        int pageSize,
        string sortBy,
        bool isAscending)
    {
        var filter = BuildFilter(search, userId, sessionId, eventType, status, module, correlationId, fromDate, toDate);

        var sortBuilder = Builders<AuditLog>.Sort;
        SortDefinition<AuditLog> sort = isAscending 
            ? sortBuilder.Ascending(sortBy) 
            : sortBuilder.Descending(sortBy);

        if (string.IsNullOrWhiteSpace(sortBy))
        {
            sort = sortBuilder.Descending(x => x.Timestamp);
        }

        var query = _context.AuditLogs.Find(filter);

        var totalCountTask = query.CountDocumentsAsync();
        var itemsTask = query.Sort(sort)
                             .Skip((page - 1) * pageSize)
                             .Limit(pageSize)
                             .ToListAsync();

        await Task.WhenAll(totalCountTask, itemsTask);

        return (itemsTask.Result, totalCountTask.Result);
    }

    public async Task<List<AuditLog>> GetTimelineAsync(string? userId, string? sessionId)
    {
        var builder = Builders<AuditLog>.Filter;
        FilterDefinition<AuditLog> filter;

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
        else if (!string.IsNullOrWhiteSpace(sessionId))
        {
            filter = builder.Eq(x => x.SessionId, sessionId);
        }
        else
        {
            return new List<AuditLog>();
        }

        return await _context.AuditLogs.Find(filter)
                                       .SortBy(x => x.Timestamp)
                                       .ToListAsync();
    }


    private FilterDefinition<AuditLog> BuildFilter(
        string? search,
        string? userId,
        string? sessionId,
        string? eventType,
        string? status,
        string? module,
        string? correlationId,
        DateTime? fromDate,
        DateTime? toDate)
    {
        var builder = Builders<AuditLog>.Filter;
        var filter = builder.Empty;

        if (!string.IsNullOrWhiteSpace(search))
        {
            var regex = new BsonRegularExpression(search, "i");
            var searchFilter = builder.Or(
                builder.Regex(x => x.Action, regex),
                builder.Regex(x => x.UserId, regex),
                builder.Regex(x => x.SessionId, regex),
                builder.Regex(x => x.EventType, regex),
                builder.Regex(x => x.Module, regex),
                builder.Regex(x => x.RequestPath, regex)
            );
            filter &= searchFilter;
        }

        if (!string.IsNullOrWhiteSpace(userId))
        {
            filter &= builder.Eq(x => x.UserId, userId);
        }

        if (!string.IsNullOrWhiteSpace(sessionId))
        {
            filter &= builder.Eq(x => x.SessionId, sessionId);
        }

        if (!string.IsNullOrWhiteSpace(eventType))
        {
            filter &= builder.Eq(x => x.EventType, eventType);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            filter &= builder.Eq(x => x.Status, status);
        }

        if (!string.IsNullOrWhiteSpace(module))
        {
            filter &= builder.Eq(x => x.Module, module);
        }

        if (!string.IsNullOrWhiteSpace(correlationId))
        {
            filter &= builder.Eq(x => x.CorrelationId, correlationId);
        }

        if (fromDate.HasValue)
        {
            filter &= builder.Gte(x => x.Timestamp, fromDate.Value.ToUniversalTime());
        }

        if (toDate.HasValue)
        {
            filter &= builder.Lte(x => x.Timestamp, toDate.Value.ToUniversalTime());
        }

        return filter;
    }
}
