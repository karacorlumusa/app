using System.Text.Json.Serialization;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MalatyaAvize.Api.Models;

[BsonIgnoreExtraElements]
public class SaleItem
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    [JsonPropertyName("id")] public string Id { get; set; } = ObjectId.GenerateNewId().ToString();
    [JsonPropertyName("product_id")] public string Product_Id { get; set; } = string.Empty;
    [JsonPropertyName("barcode")] public string Barcode { get; set; } = string.Empty;
    [JsonPropertyName("product_name")] public string Product_Name { get; set; } = string.Empty;
    [JsonPropertyName("quantity")] public int Quantity { get; set; }
    [JsonPropertyName("unit_price")] public double Unit_Price { get; set; }
    [JsonPropertyName("tax_rate")] public int Tax_Rate { get; set; }
    [JsonPropertyName("total_price")] public double Total_Price { get; set; }
}

[BsonIgnoreExtraElements]
public class Sale
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    [JsonPropertyName("id")] public string Id { get; set; } = ObjectId.GenerateNewId().ToString();
    [JsonPropertyName("created_at")] public DateTime Created_At { get; set; } = DateTime.UtcNow;
    [JsonPropertyName("cashier_id")] public string Cashier_Id { get; set; } = string.Empty;
    [JsonPropertyName("items")] public List<SaleItem> Items { get; set; } = new();
    [JsonPropertyName("subtotal")] public double Subtotal { get; set; }
    [JsonPropertyName("tax_amount")] public double Tax_Amount { get; set; }
    [JsonPropertyName("total")] public double Total { get; set; }
}

public class SaleCreateDto
{
    [JsonPropertyName("items")] public List<SaleItemCreateDto> Items { get; set; } = new();
}

public class SaleItemCreateDto
{
    [JsonPropertyName("product_id")] public string Product_Id { get; set; } = string.Empty;
    [JsonPropertyName("barcode")] public string Barcode { get; set; } = string.Empty;
    [JsonPropertyName("product_name")] public string Product_Name { get; set; } = string.Empty;
    [JsonPropertyName("quantity")] public int Quantity { get; set; }
    [JsonPropertyName("unit_price")] public double Unit_Price { get; set; }
    [JsonPropertyName("tax_rate")] public int Tax_Rate { get; set; }
}

public class DashboardStats
{
    [JsonPropertyName("total_products")] public int Total_Products { get; set; }
    [JsonPropertyName("total_stock")] public int Total_Stock { get; set; }
    [JsonPropertyName("daily_revenue")] public double Daily_Revenue { get; set; }
    [JsonPropertyName("low_stock_count")] public int Low_Stock_Count { get; set; }
    [JsonPropertyName("daily_items_sold")] public int Daily_Items_Sold { get; set; }
    [JsonPropertyName("total_sales")] public int Total_Sales { get; set; }
}

public class TopProduct
{
    [JsonPropertyName("product_id")] public string Product_Id { get; set; } = string.Empty;
    [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;
    [JsonPropertyName("category")] public string Category { get; set; } = string.Empty;
    [JsonPropertyName("quantity_sold")] public int Quantity_Sold { get; set; }
    [JsonPropertyName("revenue")] public double Revenue { get; set; }
}

public class CashierPerformance
{
    [JsonPropertyName("cashier_name")] public string Cashier_Name { get; set; } = string.Empty;
    [JsonPropertyName("sales_count")] public int Sales_Count { get; set; }
    [JsonPropertyName("total_revenue")] public double Total_Revenue { get; set; }
    [JsonPropertyName("average_sale")] public double Average_Sale { get; set; }
}
