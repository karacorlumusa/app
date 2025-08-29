using System.Text.Json.Serialization;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MalatyaAvize.Api.Models;

public enum FinanceType
{
    income,
    expense
}

[BsonIgnoreExtraElements]
public class FinanceTransaction
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    [JsonPropertyName("id")] public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    // Legacy Python docs used a plain 'id' field instead of Mongo _id. Keep it for backward compatibility.
    [BsonElement("id")]
    [JsonIgnore]
    public string? Legacy_Id { get; set; }
    [JsonPropertyName("type")]
    [BsonRepresentation(BsonType.String)] // allow reading 'income'/'expense' from existing docs
    public FinanceType Type { get; set; }
    [JsonPropertyName("amount")] public double Amount { get; set; }
    [JsonPropertyName("date")] public DateTime Date { get; set; } = DateTime.UtcNow;
    [JsonPropertyName("category")] public string? Category { get; set; }
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("person")] public string? Person { get; set; }
    [JsonPropertyName("created_by")]
    [BsonElement("created_by")]
    public string? Created_By { get; set; }
    [JsonPropertyName("created_by_name")]
    [BsonElement("created_by_name")]
    public string? Created_By_Name { get; set; }
}

public class FinanceTransactionCreateDto
{
    [JsonPropertyName("type")] public FinanceType Type { get; set; }
    [JsonPropertyName("amount")] public double Amount { get; set; }
    [JsonPropertyName("date")] public DateTime? Date { get; set; }
    [JsonPropertyName("category")] public string? Category { get; set; }
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("person")] public string? Person { get; set; }
}

public class FinanceTransactionUpdateDto
{
    [JsonPropertyName("type")] public FinanceType? Type { get; set; }
    [JsonPropertyName("amount")] public double? Amount { get; set; }
    [JsonPropertyName("date")] public DateTime? Date { get; set; }
    [JsonPropertyName("category")] public string? Category { get; set; }
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("person")] public string? Person { get; set; }
}

public class FinanceSummary
{
    [JsonPropertyName("income")] public double Income { get; set; }
    [JsonPropertyName("expense")] public double Expense { get; set; }
    [JsonPropertyName("net")] public double Net => Math.Round(Income - Expense, 2);
}
