using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System;

namespace Audit.Api.Models;

public class Post
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    public string Author { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Tags { get; set; } = string.Empty;
    public int Likes { get; set; } = 0;
    public List<string> LikedBy { get; set; } = new List<string>();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
