using MalatyaAvize.Api.Data;
using MalatyaAvize.Api.Models;
using MongoDB.Driver;

namespace MalatyaAvize.Api.Services;

public class UserService
{
    private readonly MongoContext _db;
    public UserService(MongoContext db) { _db = db; }

    public async Task<List<User>> GetUsersAsync(int skip, int limit)
        => await _db.Users.Find(_ => true).Skip(skip).Limit(limit).ToListAsync();

    public async Task<User> CreateAsync(UserCreateDto dto)
    {
        var exists = await _db.Users.Find(x => x.Username == dto.Username).FirstOrDefaultAsync();
        if (exists != null) throw new InvalidOperationException("Username already exists");
        var u = new User
        {
            Username = dto.Username,
            Full_Name = dto.Full_Name,
            Email = dto.Email,
            Role = dto.Role,
            Active = dto.Active,
            Password_Hash = BCrypt.Net.BCrypt.HashPassword(dto.Password)
        };
        await _db.Users.InsertOneAsync(u);
        return u;
    }

    public async Task<User?> UpdateAsync(string id, UserUpdateDto dto)
    {
        var u = await _db.Users.Find(x => x.Id == id).FirstOrDefaultAsync();
        if (u is null) return null;
        if (!string.IsNullOrWhiteSpace(dto.Username) && dto.Username != u.Username)
        {
            var exists = await _db.Users.Find(x => x.Username == dto.Username).FirstOrDefaultAsync();
            if (exists != null) throw new InvalidOperationException("Username already exists");
            u.Username = dto.Username;
        }
        if (dto.Full_Name != null) u.Full_Name = dto.Full_Name;
        if (dto.Email != null) u.Email = dto.Email;
        if (dto.Role.HasValue) u.Role = dto.Role.Value;
        if (dto.Active.HasValue) u.Active = dto.Active.Value;
        if (!string.IsNullOrEmpty(dto.Password)) u.Password_Hash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
        await _db.Users.ReplaceOneAsync(x => x.Id == id, u);
        return u;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _db.Users.DeleteOneAsync(x => x.Id == id);
        return result.DeletedCount > 0;
    }
}

public static class UserMappings
{
    public static UserResponseDto ToDto(this User u) => new()
    {
        Id = u.Id,
        Created_At = u.CreatedAt,
        Username = u.Username,
        Full_Name = u.Full_Name,
        Email = u.Email,
        Role = u.Role,
        Active = u.Active
    };
}
