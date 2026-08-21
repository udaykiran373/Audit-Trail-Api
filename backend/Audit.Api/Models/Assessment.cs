using System;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Audit.Api.Models;

public class Assessment
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    public string Username { get; set; } = string.Empty;
    public string QuizCategory { get; set; } = string.Empty;
    public int Score { get; set; }
    public bool IsPassed { get; set; }
    public DateTime CompletedAt { get; set; } = DateTime.UtcNow;
    public int WarningsCount { get; set; }
    public System.Collections.Generic.List<string> WarningsLog { get; set; } = new();
    public string VideoData { get; set; } = string.Empty;
}
