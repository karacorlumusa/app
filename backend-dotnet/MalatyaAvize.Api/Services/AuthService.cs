using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Security.Cryptography;
using BCrypt.Net;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using MalatyaAvize.Api.Data;
using MalatyaAvize.Api.Models;

namespace MalatyaAvize.Api.Services;

public class AuthService
{
    private readonly MongoContext _db;
    private readonly string _secret;

    public AuthService(MongoContext db, IConfiguration cfg)
    {
        _db = db;
        _secret = cfg["SECRET_KEY"] ?? "change-me-in-prod";
    }

    public async Task<User?> AuthenticateAsync(string username, string password)
    {
        var user = await _db.Users.Find(x => x.Username == username && x.Active).FirstOrDefaultAsync();
        if (user is null) return null;
        if (!BCrypt.Net.BCrypt.Verify(password, user.Password_Hash)) return null;
        return user;
    }

    public string CreateToken(User user)
    {
        var handler = new JwtSecurityTokenHandler();
        // Derive a 256-bit key to satisfy HMAC-SHA256 requirements
        var key = SHA256.HashData(Encoding.UTF8.GetBytes(_secret));
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(ClaimTypes.Role, user.Role.ToString())
            }),
            Expires = DateTime.UtcNow.AddHours(8),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };
        var token = handler.CreateToken(descriptor);
        return handler.WriteToken(token);
    }
}
