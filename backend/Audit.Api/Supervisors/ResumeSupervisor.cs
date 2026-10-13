using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.Repositories;

namespace Audit.Api.Supervisors;

/// <summary>
/// Implements the business logic and audit logging for resume-related operations.
/// </summary>
    public class ResumeSupervisor : IResumeSupervisor
    {
        private readonly IResumeRepository _resumeRepository;
        private readonly IAuditLogRepository _auditRepository;

        /// <summary>
        /// Initializes a new instance of the <see cref="ResumeSupervisor"/> class.
        /// </summary>
        /// <param name="resumeRepository">The repository for resume data access.</param>
        /// <param name="auditRepository">The repository for handling audit logs.</param>
        public ResumeSupervisor(IResumeRepository resumeRepository, IAuditLogRepository auditRepository)
        {
            _resumeRepository = resumeRepository;
            _auditRepository = auditRepository;
        }

        /// <inheritdoc/>
        public async Task<Resume?> GetResumeAsync(string targetUsername, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
        {
            // Fetch the resume data from the repository based on the target username
            var resume = await _resumeRepository.GetResumeAsync(targetUsername);

            // Log the specific resume view event along with the outcome
            await LogEventAsync("VIEW_RESUME", "SUCCESS", userId, userAgent, ipAddress, requestPath, correlationId, sessionId, new Dictionary<string, object>
            {
                { "targetUsername", targetUsername },
                { "resumeFound", resume != null }
            });

            return resume;
        }

        /// <inheritdoc/>
        public async Task<Resume> SaveResumeAsync(Resume resume, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
        {
            // Persist the updated or newly created resume
            var saved = await _resumeRepository.SaveResumeAsync(resume);

            // Audit Logging inside the Supervisor business transaction
            await LogEventAsync("RESUME_UPDATED", "SUCCESS", userId, userAgent, ipAddress, requestPath, correlationId, sessionId, new Dictionary<string, object>
            {
                { "fullName", saved.FullName },
                { "experienceCount", saved.Experience?.Count ?? 0 },
                { "projectsCount", saved.Projects?.Count ?? 0 },
                { "skillsCount", saved.Skills?.Count ?? 0 }
            });

            return saved;
        }

        /// <summary>
        /// Helper method to construct and record an audit log entry for resume operations.
        /// </summary>
        /// <param name="action">The specific action performed (e.g., VIEW_RESUME, RESUME_UPDATED).</param>
        /// <param name="status">The status of the operation (e.g., SUCCESS).</param>
        /// <param name="userId">The ID of the user performing the action.</param>
        /// <param name="userAgent">The user agent string of the client.</param>
        /// <param name="ipAddress">The IP address of the client.</param>
        /// <param name="requestPath">The path of the incoming request.</param>
        /// <param name="correlationId">The correlation ID for request tracking.</param>
        /// <param name="sessionId">The session ID of the current user.</param>
        /// <param name="metadata">Additional contextual data associated with the event.</param>
        /// <returns>A task that represents the asynchronous logging operation.</returns>
        private async Task LogEventAsync(string action, string status, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId, Dictionary<string, object> metadata)
        {
            // Construct the audit log entry
            var log = new AuditLog
            {
                Timestamp = DateTime.UtcNow,
                UserId = userId,
                SessionId = sessionId,
                EventType = "Resume",
                Module = action,
                Status = status,
                CorrelationId = correlationId,
                RequestPath = requestPath,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                Metadata = metadata
            };
            
            // Dispatch the log entry to the logging repository
            await _auditRepository.InsertAsync(log);
        }
    }
