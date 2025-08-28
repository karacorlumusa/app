using System.Text.Json.Serialization;

namespace MalatyaAvize.Api.Models;

public class UserCreateDto
{
    [JsonPropertyName("username")] public string Username { get; set; } = string.Empty;
    [JsonPropertyName("full_name")] public string Full_Name { get; set; } = string.Empty;
    [JsonPropertyName("email")] public string? Email { get; set; }
    [JsonPropertyName("role")] public UserRole Role { get; set; } = UserRole.cashier;
    [JsonPropertyName("active")] public bool Active { get; set; } = true;
    [JsonPropertyName("password")] public string Password { get; set; } = string.Empty;
}

public class UserUpdateDto
{
    [JsonPropertyName("username")] public string? Username { get; set; }
    [JsonPropertyName("full_name")] public string? Full_Name { get; set; }
    [JsonPropertyName("email")] public string? Email { get; set; }
    [JsonPropertyName("role")] public UserRole? Role { get; set; }
    [JsonPropertyName("active")] public bool? Active { get; set; }
    [JsonPropertyName("password")] public string? Password { get; set; }
}

public class UserResponseDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
    [JsonPropertyName("created_at")] public DateTime Created_At { get; set; }
    [JsonPropertyName("username")] public string Username { get; set; } = string.Empty;
    [JsonPropertyName("full_name")] public string Full_Name { get; set; } = string.Empty;
    [JsonPropertyName("email")] public string? Email { get; set; }
    [JsonPropertyName("role")] public UserRole Role { get; set; } = UserRole.cashier;
    [JsonPropertyName("active")] public bool Active { get; set; } = true;
}
