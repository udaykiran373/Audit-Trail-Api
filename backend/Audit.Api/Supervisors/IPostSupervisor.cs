using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;

namespace Audit.Api.Supervisors;

/// <summary>
/// Defines the contract for managing posts and logging related audit events.
/// </summary>
public interface IPostSupervisor
{
    /// <summary>
    /// Retrieves a list of all posts and logs the access event.
    /// </summary>
    /// <param name="userId">The ID of the user requesting the posts.</param>
    /// <param name="userAgent">The user agent string of the client.</param>
    /// <param name="ipAddress">The IP address of the client.</param>
    /// <param name="requestPath">The path of the incoming request.</param>
    /// <param name="correlationId">The correlation ID for request tracking.</param>
    /// <param name="sessionId">The session ID of the current user.</param>
    /// <returns>A task that represents the asynchronous operation, containing a list of posts.</returns>
    Task<List<Post>> GetPostsAsync(string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);

    /// <summary>
    /// Creates a new post and logs the creation event.
    /// </summary>
    /// <param name="post">The post object containing the details to be created.</param>
    /// <param name="userId">The ID of the user creating the post.</param>
    /// <param name="userAgent">The user agent string of the client.</param>
    /// <param name="ipAddress">The IP address of the client.</param>
    /// <param name="requestPath">The path of the incoming request.</param>
    /// <param name="correlationId">The correlation ID for request tracking.</param>
    /// <param name="sessionId">The session ID of the current user.</param>
    /// <returns>A task that represents the asynchronous operation, containing the created post.</returns>
    Task<Post> CreatePostAsync(Post post, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);

    /// <summary>
    /// Toggles a like on a post (likes or unlikes) and logs the event.
    /// </summary>
    /// <param name="id">The unique identifier of the post to like/unlike.</param>
    /// <param name="userId">The ID of the user performing the action.</param>
    /// <param name="userAgent">The user agent string of the client.</param>
    /// <param name="ipAddress">The IP address of the client.</param>
    /// <param name="requestPath">The path of the incoming request.</param>
    /// <param name="correlationId">The correlation ID for request tracking.</param>
    /// <param name="sessionId">The session ID of the current user.</param>
    /// <returns>A task that represents the asynchronous operation, containing the updated post, or null if the post wasn't found.</returns>
    Task<Post?> LikePostAsync(string id, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);

    /// <summary>
    /// Deletes a specified post and logs the deletion event.
    /// </summary>
    /// <param name="id">The unique identifier of the post to delete.</param>
    /// <param name="userId">The ID of the user deleting the post.</param>
    /// <param name="userAgent">The user agent string of the client.</param>
    /// <param name="ipAddress">The IP address of the client.</param>
    /// <param name="requestPath">The path of the incoming request.</param>
    /// <param name="correlationId">The correlation ID for request tracking.</param>
    /// <param name="sessionId">The session ID of the current user.</param>
    /// <returns>A task that represents the asynchronous operation, containing a boolean indicating success or failure.</returns>
    Task<bool> DeletePostAsync(string id, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId);
}