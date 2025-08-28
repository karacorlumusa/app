using System.Text.Json.Serialization;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MalatyaAvize.Api.Models;

[BsonIgnoreExtraElements]
public class StockMovement
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    [JsonPropertyName("id")] public string Id { get; set; } = ObjectId.GenerateNewId().ToString();
    [JsonPropertyName("created_at")] public DateTime Created_At { get; set; } = DateTime.UtcNow;
    [JsonPropertyName("product_id")] public string Product_Id { get; set; } = string.Empty;
    // 'in' or 'out'
    [JsonPropertyName("type")] public string Type { get; set; } = "in";
    [JsonPropertyName("quantity")] public int Quantity { get; set; }
    [JsonPropertyName("unit_price")] public double? Unit_Price { get; set; }
    [JsonPropertyName("supplier")] public string? Supplier { get; set; }
    [JsonPropertyName("note")] public string? Note { get; set; }
    [JsonPropertyName("created_by")] public string Created_By { get; set; } = string.Empty;
    [JsonPropertyName("total_price")] public double? Total_Price { get; set; }
}
