using System;
using System.Threading.Tasks;
using Audit.Api.Models;
using MongoDB.Driver;

namespace Audit.Api.Repositories;

public class MongoResumeRepository : IResumeRepository
{
    private readonly IMongoCollection<Resume> _resumesCollection;

    public MongoResumeRepository(MongoDbContext dbContext)
    {
        _resumesCollection = dbContext.Database.GetCollection<Resume>("resumes");
    }

    public async Task<Resume?> GetResumeAsync(string username)
    {
        return await _resumesCollection.Find(r => r.Username.ToLower() == username.ToLower())
                                       .FirstOrDefaultAsync();
    }

    public async Task<Resume> SaveResumeAsync(Resume resume)
    {
        resume.UpdatedAt = DateTime.UtcNow;

        var existing = await GetResumeAsync(resume.Username);
        if (existing == null)
        {
            await _resumesCollection.InsertOneAsync(resume);
        }
        else
        {
            resume.Id = existing.Id;
            await _resumesCollection.ReplaceOneAsync(r => r.Id == existing.Id, resume);
        }

        return resume;
    }
}
