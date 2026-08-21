using System.Threading.Tasks;
using Audit.Api.Models;
using MongoDB.Driver;

namespace Audit.Api.Repositories;

public class AuthRepository : IAuthRepository
{
    private readonly IMongoCollection<User> _usersCollection;

    public AuthRepository(MongoDbContext dbContext)
    {
        _usersCollection = dbContext.Database.GetCollection<User>("users");
    }

    public async Task<bool> UserExistsAsync(string username)
    {
        var usernameLower = username.Trim().ToLowerInvariant();
        return await _usersCollection.Find(u => u.Username.ToLower() == usernameLower).AnyAsync();
    }

    public async Task<User?> GetUserByUsernameAsync(string username)
    {
        var usernameLower = username.Trim().ToLowerInvariant();
        return await _usersCollection.Find(u => u.Username.ToLower() == usernameLower).FirstOrDefaultAsync();
    }

    public async Task<User> CreateUserAsync(User user)
    {
        await _usersCollection.InsertOneAsync(user);
        return user;
    }
}