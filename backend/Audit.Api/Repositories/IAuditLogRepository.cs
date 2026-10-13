using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Repositories;

public interface IAuditLogRepository
{
    /// <summary>
    /// Inserts a new audit log into the repository.
    /// </summary>
    /// <param name="log">The audit log to insert.</param>
    /// <returns>A task that represents the asynchronous operation.</returns>
    Task InsertAsync(AuditLog log);

    /// <summary>
    /// Retrieves an audit log by its unique identifier.
    /// </summary>
    /// <param name="id">The unique identifier of the audit log.</param>
    /// <returns>A task that represents the asynchronous operation. The task result contains the audit log if found; otherwise, null.</returns>
    Task<AuditLog?> GetByIdAsync(string id);

    /// <summary>
    /// Retrieves a paginated and filtered list of audit logs.
    /// </summary>
    /// <param name="search">A search term to filter logs.</param>
    /// <param name="userId">The ID of the user to filter by.</param>
    /// <param name="sessionId">The session ID to filter by.</param>
    /// <param name="eventType">The type of event to filter by.</param>
    /// <param name="status">The status to filter by.</param>
    /// <param name="module">The module to filter by.</param>
    /// <param name="correlationId">The correlation ID to filter by.</param>
    /// <param name="fromDate">The start date for the filter.</param>
    /// <param name="toDate">The end date for the filter.</param>
    /// <param name="page">The page number for pagination.</param>
    /// <param name="pageSize">The number of items per page.</param>
    /// <param name="sortBy">The field to sort by.</param>
    /// <param name="isAscending">Whether the sort order should be ascending.</param>
    /// <returns>A task that represents the asynchronous operation. The task result contains a tuple with a list of items and the total count.</returns>
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

    /// <summary>
    /// Retrieves a chronological timeline of audit logs for a given user or session.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="sessionId">The session ID.</param>
    /// <returns>A task that represents the asynchronous operation. The task result contains a list of audit logs.</returns>
    Task<List<AuditLog>> GetTimelineAsync(string? userId, string? sessionId);
}
