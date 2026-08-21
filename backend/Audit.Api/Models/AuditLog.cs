using System;
using System.Collections.Generic;

namespace Audit.Api.Models;

public class AuditLog
{
    public string Id { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string? UserId { get; set; }
    public string SessionId { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string Module { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string CorrelationId { get; set; } = string.Empty;
    public string? RequestPath { get; set; }
    public string IpAddress { get; set; } = string.Empty;
    public string UserAgent { get; set; } = string.Empty;
    public Dictionary<string, object> Metadata { get; set; } = new();
}
