using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MalatyaAvize.Api.Models;

[BsonIgnoreExtraElements]
public class Product
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();
    [BsonElement("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [BsonElement("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    [BsonElement("barcode")] public string Barcode { get; set; } = string.Empty;
    [BsonElement("name")] public string Name { get; set; } = string.Empty;
    [BsonElement("category")] public string Category { get; set; } = string.Empty;
    [BsonElement("brand")] public string Brand { get; set; } = string.Empty;
    [BsonElement("stock")] public int Stock { get; set; }
    [BsonElement("min_stock")] public int MinStock { get; set; }
    [BsonElement("buy_price")] public double BuyPrice { get; set; }
    [BsonElement("sell_price")] public double SellPrice { get; set; }
    [BsonElement("tax_rate")] public int TaxRate { get; set; }
    [BsonElement("supplier")] public string? Supplier { get; set; }
}
