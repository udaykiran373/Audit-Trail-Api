using System;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Audit.Api.Models
{
    public class AiInterview
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        public string Username { get; set; } = null!;
        public string RoleAppliedFor { get; set; } = null!;
        public string QuestionText { get; set; } = null!;
        public string CandidateTranscript { get; set; } = null!;
        
        public string Score { get; set; } = "Pending";
        public string AiFeedback { get; set; } = null!;
        public string VideoUrl { get; set; } = null!;
        
        public int WarningsCount { get; set; }
        public List<string> WarningsLog { get; set; } = new();

        public DateTime CompletedAt { get; set; } = DateTime.UtcNow;
    }
}
