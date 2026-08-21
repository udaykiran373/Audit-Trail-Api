using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Supervisors;

public interface IAuthSupervisor
{
    Task<(bool Success, string Message, string SessionId)> SignUpAsync(string username, string password, string userAgent, string ipAddress, string requestPath, string correlationId);
    Task<(bool Success, string Message, string SessionId, User? User)> LoginAsync(string username, string password, string userAgent, string ipAddress, string requestPath, string correlationId);
    Task LogoutAsync(string username, string sessionId, string userAgent, string ipAddress, string requestPath, string correlationId);
}