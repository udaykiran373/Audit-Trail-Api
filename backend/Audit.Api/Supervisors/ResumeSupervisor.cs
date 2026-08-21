using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.Repositories;

namespace Audit.Api.Supervisors;

public class ResumeSupervisor : IResumeSupervisor
{
    private readonly IResumeRepository _resumeRepository;
    private readonly IAuditLoggingSupervisor _loggingSupervisor;

    public ResumeSupervisor(IResumeRepository resumeRepository, IAuditLoggingSupervisor loggingSupervisor)
    {
        _resumeRepository = resumeRepository;
        _loggingSupervisor = loggingSupervisor;
    }

    public async Task<Resume?> GetResumeAsync(string targetUsername, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
    {
        // 1. Fetch the data from your repository
        var resume = await _resumeRepository.GetResumeAsync(targetUsername);

        // 2. Log the specific resume view event
        await LogEventAsync("VIEW_RESUME", "SUCCESS", userId, userAgent, ipAddress, requestPath, correlationId, sessionId, new Dictionary<string, object>
        {
            { "targetUsername", targetUsername },
            { "resumeFound", resume != null }
        });

        return resume;
    }

    public async Task<Resume> SaveResumeAsync(Resume resume, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
    {
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

    private async Task LogEventAsync(string action, string status, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, String sessionId, Dictionary<string, object> metadata)
    {

        var log = new AuditLog
        {
            Timestamp = DateTime.UtcNow,
            UserId = userId,
            SessionId = sessionId,
            EventType = "BUSINESS_EVENT",
            Module = "Resume",
            Action = action,
            Status = status,
            CorrelationId = correlationId,
            RequestPath = requestPath,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Metadata = metadata
        };
        await _loggingSupervisor.LogAsync(log);
    }
}
