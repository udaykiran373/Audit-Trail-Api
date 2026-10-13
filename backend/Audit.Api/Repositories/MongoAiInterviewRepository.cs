using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;
using MongoDB.Driver;

namespace Audit.Api.Repositories
{
    public class MongoAiInterviewRepository : IAiInterviewRepository
    {
        private readonly IMongoCollection<AiInterview> _interviews;

        public MongoAiInterviewRepository(MongoDbContext context)
        {
            _interviews = context.Database.GetCollection<AiInterview>("AiInterviews");
        }

        public async Task<AiInterview> SaveInterviewAsync(AiInterview interview)
        {
            await _interviews.InsertOneAsync(interview);
            return interview;
        }

        public async Task<List<AiInterview>> GetHistoryByUsernameAsync(string username)
        {
            return await _interviews.Find(i => i.Username == username)
                                    .SortByDescending(i => i.CompletedAt)
                                    .ToListAsync();
        }
    }
}
