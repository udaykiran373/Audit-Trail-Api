using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Repositories;

public interface IAssessmentRepository
{
    Task<List<Question>> GetQuestionsByCategoryAsync(string category);
    Task<Assessment> SaveAssessmentAsync(Assessment assessment);
    Task<List<Assessment>> GetHistoryByUsernameAsync(string username);
}
