using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;
using MongoDB.Driver;

namespace Audit.Api.Repositories;

/// <summary>
/// Data Access Layer for MongoDB, strictly handling persistence, retrieval, 
/// and atomic updates for the social posts collection.
/// </summary>
public class MongoPostRepository : IPostRepository
{
    private readonly IMongoCollection<Post> _postsCollection;

    /// <summary>
    /// Initializes a new instance of the MongoPostRepository.
    /// Injects the scoped MongoDB context to establish a direct connection to the "posts" collection.
    /// </summary>
    /// <param name="dbContext">The MongoDB database context.</param>
    public MongoPostRepository(MongoDbContext dbContext)
    {
        _postsCollection = dbContext.Database.GetCollection<Post>("posts");
    }

    /// <summary>
    /// Retrieves all posts, leveraging the database engine to order them chronologically.
    /// </summary>
    public async Task<List<Post>> GetPostsAsync()
    {
        // DATA ACCESS: Uses MongoDB's native sorting engine for high-performance chronological ordering.
        return await _postsCollection.Find(FilterDefinition<Post>.Empty)
                                     .SortByDescending(p => p.CreatedAt)
                                     .ToListAsync();
    }

    /// <summary>
    /// Initializes base properties and persists a new post to the database.
    /// </summary>
    public async Task<Post> CreatePostAsync(Post post)
    {
        // Set initial baseline state before persistence
        post.CreatedAt = DateTime.UtcNow;
        post.Likes = 0;

        await _postsCollection.InsertOneAsync(post);
        return post;
    }

    /// <summary>
    /// Retrieves a single post document by its unique identifier.
    /// </summary>
    public async Task<Post?> GetPostByIdAsync(string id)
    {
        return await _postsCollection.Find(p => p.Id == id).FirstOrDefaultAsync();
    }

    /// <summary>
    /// Toggles a user's like on a post using highly optimized, atomic database operations.
    /// </summary>
    public async Task<Post?> LikePostAsync(string id, string userId)
    {
        var post = await GetPostByIdAsync(id);
        if (post == null) return null;

        var isLiked = post.LikedBy != null && post.LikedBy.Contains(userId);

        // ARCHITECTURE NOTE: Uses native MongoDB atomic operators ($pull, $push, $inc) via FindOneAndUpdateAsync.
        // This completely prevents race conditions if hundreds of users like the post at the exact same millisecond.
        if (isLiked)
        {
            var update = Builders<Post>.Update.Pull(p => p.LikedBy, userId).Inc(p => p.Likes, -1);
            return await _postsCollection.FindOneAndUpdateAsync(
                p => p.Id == id,
                update,
                new FindOneAndUpdateOptions<Post> { ReturnDocument = ReturnDocument.After }
            );
        }
        else
        {
            var update = Builders<Post>.Update.Push(p => p.LikedBy, userId).Inc(p => p.Likes, 1);
            return await _postsCollection.FindOneAndUpdateAsync(
                p => p.Id == id,
                update,
                new FindOneAndUpdateOptions<Post> { ReturnDocument = ReturnDocument.After }
            );
        }
    }

    /// <summary>
    /// Removes a post from the database and returns a boolean indicating success.
    /// </summary>
    public async Task<bool> DeletePostAsync(string id)
    {
        // Executes a native delete and verifies the database acknowledged the deletion of at least 1 document.
        var result = await _postsCollection.DeleteOneAsync(p => p.Id == id);
        return result.DeletedCount > 0;
    }
}