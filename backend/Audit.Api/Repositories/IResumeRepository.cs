using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Repositories;

public interface IResumeRepository
{
    Task<Resume?> GetResumeAsync(string username);
    Task<Resume> SaveResumeAsync(Resume resume);
}
