using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Supervisors;

public interface IAuditLogQueriesSupervisor
{
    Task<(List<AuditLog> Items, long TotalCount)> GetFilteredLogsAsync(
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

    Task<AuditLog?> GetLogByIdAsync(string id);

    Task<List<AuditLog>> GetTimelineAsync(string? userId, string? sessionId);
}
