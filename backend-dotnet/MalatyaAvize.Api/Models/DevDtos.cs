namespace MalatyaAvize.Api.Models;

public class SeedRequest
{
    public bool? Clear { get; set; }
    public List<UserCreateDto>? Users { get; set; }
    public List<ProductCreateDto>? Products { get; set; }
}
