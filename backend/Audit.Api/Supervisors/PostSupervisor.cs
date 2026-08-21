using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.Repositories;

namespace Audit.Api.Supervisors;

public class PostSupervisor : IPostSupervisor
{
    private readonly IPostRepository _postRepository;
    private readonly IAuditLoggingSupervisor _loggingSupervisor;

    public PostSupervisor(IPostRepository postRepository, IAuditLoggingSupervisor loggingSupervisor)
    {
        _postRepository = postRepository;
        _loggingSupervisor = loggingSupervisor;
    }

    // UPDATED: Now accepts audit context parameters and logs the visit
    public async Task<List<Post>> GetPostsAsync(string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
    {
        var posts = await _postRepository.GetPostsAsync();

        // Log the Hub Visit
        await LogEventAsync("VIEW_HUB", "SUCCESS", userId, userAgent, ipAddress, requestPath, correlationId, sessionId, new Dictionary<string, object>
        {
            { "postsLoaded", posts.Count }
        });

        return posts;
    }

    public async Task<Post> CreatePostAsync(Post post, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
    {
        var created = await _postRepository.CreatePostAsync(post);

        await LogEventAsync("CREATE_POST", "SUCCESS", userId, userAgent, ipAddress, requestPath, correlationId, sessionId, new Dictionary<string, object>
        {
            { "postId", created.Id ?? "" },
            { "author", created.Author },
            { "tags", created.Tags },
            { "length", created.Content.Length }
        });

        return created;
    }

    public async Task<Post?> LikePostAsync(string id, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
    {
        var postBefore = await _postRepository.GetPostByIdAsync(id);
        if (postBefore == null) return null;

        var updated = await _postRepository.LikePostAsync(id, userId);
        if (updated != null)
        {
            string actionType = updated.Likes > postBefore.Likes ? "LIKE_POST" : "UNLIKE_POST";
            await LogEventAsync(actionType, "SUCCESS", userId, userAgent, ipAddress, requestPath, correlationId, sessionId, new Dictionary<string, object>
            {
                { "postId", id },
                { "author", postBefore.Author },
                { "likesBefore", postBefore.Likes },
                { "likesAfter", updated.Likes }
            });
        }
        return updated;
    }

    public async Task<bool> DeletePostAsync(string id, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
    {
        var post = await _postRepository.GetPostByIdAsync(id);
        if (post == null) return false;

        var success = await _postRepository.DeletePostAsync(id);
        if (success)
        {
            await LogEventAsync("DELETE_POST", "SUCCESS", userId, userAgent, ipAddress, requestPath, correlationId, sessionId, new Dictionary<string, object>
            {
                { "postId", id },
                { "author", post.Author },
                { "tags", post.Tags }
            });
        }
        return success;
    }

    // UPDATED: Now requires sessionId as a parameter instead of hardcoding it
    private async Task LogEventAsync(string action, string status, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId, Dictionary<string, object> metadata)
    {
        var log = new AuditLog
        {
            Timestamp = DateTime.UtcNow,
            UserId = userId,
            SessionId = sessionId,
            EventType = "Business", // Standardized to "Business" to match your dashboard filters
            Module = "Hub",
            Action = action,
            Status = status,
            CorrelationId = correlationId,
            RequestPath = requestPath,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Metadata = metadata
        };
        await _loggingSupervisor.LogAsync(log);
    }
}