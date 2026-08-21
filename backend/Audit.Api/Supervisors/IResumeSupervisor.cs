using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Supervisors;

public interface IResumeSupervisor
{
    // UPDATED: Now requires audit and session tracking parameters
    Task<Resume?> GetResumeAsync(string targetUsername, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);
    Task<Resume> SaveResumeAsync(Resume resume, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);
}
