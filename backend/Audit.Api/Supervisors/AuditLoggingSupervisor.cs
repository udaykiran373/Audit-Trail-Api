using System;
using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.Repositories;

namespace Audit.Api.Supervisors;

public class AuditLoggingSupervisor : IAuditLoggingSupervisor
{
    private readonly IAuditLogRepository _repository;

    public AuditLoggingSupervisor(IAuditLogRepository repository)
    {
        _repository = repository;
    }

    public async Task LogAsync(AuditLog log)
    {
        if (log.Timestamp == default)
        {
            log.Timestamp = DateTime.UtcNow;
        }
        else if (log.Timestamp.Kind != DateTimeKind.Utc)
        {
            log.Timestamp = log.Timestamp.ToUniversalTime();
        }

        await _repository.InsertAsync(log);
    }
}
