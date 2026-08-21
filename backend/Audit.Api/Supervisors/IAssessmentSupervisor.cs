using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Supervisors;

public interface IAssessmentSupervisor
{
    Task<List<Question>> GetQuestionsByCategoryAsync(string category, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);
    Task<Assessment> SubmitAssessmentAsync(string username, string category, Dictionary<string, int> answers, int warningsCount, List<string> warningsLog, string videoData, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);
    Task<List<Assessment>> GetHistoryByUsernameAsync(string username);
}
