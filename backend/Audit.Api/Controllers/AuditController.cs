using System;
using System.Text;
using System.Threading.Tasks;
using Audit.Api.Supervisors;
using Audit.Api.Models;
using Audit.Api.Middleware;
using Microsoft.AspNetCore.Mvc;

namespace Audit.Api.Controllers;

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

    [HttpGet]
    public async Task<IActionResult> GetLogs(
        [FromQuery] string? search,
        [FromQuery] string? userId,
        [FromQuery] string? sessionId,
        [FromQuery] string? eventType,
        [FromQuery] string? status,
        [FromQuery] string? module,
        [FromQuery] string? correlationId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string sortBy = "Timestamp",
        [FromQuery] bool isAscending = false)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var (items, totalCount) = await _queries.GetFilteredLogsAsync(
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

        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return Ok(new
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetLogById(string id)
    {
        var log = await _queries.GetLogByIdAsync(id);
        if (log == null)
        {
            return NotFound(new { Message = $"Audit log with ID {id} not found." });
        }
        return Ok(log);
    }

    [HttpGet("timeline")]
    public async Task<IActionResult> GetTimeline([FromQuery] string? userId, [FromQuery] string? sessionId)
    {
        if (string.IsNullOrWhiteSpace(userId) && string.IsNullOrWhiteSpace(sessionId))
        {
            return BadRequest(new { Message = "Either UserId or SessionId must be provided to construct a timeline." });
        }

        var timeline = await _queries.GetTimelineAsync(userId, sessionId);
        return Ok(timeline);
    }

    [HttpPost]
    public async Task<IActionResult> CreateLog([FromBody] AuditLog log)
    {
        if (string.IsNullOrWhiteSpace(log.SessionId))
        {
            return BadRequest(new { Message = "SessionId is required." });
        }

        if (string.IsNullOrWhiteSpace(log.EventType))
        {
            return BadRequest(new { Message = "EventType is required." });
        }

        if (log.Timestamp == default) log.Timestamp = DateTime.UtcNow;
        if (string.IsNullOrWhiteSpace(log.IpAddress)) log.IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        if (string.IsNullOrWhiteSpace(log.UserAgent)) log.UserAgent = Request.Headers.UserAgent.ToString();

        if (string.IsNullOrWhiteSpace(log.CorrelationId))
        {
            log.CorrelationId = HttpContext.Items.TryGetValue(CorrelationIdMiddleware.CorrelationIdHeaderKey, out var cid)
                ? cid?.ToString() ?? Guid.NewGuid().ToString()
                : Guid.NewGuid().ToString();
        }

        // Clean System.Text.Json JsonElement types from metadata dictionary to prevent MongoDB serialization crash
        if (log.Metadata != null)
        {
            var cleanedMetadata = new System.Collections.Generic.Dictionary<string, object>();
            foreach (var kvp in log.Metadata)
            {
                cleanedMetadata[kvp.Key] = UnwrapJsonElement(kvp.Value) ?? "null";
            }
            log.Metadata = cleanedMetadata;
        }

        await _loggingService.LogAsync(log);
        // Indicate the controller created an audit entry for this request
        HttpContext.Items["AuditLogWritten"] = true;
        return CreatedAtAction(nameof(GetLogById), new { id = log.Id }, log);
    }

    private static object? UnwrapJsonElement(object? value)
    {
        if (value is System.Text.Json.JsonElement element)
        {
            switch (element.ValueKind)
            {
                case System.Text.Json.JsonValueKind.String:
                    return element.GetString();
                case System.Text.Json.JsonValueKind.Number:
                    if (element.TryGetInt64(out long l)) return l;
                    return element.GetDouble();
                case System.Text.Json.JsonValueKind.True:
                    return true;
                case System.Text.Json.JsonValueKind.False:
                    return false;
                case System.Text.Json.JsonValueKind.Null:
                    return null;
                case System.Text.Json.JsonValueKind.Object:
                    var dict = new System.Collections.Generic.Dictionary<string, object?>();
                    foreach (var prop in element.EnumerateObject())
                    {
                        dict[prop.Name] = UnwrapJsonElement(prop.Value);
                    }
                    return dict;
                case System.Text.Json.JsonValueKind.Array:
                    var list = new System.Collections.Generic.List<object?>();
                    foreach (var item in element.EnumerateArray())
                    {
                        list.Add(UnwrapJsonElement(item));
                    }
                    return list;
            }
        }
        return value;
    }
}
