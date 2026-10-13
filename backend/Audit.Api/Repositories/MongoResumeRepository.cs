using System;
using System.Threading.Tasks;
using Audit.Api.Models;
using MongoDB.Driver;

namespace Audit.Api.Repositories;

/// <summary>
/// MongoDB implementation of the IResumeRepository.
/// </summary>
public class MongoResumeRepository : IResumeRepository
{
    private readonly IMongoCollection<Resume> _resumesCollection;

    /// <summary>
    /// Initializes a new instance of the MongoResumeRepository class.
    /// </summary>
    /// <param name="dbContext">The MongoDB database context.</param>
    public MongoResumeRepository(MongoDbContext dbContext)
    {
        // Get the resumes collection from the database
        _resumesCollection = dbContext.Database.GetCollection<Resume>("resumes");
    }

    /// <inheritdoc/>
    public async Task<Resume?> GetResumeAsync(string username)
    {
        // Search for the resume case-insensitively
        return await _resumesCollection.Find(r => r.Username.ToLower() == username.ToLower())
                                       .FirstOrDefaultAsync();
    }

    /// <inheritdoc/>
    public async Task<Resume> SaveResumeAsync(Resume resume)
    {
        // Update the modification timestamp
        resume.UpdatedAt = DateTime.UtcNow;

        var existing = await GetResumeAsync(resume.Username);
        if (existing == null)
        {
            // Insert a new resume if one does not exist
            await _resumesCollection.InsertOneAsync(resume);
        }
        else
        {
            // Update the existing resume document
            resume.Id = existing.Id;
            await _resumesCollection.ReplaceOneAsync(r => r.Id == existing.Id, resume);
        }

        return resume;
    }
}
