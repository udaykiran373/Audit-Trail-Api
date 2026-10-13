using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Repositories;

public interface IAssessmentRepository
{
    /// <summary>
    /// Gets a list of questions filtered by their category.
    /// </summary>
    /// <param name="category">The category of questions to retrieve.</param>
    /// <returns>A task that represents the asynchronous operation. The task result contains a list of questions.</returns>
    Task<List<Question>> GetQuestionsByCategoryAsync(string category);

    /// <summary>
    /// Saves an assessment result.
    /// </summary>
    /// <param name="assessment">The assessment object containing user's answers and score.</param>
    /// <returns>A task that represents the asynchronous operation. The task result contains the saved assessment.</returns>
    Task<Assessment> SaveAssessmentAsync(Assessment assessment);

    /// <summary>
    /// Retrieves the assessment history for a specific user.
    /// </summary>
    /// <param name="username">The username of the user whose history is being retrieved.</param>
    /// <returns>A task that represents the asynchronous operation. The task result contains a list of past assessments.</returns>
    Task<List<Assessment>> GetHistoryByUsernameAsync(string username);
}
