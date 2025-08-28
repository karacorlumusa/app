using System.Text.Json.Serialization;

namespace MalatyaAvize.Api.Models;

public class LoginRequest
{
    [JsonPropertyName("username")] public string Username { get; set; } = string.Empty;
    [JsonPropertyName("password")] public string Password { get; set; } = string.Empty;
}

public class LoginResponse
{
    [JsonPropertyName("access_token")] public string Access_Token { get; set; } = string.Empty;
    [JsonPropertyName("token_type")] public string Token_Type { get; set; } = "bearer";
    [JsonPropertyName("user")] public UserResponseDto User { get; set; } = new();
}
