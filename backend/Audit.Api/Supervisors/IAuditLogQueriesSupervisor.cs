using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Supervisors;

/// <summary>
/// Provides supervisory operations for querying audit logs.
/// </summary>
public interface IAuditLogQueriesSupervisor
{
    /// <summary>
    /// Retrieves a paginated and filtered list of audit logs asynchronously.
    /// </summary>
    /// <param name="search">The search string to filter logs.</param>
    /// <param name="userId">The user ID to filter by.</param>
    /// <param name="sessionId">The session ID to filter by.</param>
    /// <param name="eventType">The event type to filter by.</param>
    /// <param name="status">The status to filter by.</param>
    /// <param name="module">The module to filter by.</param>
    /// <param name="correlationId">The correlation ID to filter by.</param>
    /// <param name="fromDate">The start date to filter by.</param>
    /// <param name="toDate">The end date to filter by.</param>
    /// <param name="page">The page number for pagination.</param>
    /// <param name="pageSize">The number of items per page.</param>
    /// <param name="sortBy">The field to sort the results by.</param>
    /// <param name="isAscending">Indicates whether the sort is ascending.</param>
    /// <returns>A task that represents the asynchronous operation. The task result contains a tuple with a list of audit logs and the total count.</returns>
    Task<object> GetFilteredLogsAsync(SearchFilters filters);
    Task<AuditLog?> GetLogByIdAsync(string id);
    Task<List<AuditLog>> GetTimelineAsync(string? userId, string? sessionId);
    Task<object> SearchNlpAsync(string query, SearchFilters standardFilters, string priority);
}
