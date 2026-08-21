using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Supervisors;

public interface IPostSupervisor
{
    // UPDATED: Now includes tracking parameters and sessionId
    Task<List<Post>> GetPostsAsync(string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);

    // UPDATED: Added string sessionId at the end
    Task<Post> CreatePostAsync(Post post, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);

    // UPDATED: Added string sessionId at the end
    Task<Post?> LikePostAsync(string id, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);

    // UPDATED: Added string sessionId at the end
    Task<bool> DeletePostAsync(string id, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);
}