using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Repositories
{
    public interface IAiInterviewRepository
    {
        Task<AiInterview> SaveInterviewAsync(AiInterview interview);
        Task<List<AiInterview>> GetHistoryByUsernameAsync(string username);
    }
}
