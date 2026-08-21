using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Repositories;

public interface IPostRepository
{
    Task<List<Post>> GetPostsAsync();
    Task<Post> CreatePostAsync(Post post);
    Task<Post?> GetPostByIdAsync(string id);
    Task<Post?> LikePostAsync(string id, string userId);
    Task<bool> DeletePostAsync(string id);
}
