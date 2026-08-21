using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Supervisors;

public interface IAuditLoggingSupervisor
{
    Task LogAsync(AuditLog log);
}
