using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Supervisors;

/// <summary>
/// Defines the contract for audit logging supervisory operations.
/// </summary>
public interface IAuditLoggingSupervisor
{
    /// <summary>
    /// Logs an audit event asynchronously.
    /// </summary>
    /// <param name="log">The audit log model to be recorded.</param>
    /// <returns>A task that represents the asynchronous operation.</returns>
    Task LogAsync(AuditLog log);
    Task<AuditLog> ProcessAndLogAsync(AuditLog log, string? ipAddress, string? userAgent, string? correlationId);
}
