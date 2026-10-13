using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;
using Audit.Api.Repositories;

namespace Audit.Api.Supervisors;

/// <summary>
/// Implements the business logic and audit logging for post-related operations.
/// </summary>
    public class PostSupervisor : IPostSupervisor
    {
        private readonly IPostRepository _postRepository;
        private readonly IAuditLogRepository _auditRepository;

        /// <summary>
        /// Initializes a new instance of the <see cref="PostSupervisor"/> class.
        /// </summary>
        /// <param name="postRepository">The repository for post data access.</param>
        /// <param name="auditRepository">The repository for handling audit logs.</param>
        public PostSupervisor(IPostRepository postRepository, IAuditLogRepository auditRepository)
        {
            _postRepository = postRepository;
            _auditRepository = auditRepository;
        }

        /// <inheritdoc/>
        public async Task<List<Post>> GetPostsAsync(string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
        {
            // Retrieve all available posts from the underlying repository
            var posts = await _postRepository.GetPostsAsync();

            // Log the Hub Visit indicating successful retrieval of posts
            await LogEventAsync("VIEW_HUB", "SUCCESS", userId, userAgent, ipAddress, requestPath, correlationId, sessionId, new Dictionary<string, object>
            {
                { "postsLoaded", posts.Count }
            });

            return posts;
        }

        /// <inheritdoc/>
        public async Task<Post> CreatePostAsync(Post post, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
        {
            // Persist the newly created post in the repository
            var created = await _postRepository.CreatePostAsync(post);

            // Record the post creation event with relevant metadata
            await LogEventAsync("CREATE_POST", "SUCCESS", userId, userAgent, ipAddress, requestPath, correlationId, sessionId, new Dictionary<string, object>
            {
                { "postId", created.Id ?? "" },
                { "author", created.Author },
                { "tags", created.Tags },
                { "length", created.Content.Length }
            });

            return created;
        }

        /// <inheritdoc/>
        public async Task<Post?> LikePostAsync(string id, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
        {
            // Verify the post exists before attempting to modify its like count
            var postBefore = await _postRepository.GetPostByIdAsync(id);
            if (postBefore == null) return null;

            // Apply the like/unlike toggle logic via the repository
            var updated = await _postRepository.LikePostAsync(id, userId);
            if (updated != null)
            {
                // Determine if the action resulted in a like or an unlike based on the updated count
                string actionType = updated.Likes > postBefore.Likes ? "LIKE_POST" : "UNLIKE_POST";
                
                // Log the like/unlike action along with before and after state
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

        /// <inheritdoc/>
        public async Task<bool> DeletePostAsync(string id, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId)
        {
            // Verify the post exists before attempting deletion
            var post = await _postRepository.GetPostByIdAsync(id);
            if (post == null) return false;

            // Execute the deletion operation
            var success = await _postRepository.DeletePostAsync(id);
            if (success)
            {
                // Log the successful deletion event
                await LogEventAsync("DELETE_POST", "SUCCESS", userId, userAgent, ipAddress, requestPath, correlationId, sessionId, new Dictionary<string, object>
                {
                    { "postId", id },
                    { "author", post.Author },
                    { "tags", post.Tags }
                });
            }
            return success;
        }

        /// <summary>
        /// Helper method to construct and record an audit log entry for hub module operations.
        /// </summary>
        /// <param name="action">The specific action performed (e.g., VIEW_HUB, CREATE_POST).</param>
        /// <param name="status">The status of the operation (e.g., SUCCESS).</param>
        /// <param name="userId">The ID of the user performing the action.</param>
        /// <param name="userAgent">The user agent string of the client.</param>
        /// <param name="ipAddress">The IP address of the client.</param>
        /// <param name="requestPath">The path of the incoming request.</param>
        /// <param name="correlationId">The correlation ID for request tracking.</param>
        /// <param name="sessionId">The session ID of the current user.</param>
        /// <param name="metadata">Additional contextual data associated with the event.</param>
        /// <returns>A task that represents the asynchronous logging operation.</returns>
        private async Task LogEventAsync(string action, string status, string userId, string userAgent, string ipAddress, string requestPath, string correlationId, string sessionId, Dictionary<string, object> metadata)
        {
            // Construct the audit log entry
            var log = new AuditLog
            {
                Timestamp = DateTime.UtcNow,
                UserId = userId,
                SessionId = sessionId,
                EventType = "Hub",
                Module = action,
                Status = status,
                CorrelationId = correlationId,
                RequestPath = requestPath,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                Metadata = metadata
            };
            
            // Dispatch the log entry to the logging repository
            await _auditRepository.InsertAsync(log);
        }
    }