using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.Repositories;

namespace Audit.Api.Supervisors;

public class AssessmentSupervisor : IAssessmentSupervisor
{
    private readonly IAssessmentRepository _assessmentRepository;
    private readonly IAuditLoggingSupervisor _loggingSupervisor;

    public AssessmentSupervisor(IAssessmentRepository assessmentRepository, IAuditLoggingSupervisor loggingSupervisor)
    {
        _assessmentRepository = assessmentRepository;
        _loggingSupervisor = loggingSupervisor;
    }

    public async Task<List<Question>> GetQuestionsByCategoryAsync(string category, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
    {
        var questions = await _assessmentRepository.GetQuestionsByCategoryAsync(category);

        // Audit Logging inside the Supervisor business transaction
        await LogEventAsync("AssessmentStarted", "SUCCESS", userId, userAgent, ipAddress, requestPath, correlationId, new Dictionary<string, object>
        {
            { "quizName", category },
            { "questionsCount", questions.Count }
        }, sessionId);

        return questions;
    }

    public async Task<Assessment> SubmitAssessmentAsync(string username, string category, Dictionary<string, int> answers, int warningsCount, List<string> warningsLog, string videoData, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
    {
        var questions = await _assessmentRepository.GetQuestionsByCategoryAsync(category);
        if (questions.Count == 0)
        {
            throw new ArgumentException("Quiz questions not found for category.");
        }

        int score = 0;
        int correctCount = 0;

        // 1. Calculate the natural score
        if (category.Equals("Data Structures & Algorithms", StringComparison.OrdinalIgnoreCase))
        {
            // DSA is verbal, so natural score is based on minor infractions
            score = Math.Max(0, 95 - (warningsCount * 20));
        }
        else
        {
            // Multiple choice tests calculate exactly what was answered correctly
            foreach (var q in questions)
            {
                if (q.Id != null && answers.TryGetValue(q.Id, out int selectedOption))
                {
                    if (selectedOption == q.CorrectOption)
                    {
                        correctCount++;
                    }
                }
            }
            score = (int)Math.Round((double)correctCount / questions.Count * 100);
        }

        bool passed = score >= 70;

        // 2. Apply the Disqualification Override (The Fix)
        if (warningsCount >= 3)
        {
            score = 0;
            passed = false;
        }

        var assessment = new Assessment
        {
            Username = username,
            QuizCategory = category,
            Score = score,
            IsPassed = passed,
            CompletedAt = DateTime.UtcNow,
            WarningsCount = warningsCount,
            WarningsLog = warningsLog,
            VideoData = videoData
        };

        var saved = await _assessmentRepository.SaveAssessmentAsync(assessment);

        // Determine score metadata for the audit log
        string scoreMetadata;
        if (!passed)
        {
            scoreMetadata = warningsCount >= 3 ? "Disqualified (0%)" : "Failed";
        }
        else if (category.Equals("Data Structures & Algorithms", StringComparison.OrdinalIgnoreCase))
        {
            scoreMetadata = "Pending";
        }
        else
        {
            scoreMetadata = score.ToString() + "%";
        }

        // Audit Logging inside the Supervisor business transaction
        await LogEventAsync("AssessmentSubmitted", passed ? "SUCCESS" : "FAILED", username, userAgent, ipAddress, requestPath, correlationId, new Dictionary<string, object>
        {
            { "Score", scoreMetadata },
            { "VideoPlaybackUrl", videoData },
            { "WarningsCount", warningsCount }
        }, sessionId);

        return saved;
    }

    public async Task<List<Assessment>> GetHistoryByUsernameAsync(string username)
    {
        return await _assessmentRepository.GetHistoryByUsernameAsync(username);
    }

    private async Task LogEventAsync(string action, string status, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, Dictionary<string, object> metadata, string sessionId, string eventType = "Business")
    {
        var log = new AuditLog
        {
            Timestamp = DateTime.UtcNow,
            UserId = userId,
            SessionId = sessionId,
            EventType = eventType,
            Module = "Assessment",
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
