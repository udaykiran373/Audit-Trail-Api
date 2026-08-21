using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.Repositories;
using MongoDB.Driver;

namespace Audit.Api.Services
{
    public interface IAiInterviewService
    {
        Task<AiInterview> SaveInterviewAsync(AiInterview interview);
        Task<List<AiInterview>> GetHistoryByUsernameAsync(string username);
    }

    public class AiInterviewService : IAiInterviewService
    {
        private readonly IMongoCollection<AiInterview> _interviews;

        public AiInterviewService(MongoDbContext context)
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
