using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Repositories;

public interface IAuditLogRepository
{
    Task InsertAsync(AuditLog log);
    Task<AuditLog?> GetByIdAsync(string id);
    Task<(List<AuditLog> Items, long TotalCount)> GetFilteredAsync(
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
        bool isAscending);
    Task<List<AuditLog>> GetTimelineAsync(string? userId, string? sessionId);
}
