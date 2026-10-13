using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.Repositories;
using Audit.Api.Services;

namespace Audit.Api.Supervisors;

/// <summary>
/// The Business Logic Layer (Supervisor) for handling audit log retrieval and searches.
/// This class acts as the brain of the operation, ensuring the Data Access Layer (Repository)
/// only receives sanitized, validated, and properly formatted data (like UTC dates and valid pagination).
/// </summary>
public class AuditLogQueriesSupervisor : IAuditLogQueriesSupervisor
{
    private readonly IAuditLogRepository _repository;
    private readonly NlpQueryParser _nlpParser;

    /// <summary>   
    /// Initializes a new instance of the Supervisor, injecting the required repository and external AI parser.
    /// </summary>
    public AuditLogQueriesSupervisor(IAuditLogRepository repository, NlpQueryParser nlpParser)
    {
        _repository = repository;
        _nlpParser = nlpParser;
    }

    /// <summary>
    /// Retrieves a paginated, filtered list of audit logs based on standard UI inputs.
    /// </summary>
    public async Task<object> GetFilteredLogsAsync(SearchFilters filters)
    {
        // BUSINESS LOGIC: Enforce UTC Dates and Default Sorting before hitting the DB
        if (filters.FromDate.HasValue) filters.FromDate = filters.FromDate.Value.ToUniversalTime();
        if (filters.ToDate.HasValue) filters.ToDate = filters.ToDate.Value.ToUniversalTime();
        filters.SortBy = string.IsNullOrWhiteSpace(filters.SortBy) ? "Timestamp" : filters.SortBy;

        // BUSINESS LOGIC: Ensure pagination stays within safe boundaries to prevent database strain
        int page = filters.Page < 1 ? 1 : filters.Page;
        int pageSize = filters.PageSize < 1 || filters.PageSize > 100 ? 20 : filters.PageSize;

        // Hand off the sanitized parameters to the Repository
        var (items, totalCount) = await _repository.GetFilteredAsync(
            filters.Search,
            filters.UserId,
            filters.SessionId,
            filters.EventType,
            filters.Status,
            filters.Module,
            filters.CorrelationId,
            filters.FromDate,
            filters.ToDate,
            page,
            pageSize,
            filters.SortBy,
            filters.IsAscending);


        return new
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
        };
    }

    /// <summary>
    /// Retrieves a specific audit log by its unique identifier.
    /// </summary>
    public Task<AuditLog?> GetLogByIdAsync(string id)
    {
        return _repository.GetByIdAsync(id);
    }

    /// <summary>
    /// Retrieves a chronological timeline of events for a given user or session.
    /// </summary>
    public Task<List<AuditLog>> GetTimelineAsync(string? userId, string? sessionId)
    {
        // BUSINESS LOGIC: Early Exit Validation
        // Prevents unnecessary database queries if no valid identifiers are provided.
        if (string.IsNullOrWhiteSpace(userId) && string.IsNullOrWhiteSpace(sessionId))
        {
            return Task.FromResult(new List<AuditLog>());
        }

        return _repository.GetTimelineAsync(userId, sessionId);
    }

    /// <summary>
    /// Orchestrates a hybrid search by merging Natural Language AI parsing with standard UI dropdowns.
    /// Resolves conflicts using a Chronological Priority flag.
    /// </summary>
    public async Task<object> SearchNlpAsync(string query, SearchFilters standardFilters, string priority)
    {
        // BUSINESS LOGIC: If the NLP text is empty, just run a standard UI filter search!
        if (string.IsNullOrWhiteSpace(query))
            return await GetFilteredLogsAsync(standardFilters);

        // 1. Parse the Natural Language Query into structured domain filters via AI
        var aiParsedFilters = await _nlpParser.ParseNaturalLanguageAsync(query);

        // 2. The Smart Resolver & Sanitizer (Local Delegate Function)
        // This acts as the referee when deciding whether the UI or the AI value wins.
        string? Resolve(string? uiValue, string? aiValue)
        {
            // Sanitization: If the React UI or AI sends generic default words, nullify them 
            // so they don't corrupt the database query.
            if (uiValue != null && (uiValue.Equals("All", StringComparison.OrdinalIgnoreCase) || uiValue.Equals("Any", StringComparison.OrdinalIgnoreCase)))
                uiValue = null;

            if (aiValue != null && (aiValue.Equals("All", StringComparison.OrdinalIgnoreCase) || aiValue.Equals("Any", StringComparison.OrdinalIgnoreCase)))
                aiValue = null;

            // Tie-Breaker Logic based on Priority flag (what the user clicked last)
            // If NLP was clicked last, favor the AI value. If empty, fall back to UI.
            if (priority == "NLP") return !string.IsNullOrWhiteSpace(aiValue) ? aiValue : uiValue;

            // If a Dropdown was clicked last, favor the UI value. If empty, fall back to AI.
            return !string.IsNullOrWhiteSpace(uiValue) ? uiValue : aiValue;
        }

        // Dedicated resolver for DateTimes, utilizing null-coalescing for fallbacks based on priority
        DateTime? ResolveDate(DateTime? uiValue, DateTime? aiValue)
        {
            if (priority == "NLP") return aiValue ?? uiValue;
            return uiValue ?? aiValue;
        }

        // 3. Merge all properties cleanly across both input domains using the Resolvers
        var finalEventType = Resolve(standardFilters.EventType, aiParsedFilters.EventType);
        var finalModule = Resolve(standardFilters.Module, aiParsedFilters.Module);
        var finalStatus = Resolve(standardFilters.Status, aiParsedFilters.Status);
        var finalUserId = Resolve(standardFilters.UserId, aiParsedFilters.UserId);
        var finalSearch = Resolve(standardFilters.Search, aiParsedFilters.Action);

        // BUSINESS LOGIC: Convert resolved, winning dates to UTC
        var finalFromDate = ResolveDate(standardFilters.FromDate, aiParsedFilters.FromDate)?.ToUniversalTime();
        var finalToDate = ResolveDate(standardFilters.ToDate, aiParsedFilters.ToDate)?.ToUniversalTime();

        // Enforce default sorting and pagination boundaries on the merged result
        standardFilters.SortBy = string.IsNullOrWhiteSpace(standardFilters.SortBy) ? "Timestamp" : standardFilters.SortBy;
        int page = standardFilters.Page > 0 ? standardFilters.Page : 1;
        int pageSize = standardFilters.PageSize > 0 ? standardFilters.PageSize : 15;

        // 4. Query the Database with the pristine, merged, and validated filters
        var result = await _repository.GetFilteredAsync(
            search: finalSearch,
            userId: finalUserId,
            sessionId: standardFilters.SessionId,
            eventType: finalEventType,
            status: finalStatus,
            module: finalModule,
            correlationId: standardFilters.CorrelationId,
            fromDate: finalFromDate,
            toDate: finalToDate,
            page: page,
            pageSize: pageSize,
            sortBy: standardFilters.SortBy,
            isAscending: standardFilters.IsAscending
        );

        // 5. Return formatted DTO
        // By using null-coalescing (?? ""), we ensure empty fields are explicitly sent as empty strings.
        // This guarantees complete visibility in the browser's Network Tab for debugging the AI's decisions.
        return new
        {
            data = result.Items,
            totalCount = result.TotalCount,
            currentPage = page,
            totalPages = (int)Math.Ceiling((double)result.TotalCount / pageSize),

            parsedUnderstanding = new
            {
                module = finalModule ?? "",
                eventType = finalEventType ?? "",
                status = finalStatus ?? "",
                action = aiParsedFilters.Action ?? "",
                userId = finalUserId ?? "",
                fromDate = finalFromDate,
                toDate = finalToDate
            }
        };
    }
}