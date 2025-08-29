using System.Text.Json.Serialization;
namespace MalatyaAvize.Api.Models;

public class SeedRequest
{
    public bool? Clear { get; set; }
    public List<UserCreateDto>? Users { get; set; }
    public List<ProductCreateDto>? Products { get; set; }
}

public class BootstrapAdminRequest
{
    [JsonPropertyName("username")] public string Username { get; set; } = string.Empty;
    [JsonPropertyName("password")] public string Password { get; set; } = string.Empty;
    [JsonPropertyName("full_name")] public string? Full_Name { get; set; }
    [JsonPropertyName("email")] public string? Email { get; set; }
}
