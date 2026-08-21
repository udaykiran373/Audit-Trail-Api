using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Audit.Api.Models;
using MongoDB.Driver;

namespace Audit.Api.Repositories;

public class MongoPostRepository : IPostRepository
{
    private readonly IMongoCollection<Post> _postsCollection;

    public MongoPostRepository(MongoDbContext dbContext)
    {
        _postsCollection = dbContext.Database.GetCollection<Post>("posts");
    }

    public async Task<List<Post>> GetPostsAsync()
    {
        return await _postsCollection.Find(FilterDefinition<Post>.Empty)
                                     .SortByDescending(p => p.CreatedAt)
                                     .ToListAsync();
    }

    public async Task<Post> CreatePostAsync(Post post)
    {
        post.CreatedAt = DateTime.UtcNow;
        post.Likes = 0;
        await _postsCollection.InsertOneAsync(post);
        return post;
    }

    public async Task<Post?> GetPostByIdAsync(string id)
    {
        return await _postsCollection.Find(p => p.Id == id).FirstOrDefaultAsync();
    }

    public async Task<Post?> LikePostAsync(string id, string userId)
    {
        var post = await GetPostByIdAsync(id);
        if (post == null) return null;

        var isLiked = post.LikedBy != null && post.LikedBy.Contains(userId);
        if (isLiked)
        {
            var update = Builders<Post>.Update.Pull(p => p.LikedBy, userId).Inc(p => p.Likes, -1);
            var res = await _postsCollection.FindOneAndUpdateAsync(p => p.Id == id, update, new FindOneAndUpdateOptions<Post> { ReturnDocument = ReturnDocument.After });
            return res;
        }
        else
        {
            var update = Builders<Post>.Update.Push(p => p.LikedBy, userId).Inc(p => p.Likes, 1);
            var res = await _postsCollection.FindOneAndUpdateAsync(p => p.Id == id, update, new FindOneAndUpdateOptions<Post> { ReturnDocument = ReturnDocument.After });
            return res;
        }
    }

    public async Task<bool> DeletePostAsync(string id)
    {
        var result = await _postsCollection.DeleteOneAsync(p => p.Id == id);
        return result.DeletedCount > 0;
    }
}
