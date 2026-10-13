using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.DTOs;
using Audit.Api.Models;
using Audit.Api.Repositories;

namespace Audit.Api.Supervisors;

/// <summary>
/// Supervisor class responsible for orchestrating assessment-related operations.
/// </summary>
    public class AssessmentSupervisor : IAssessmentSupervisor
    {
        private readonly IAssessmentRepository _assessmentRepository;
        private readonly IAuditLogRepository _auditRepository;

        public AssessmentSupervisor(IAssessmentRepository assessmentRepository, IAuditLogRepository auditRepository)
        {
            _assessmentRepository = assessmentRepository;
            _auditRepository = auditRepository;
        }

        public async Task<List<Question>> GetQuestionsByCategoryAsync(string category, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
        {
            var questions = await _assessmentRepository.GetQuestionsByCategoryAsync(category);

            await LogEventAsync("Started", "SUCCESS", userId, userAgent, ipAddress, requestPath, correlationId, new Dictionary<string, object>
            {
                { "quizName", category },
                { "questionsCount", questions.Count }
            }, sessionId);

            return questions;
        }

        public async Task<object> SubmitAssessmentAsync(string username, string category, string answersJson, int warningsCount, string warningsLogJson, Microsoft.AspNetCore.Http.IFormFile? videoFile, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
        {
            var answers = new Dictionary<string, int>();
            try
            {
                if (!string.IsNullOrWhiteSpace(answersJson))
                {
                    answers = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, int>>(answersJson) ?? new();
                }
            }
            catch { }

            var warningsLog = new List<string>();
            try
            {
                if (!string.IsNullOrWhiteSpace(warningsLogJson))
                {
                    warningsLog = System.Text.Json.JsonSerializer.Deserialize<List<string>>(warningsLogJson) ?? new();
                }
            }
            catch { }

            string videoPlaybackUrl = string.Empty;
            if (videoFile != null && videoFile.Length > 0)
            {
                try
                {
                    var uploadsFolder = System.IO.Path.Combine(System.IO.Directory.GetCurrentDirectory(), "wwwroot", "uploads", "assessments");
                    if (!System.IO.Directory.Exists(uploadsFolder))
                    {
                        System.IO.Directory.CreateDirectory(uploadsFolder);
                    }

                    var uniqueFileName = $"{Guid.NewGuid()}{System.IO.Path.GetExtension(videoFile.FileName)}";
                    if (string.IsNullOrEmpty(System.IO.Path.GetExtension(videoFile.FileName)))
                    {
                        uniqueFileName += ".webm";
                    }
                    var filePath = System.IO.Path.Combine(uploadsFolder, uniqueFileName);

                    using (var fileStream = new System.IO.FileStream(filePath, System.IO.FileMode.Create))
                    {
                        await videoFile.CopyToAsync(fileStream);
                    }

                    videoPlaybackUrl = $"/uploads/assessments/{uniqueFileName}";
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"Failed to save proctor video file: {ex.Message}");
                }
            }

            var questions = await _assessmentRepository.GetQuestionsByCategoryAsync(category);
            if (questions.Count == 0)
            {
                throw new ArgumentException("Quiz questions not found for category.");
            }

            int score = 0;
            int correctCount = 0;

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

            bool passed = score >= 70;

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
                VideoData = videoPlaybackUrl
            };

            var saved = await _assessmentRepository.SaveAssessmentAsync(assessment);

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

            await LogEventAsync("Submitted", passed ? "SUCCESS" : "FAILED", username, userAgent, ipAddress, requestPath, correlationId, new Dictionary<string, object>
            {
                { "Score", scoreMetadata },
                { "VideoPlaybackUrl", videoPlaybackUrl },
                { "WarningsCount", warningsCount }
            }, sessionId);

            return saved;
        }

        public async Task LogPermissionsAsync(PermissionsPayload payload, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
        {
            var status = payload.Granted ? "SUCCESS" : "FAILED";
            var action = payload.Granted ? "PermissionsGranted" : "PermissionsDenied";

            await LogEventAsync(action, status, userId, userAgent, ipAddress, requestPath, correlationId, new Dictionary<string, object>
            {
                { "CameraGranted", payload.CameraGranted },
                { "MicrophoneGranted", payload.MicrophoneGranted }
            }, sessionId);
        }

        public async Task LogProctoringWarningAsync(WarningPayload payload, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
        {
            await LogEventAsync("ProctoringWarning", "WARNING", userId, userAgent, ipAddress, requestPath, correlationId, new Dictionary<string, object>
            {
                { "WarningType", payload.WarningType },
                { "VideoTimestamp", payload.VideoTimestamp }
            }, sessionId);
        }

        public async Task LogViewAsync(string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
        {
            await LogEventAsync("Opened", "SUCCESS", userId, userAgent, ipAddress, requestPath, correlationId, new Dictionary<string, object>(), sessionId);
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
                EventType = "Assessment",
                Module = action,
                Status = status,
                CorrelationId = correlationId,
                RequestPath = requestPath,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                Metadata = metadata
            };
            await _auditRepository.InsertAsync(log);
        }
    }
