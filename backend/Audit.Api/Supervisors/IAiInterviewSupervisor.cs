using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.DTOs;

namespace Audit.Api.Supervisors
{
    public interface IAiInterviewSupervisor
    {
        Task<object> SubmitInterviewAsync(string username, string role, string question, string? transcript, int warningsCount, string? warningsLogJson, Microsoft.AspNetCore.Http.IFormFile? videoFile, string ipAddress, string userAgent, string correlationId, string sessionId, string requestPath);
        Task<List<AiInterview>> GetHistoryByUsernameAsync(string username);
        Task LogViewAsync(string username, string ipAddress, string userAgent, string correlationId, string sessionId, string requestPath);
        Task LogPermissionsAsync(PermissionsPayload payload, string username, string ipAddress, string userAgent, string correlationId, string sessionId, string requestPath);
    }
}
