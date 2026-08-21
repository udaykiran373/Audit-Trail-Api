using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System;
using System.Collections.Generic;

namespace Audit.Api.Models;

public class Resume
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string ProfilePhoto { get; set; } = string.Empty;
    public string VideoResumeUrl { get; set; } = string.Empty;
    public List<WorkExperience> Experience { get; set; } = new();
    public List<EducationItem> Education { get; set; } = new();
    public List<ProjectItem> Projects { get; set; } = new();
    public List<string> Skills { get; set; } = new();
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class WorkExperience
{
    public string Company { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Duration { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public class EducationItem
{
    public string Institution { get; set; } = string.Empty;
    public string Degree { get; set; } = string.Empty;
    public string Year { get; set; } = string.Empty;
}

public class ProjectItem
{
    public string Title { get; set; } = string.Empty;
    public string Technologies { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Link { get; set; } = string.Empty;
}
