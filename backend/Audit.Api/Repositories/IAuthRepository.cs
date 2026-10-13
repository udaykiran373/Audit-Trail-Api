using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Repositories;

public interface IAuthRepository
{
    /// <summary>
    /// Checks if a user exists with the given username.
    /// </summary>
    /// <param name="username">The username to check.</param>
    /// <returns>A task that represents the asynchronous operation. The task result contains a boolean indicating if the user exists.</returns>
    Task<bool> UserExistsAsync(string username);

    /// <summary>
    /// Gets a user by their username.
    /// </summary>
    /// <param name="username">The username of the user to retrieve.</param>
    /// <returns>A task that represents the asynchronous operation. The task result contains the user if found; otherwise, null.</returns>
    Task<User?> GetUserByUsernameAsync(string username);

    /// <summary>
    /// Creates a new user in the system.
    /// </summary>
    /// <param name="user">The user object to create.</param>
    /// <returns>A task that represents the asynchronous operation. The task result contains the created user.</returns>
    Task<User> CreateUserAsync(User user);
}