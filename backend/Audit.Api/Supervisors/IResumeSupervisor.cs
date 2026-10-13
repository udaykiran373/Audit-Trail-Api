using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Supervisors;

/// <summary>
/// Defines the contract for managing resumes and tracking related business events.
/// </summary>
public interface IResumeSupervisor
{
    /// <summary>
    /// Retrieves a resume for a specific target user and logs the view event.
    /// </summary>
    /// <param name="targetUsername">The username of the user whose resume is being accessed.</param>
    /// <param name="userId">The ID of the user performing the access.</param>
    /// <param name="userAgent">The user agent string of the client.</param>
    /// <param name="ipAddress">The IP address of the client.</param>
    /// <param name="requestPath">The path of the incoming request.</param>
    /// <param name="correlationId">The correlation ID for request tracking.</param>
    /// <param name="sessionId">The session ID of the current user.</param>
    /// <returns>A task containing the resume if found; otherwise, null.</returns>
    Task<Resume?> GetResumeAsync(string targetUsername, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);

    /// <summary>
    /// Saves a provided resume and logs the update event.
    /// </summary>
    /// <param name="resume">The resume object to save.</param>
    /// <param name="userId">The ID of the user performing the save.</param>
    /// <param name="userAgent">The user agent string of the client.</param>
    /// <param name="ipAddress">The IP address of the client.</param>
    /// <param name="requestPath">The path of the incoming request.</param>
    /// <param name="correlationId">The correlation ID for request tracking.</param>
    /// <param name="sessionId">The session ID of the current user.</param>
    /// <returns>A task containing the successfully saved resume.</returns>
    Task<Resume> SaveResumeAsync(Resume resume, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);
}
