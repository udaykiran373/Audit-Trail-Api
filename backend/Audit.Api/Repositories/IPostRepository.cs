using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Repositories;

public interface IPostRepository
{
    /// <summary>
    /// Retrieves all posts from the repository.
    /// </summary>
    /// <returns>A task that represents the asynchronous operation. The task result contains a list of posts.</returns>
    Task<List<Post>> GetPostsAsync();

    /// <summary>
    /// Creates a new post.
    /// </summary>
    /// <param name="post">The post to create.</param>
    /// <returns>A task that represents the asynchronous operation. The task result contains the created post.</returns>
    Task<Post> CreatePostAsync(Post post);

    /// <summary>
    /// Retrieves a post by its unique identifier.
    /// </summary>
    /// <param name="id">The unique identifier of the post.</param>
    /// <returns>A task that represents the asynchronous operation. The task result contains the post if found; otherwise, null.</returns>
    Task<Post?> GetPostByIdAsync(string id);

    /// <summary>
    /// Adds a like to a post by a specific user.
    /// </summary>
    /// <param name="id">The unique identifier of the post.</param>
    /// <param name="userId">The ID of the user liking the post.</param>
    /// <returns>A task that represents the asynchronous operation. The task result contains the updated post if found; otherwise, null.</returns>
    Task<Post?> LikePostAsync(string id, string userId);

    /// <summary>
    /// Deletes a post by its unique identifier.
    /// </summary>
    /// <param name="id">The unique identifier of the post to delete.</param>
    /// <returns>A task that represents the asynchronous operation. The task result is true if the deletion was successful; otherwise, false.</returns>
    Task<bool> DeletePostAsync(string id);
}
