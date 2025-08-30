using MalatyaAvize.Api.Data;
using MalatyaAvize.Api.Models;
using MongoDB.Driver;

namespace MalatyaAvize.Api.Services;

public class StockService
{
    private readonly MongoContext _db;
    public StockService(MongoContext db) { _db = db; }

    public async Task<List<StockMovement>> GetMovementsAsync(int skip, int limit, string? productId, string? movementType)
    {
        var filter = Builders<StockMovement>.Filter.Empty;
        var filters = new List<FilterDefinition<StockMovement>>();
        if (!string.IsNullOrWhiteSpace(productId)) filters.Add(Builders<StockMovement>.Filter.Eq(x => x.Product_Id, productId));
        if (!string.IsNullOrWhiteSpace(movementType)) filters.Add(Builders<StockMovement>.Filter.Eq(x => x.Type, movementType));
        if (filters.Count > 0) filter = Builders<StockMovement>.Filter.And(filters);
        return await _db.StockMovements.Find(filter).SortByDescending(x => x.Created_At).Skip(skip).Limit(limit).ToListAsync();
    }

    public async Task<StockMovement> CreateMovementAsync(StockMovement m, string userId)
    {
        var p = await _db.Products.Find(x => x.Id == m.Product_Id).FirstOrDefaultAsync();
        if (p is null) throw new InvalidOperationException("Ürün bulunamadı");
        if (m.Quantity <= 0) throw new InvalidOperationException("Miktar 1 veya daha büyük olmalı");
        if (m.Type != "in" && m.Type != "out") throw new InvalidOperationException("Geçersiz hareket tipi");
        m.Created_By = userId;
        if (m.Unit_Price.HasValue) m.Total_Price = m.Unit_Price.Value * m.Quantity;
        await _db.StockMovements.InsertOneAsync(m);
        // update stock
        if (m.Type == "in") p.Stock += m.Quantity; else p.Stock -= m.Quantity;
        if (p.Stock < 0) p.Stock = 0;
        p.UpdatedAt = DateTime.UtcNow;
        await _db.Products.ReplaceOneAsync(x => x.Id == p.Id, p);
        return m;
    }

    public async Task<List<Product>> GetLowStockProductsAsync()
    {
        return await _db.Products.Find(x => x.Stock <= x.MinStock).ToListAsync();
    }
}
