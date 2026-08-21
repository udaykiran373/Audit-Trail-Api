using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;
using MongoDB.Driver;

namespace Audit.Api.Repositories;

public class MongoAssessmentRepository : IAssessmentRepository
{
    private readonly IMongoCollection<Question> _questionsCollection;
    private readonly IMongoCollection<Assessment> _assessmentsCollection;

    public MongoAssessmentRepository(MongoDbContext dbContext)
    {
        _questionsCollection = dbContext.Database.GetCollection<Question>("questions");
        _assessmentsCollection = dbContext.Database.GetCollection<Assessment>("assessments");
    }

    public async Task<List<Question>> GetQuestionsByCategoryAsync(string category)
    {
        return await _questionsCollection.Find(q => q.QuizCategory.ToLower() == category.ToLower())
                                         .ToListAsync();
    }

    public async Task<Assessment> SaveAssessmentAsync(Assessment assessment)
    {
        await _assessmentsCollection.InsertOneAsync(assessment);
        return assessment;
    }

    public async Task<List<Assessment>> GetHistoryByUsernameAsync(string username)
    {
        return await _assessmentsCollection.Find(a => a.Username.ToLower() == username.ToLower())
                                           .SortByDescending(a => a.CompletedAt)
                                           .ToListAsync();
    }
}
