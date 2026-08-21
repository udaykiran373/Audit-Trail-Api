using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System.Collections.Generic;

namespace Audit.Api.Models;

public class Question
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    public string QuizCategory { get; set; } = string.Empty;
    public string QuestionText { get; set; } = string.Empty;
    public List<string> Options { get; set; } = new();
    public int CorrectOption { get; set; }
}
