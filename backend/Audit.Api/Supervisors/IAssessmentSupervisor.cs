using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.DTOs;
using Audit.Api.Models;

namespace Audit.Api.Supervisors;

/// <summary>
/// Provides supervisory operations for assessments.
/// </summary>
public interface IAssessmentSupervisor
{
    /// <summary>
    /// Retrieves questions by category asynchronously.
    /// </summary>
    /// <param name="category">The category of the questions.</param>
    /// <param name="userId">The ID of the user requesting questions.</param>
    /// <param name="userAgent">The user agent string.</param>
    /// <param name="ipAddress">The IP address of the request.</param>
    /// <param name="requestPath">The path of the request.</param>
    /// <param name="correlationId">The correlation ID for the request.</param>
    /// <param name="sessionId">The session ID.</param>
    /// <returns>A task that represents the asynchronous operation. The task result contains a list of questions.</returns>
    Task<List<Question>> GetQuestionsByCategoryAsync(string category, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);

    /// <summary>
    /// Submits an assessment asynchronously.
    /// </summary>
    /// <param name="username">The username of the test taker.</param>
    /// <param name="category">The category of the quiz.</param>
    /// <param name="answers">A dictionary of question IDs and selected option indices.</param>
    /// <param name="warningsCount">The number of warnings recorded during the assessment.</param>
    /// <param name="warningsLog">The log details of the warnings.</param>
    /// <param name="videoData">The video recording data or URL.</param>
    /// <param name="userAgent">The user agent string.</param>
    /// <param name="ipAddress">The IP address of the request.</param>
    /// <param name="requestPath">The path of the request.</param>
    /// <param name="correlationId">The correlation ID for the request.</param>
    /// <param name="sessionId">The session ID.</param>
    /// <returns>A task that represents the asynchronous operation. The task result contains the submitted assessment.</returns>
    Task<object> SubmitAssessmentAsync(string username, string category, string answersJson, int warningsCount, string warningsLogJson, Microsoft.AspNetCore.Http.IFormFile? videoFile, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);

    Task<List<Assessment>> GetHistoryByUsernameAsync(string username);

    Task LogPermissionsAsync(PermissionsPayload payload, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);
    Task LogProctoringWarningAsync(WarningPayload payload, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);
    Task LogViewAsync(string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);
}
