using System;
using System.Threading.Tasks;
using Audit.Api.Supervisors;
using Audit.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace Audit.Api.Controllers;

/// <summary>
/// The Presentation Layer (Controller) for Audit Logging.
/// Acts strictly as a "dumb router", delegating all business logic, validation, 
/// and data processing to the Supervisor layer to maintain a clean 3-Tier Architecture.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class AuditController : ControllerBase
{
    private readonly IAuditLogQueriesSupervisor _queries;
    private readonly IAuditLoggingSupervisor _loggingService;

    public AuditController(IAuditLogQueriesSupervisor queries, IAuditLoggingSupervisor loggingService)
    {
        _queries = queries;
        _loggingService = loggingService;
    }

    /// <summary>
    /// Retrieves a paginated list of audit logs based on standard UI filters.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetLogs([FromQuery] SearchFilters filters)
    {
        // Blindly passes the Data Transfer Object (DTO) to the Supervisor
        var result = await _queries.GetFilteredLogsAsync(filters);
        return Ok(result);
    }

    /// <summary>
    /// Retrieves a specific audit log by its unique ID.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetLogById(string id)
    {
        var log = await _queries.GetLogByIdAsync(id);
        if (log == null) return NotFound(new { Message = $"Audit log with ID {id} not found." });
        return Ok(log);
    }

    /// <summary>
    /// Retrieves the chronological event timeline for a specific user or session.
    /// </summary>
    [HttpGet("timeline")]
    public async Task<IActionResult> GetTimeline([FromQuery] string? userId, [FromQuery] string? sessionId)
    {
        // ARCHITECTURE NOTE: Validation (checking for empty IDs) is intentionally 
        // delegated to the Supervisor to keep the Controller free of business logic.
        var timeline = await _queries.GetTimelineAsync(userId, sessionId);
        return Ok(timeline);
    }

    /// <summary>
    /// Creates a new audit log. Extracts ambient HTTP context before delegating creation.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateLog([FromBody] AuditLog log)
    {
        // ARCHITECTURE NOTE: The HTTP layer is only responsible for extracting network-specific 
        // data. Entity validation (like missing SessionId) is handled by the Model/Supervisor.
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        var correlationId = HttpContext.Items.TryGetValue(Middleware.CorrelationIdMiddleware.CorrelationIdHeaderKey, out var cid)
            ? cid?.ToString()
            : null;

        var createdLog = await _loggingService.ProcessAndLogAsync(log, ipAddress, userAgent, correlationId);

        // Flags the context so middleware knows a log was successfully written
        HttpContext.Items["AuditLogWritten"] = true;
        return CreatedAtAction(nameof(GetLogById), new { id = createdLog.Id }, createdLog);
    }

    /// <summary>
    /// The entry point for the Composite Filter Pattern. Merges Natural Language intent 
    /// with standard UI filters.
    /// </summary>
    [HttpGet("search/nlp")]
    public async Task<IActionResult> NaturalLanguageSearch(
        [FromQuery] string query,
        [FromQuery] SearchFilters standardFilters,
        [FromQuery] string priority = "NLP")
    {
        // ARCHITECTURE NOTE: Bypasses manual string checks. If the query is empty, 
        // the Supervisor is smart enough to route it back to the standard UI filter pipeline.
        var response = await _queries.SearchNlpAsync(query, standardFilters, priority);
        return Ok(response);
    }
}