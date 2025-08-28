using System.Text.Json.Serialization;

namespace MalatyaAvize.Api.Models;

public class ProductCreateDto
{
    [JsonPropertyName("barcode")] public string Barcode { get; set; } = string.Empty;
    [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;
    [JsonPropertyName("category")] public string Category { get; set; } = string.Empty;
    [JsonPropertyName("brand")] public string Brand { get; set; } = string.Empty;
    [JsonPropertyName("stock")] public int Stock { get; set; }
    [JsonPropertyName("min_stock")] public int Min_Stock { get; set; }
    [JsonPropertyName("buy_price")] public double Buy_Price { get; set; }
    [JsonPropertyName("sell_price")] public double Sell_Price { get; set; }
    [JsonPropertyName("tax_rate")] public int Tax_Rate { get; set; }
    [JsonPropertyName("supplier")] public string? Supplier { get; set; }
}

public class ProductUpdateDto
{
    [JsonPropertyName("barcode")] public string? Barcode { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("category")] public string? Category { get; set; }
    [JsonPropertyName("brand")] public string? Brand { get; set; }
    [JsonPropertyName("stock")] public int? Stock { get; set; }
    [JsonPropertyName("min_stock")] public int? Min_Stock { get; set; }
    [JsonPropertyName("buy_price")] public double? Buy_Price { get; set; }
    [JsonPropertyName("sell_price")] public double? Sell_Price { get; set; }
    [JsonPropertyName("tax_rate")] public int? Tax_Rate { get; set; }
    [JsonPropertyName("supplier")] public string? Supplier { get; set; }
}

public class ProductResponseDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
    [JsonPropertyName("created_at")] public DateTime Created_At { get; set; }
    [JsonPropertyName("updated_at")] public DateTime Updated_At { get; set; }
    [JsonPropertyName("barcode")] public string Barcode { get; set; } = string.Empty;
    [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;
    [JsonPropertyName("category")] public string Category { get; set; } = string.Empty;
    [JsonPropertyName("brand")] public string Brand { get; set; } = string.Empty;
    [JsonPropertyName("stock")] public int Stock { get; set; }
    [JsonPropertyName("min_stock")] public int Min_Stock { get; set; }
    [JsonPropertyName("buy_price")] public double Buy_Price { get; set; }
    [JsonPropertyName("sell_price")] public double Sell_Price { get; set; }
    [JsonPropertyName("tax_rate")] public int Tax_Rate { get; set; }
    [JsonPropertyName("supplier")] public string? Supplier { get; set; }
}
