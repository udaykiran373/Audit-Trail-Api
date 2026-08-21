using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.Repositories;

namespace Audit.Api.Supervisors;

public class AuditLogQueriesSupervisor : IAuditLogQueriesSupervisor
{
    private readonly IAuditLogRepository _repository;

    public AuditLogQueriesSupervisor(IAuditLogRepository repository)
    {
        _repository = repository;
    }

    public Task<(List<AuditLog> Items, long TotalCount)> GetFilteredLogsAsync(
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
        return _repository.GetFilteredAsync(
            search,
            userId,
            sessionId,
            eventType,
            status,
            module,
            correlationId,
            fromDate,
            toDate,
            page,
            pageSize,
            sortBy,
            isAscending);
    }

    public Task<AuditLog?> GetLogByIdAsync(string id)
    {
        return _repository.GetByIdAsync(id);
    }

    public Task<List<AuditLog>> GetTimelineAsync(string? userId, string? sessionId)
    {
        return _repository.GetTimelineAsync(userId, sessionId);
    }
}
