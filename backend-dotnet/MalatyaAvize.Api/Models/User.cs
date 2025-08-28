using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MalatyaAvize.Api.Models;

public enum UserRole
{
    admin,
    cashier
}

public class BaseDbModel
{
    // Map to Mongo _id and represent as string for convenience
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();
    [BsonElement("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class UserBase
{
    [BsonElement("username")] public string Username { get; set; } = string.Empty;
    [BsonElement("full_name")] public string Full_Name { get; set; } = string.Empty;
    [BsonElement("email")] public string? Email { get; set; }
    [BsonElement("role")] public UserRole Role { get; set; } = UserRole.cashier;
    [BsonElement("active")] public bool Active { get; set; } = true;
}

[BsonIgnoreExtraElements]
public class User : BaseDbModel
{
    [BsonElement("username")] public string Username { get; set; } = string.Empty;
    [BsonElement("full_name")] public string Full_Name { get; set; } = string.Empty;
    [BsonElement("email")] public string? Email { get; set; }
    [BsonElement("role")] public UserRole Role { get; set; } = UserRole.cashier;
    [BsonElement("active")] public bool Active { get; set; } = true;
    [BsonElement("password_hash")] public string Password_Hash { get; set; } = string.Empty;
}

public class UserResponse : BaseDbModel
{
    [BsonElement("username")] public string Username { get; set; } = string.Empty;
    [BsonElement("full_name")] public string Full_Name { get; set; } = string.Empty;
    [BsonElement("email")] public string? Email { get; set; }
    [BsonElement("role")] public UserRole Role { get; set; } = UserRole.cashier;
    [BsonElement("active")] public bool Active { get; set; } = true;
}
