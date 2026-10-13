using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Repositories;

public interface IResumeRepository
{
    /// <summary>
    /// Retrieves the resume for a specific user.
    /// </summary>
    /// <param name="username">The username of the user whose resume is being retrieved.</param>
    /// <returns>A task that represents the asynchronous operation. The task result contains the resume if found; otherwise, null.</returns>
    Task<Resume?> GetResumeAsync(string username);

    /// <summary>
    /// Saves or updates a user's resume.
    /// </summary>
    /// <param name="resume">The resume object to save.</param>
    /// <returns>A task that represents the asynchronous operation. The task result contains the saved resume.</returns>
    Task<Resume> SaveResumeAsync(Resume resume);
}
