using MalatyaAvize.Api.Data;
using MalatyaAvize.Api.Models;
using MongoDB.Driver;

namespace MalatyaAvize.Api.Services;

public static class ProductMappings
{
    public static ProductResponseDto ToDto(this Product p) => new()
    {
        Id = p.Id,
        Created_At = p.CreatedAt,
        Updated_At = p.UpdatedAt,
        Barcode = p.Barcode,
        Name = p.Name,
        Category = p.Category,
        Brand = p.Brand,
        Stock = p.Stock,
        Min_Stock = p.MinStock,
        Buy_Price = p.BuyPrice,
        Sell_Price = p.SellPrice,
        Tax_Rate = p.TaxRate,
        Supplier = p.Supplier
    };

    public static void ApplyUpdate(this Product p, ProductUpdateDto u)
    {
        if (u.Barcode != null) p.Barcode = u.Barcode;
        if (u.Name != null)
        {
            p.Name = u.Name;
            p.NormalizedName = ProductService.NormalizeName(u.Name);
        }
        if (u.Category != null) p.Category = u.Category;
        if (u.Brand != null) p.Brand = u.Brand;
        if (u.Stock.HasValue) p.Stock = u.Stock.Value;
        if (u.Min_Stock.HasValue) p.MinStock = u.Min_Stock.Value;
        if (u.Buy_Price.HasValue) p.BuyPrice = u.Buy_Price.Value;
        if (u.Sell_Price.HasValue) p.SellPrice = u.Sell_Price.Value;
        if (u.Tax_Rate.HasValue) p.TaxRate = u.Tax_Rate.Value;
        if (u.Supplier != null) p.Supplier = u.Supplier;
        p.UpdatedAt = DateTime.UtcNow;
    }
}

public class ProductService
{
    private readonly MongoContext _db;

    public ProductService(MongoContext db)
    {
        _db = db;
    }

    // Normalize product names to detect duplicates independent of spacing, hyphens, case, turkish diacritics
    public static string NormalizeName(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        var s = raw.Trim().ToLowerInvariant();
        // Replace common Turkish diacritics
        s = s.Replace('ç', 'c').Replace('ğ', 'g').Replace('ı', 'i').Replace('i', 'i').Replace('ö', 'o').Replace('ş', 's').Replace('ü', 'u');
        // Remove spaces, hyphens and underscores
        s = new string(s.Where(ch => !char.IsWhiteSpace(ch) && ch != '-' && ch != '_').ToArray());
        return s;
    }

    public async Task<List<Product>> GetProductsAsync(int skip, int limit, string? search, string? category, bool lowStock)
    {
        var filter = Builders<Product>.Filter.Empty;
        var filters = new List<FilterDefinition<Product>>();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var regex = new MongoDB.Bson.BsonRegularExpression(search, "i");
            filters.Add(Builders<Product>.Filter.Or(
                Builders<Product>.Filter.Regex(x => x.Name, regex),
                Builders<Product>.Filter.Regex(x => x.Barcode, regex),
                Builders<Product>.Filter.Regex(x => x.Brand, regex)
            ));
        }
        if (!string.IsNullOrWhiteSpace(category))
        {
            filters.Add(Builders<Product>.Filter.Eq(x => x.Category, category));
        }
        if (lowStock)
        {
            // Use Where to express stock <= minStock
            filters.Add(Builders<Product>.Filter.Where(x => x.Stock <= x.MinStock));
        }
        if (filters.Count > 0) filter = Builders<Product>.Filter.And(filters);

        return await _db.Products.Find(filter).Skip(skip).Limit(limit).ToListAsync();
    }

    public Task<Product> GetByIdAsync(string id)
        => _db.Products.Find(x => x.Id == id).FirstOrDefaultAsync();

    public Task<Product> GetByBarcodeAsync(string barcode)
        => _db.Products.Find(x => x.Barcode == barcode).FirstOrDefaultAsync();

    public async Task<Product> CreateAsync(ProductCreateDto dto)
    {
        // Enforce unique barcode
        var exists = await GetByBarcodeAsync(dto.Barcode);
        if (exists != null) throw new InvalidOperationException("Barcode already exists");

        // Enforce unique normalized name
        var norm = NormalizeName(dto.Name);
        var nameExists = await _db.Products.Find(x => x.NormalizedName == norm).FirstOrDefaultAsync();
        if (nameExists != null) throw new InvalidOperationException("Aynı isimde ürün mevcut (isim varyasyonu tespit edildi)");

        var p = new Product
        {
            Barcode = dto.Barcode,
            Name = dto.Name,
            NormalizedName = norm,
            Category = dto.Category,
            Brand = dto.Brand,
            Stock = dto.Stock,
            MinStock = dto.Min_Stock,
            BuyPrice = dto.Buy_Price,
            SellPrice = dto.Sell_Price,
            TaxRate = dto.Tax_Rate,
            Supplier = dto.Supplier
        };
        await _db.Products.InsertOneAsync(p);
        return p;
    }

    public async Task<Product?> UpdateAsync(string id, ProductUpdateDto dto)
    {
        var p = await GetByIdAsync(id);
        if (p is null) return null;
        if (dto.Barcode != null && dto.Barcode != p.Barcode)
        {
            var exists = await GetByBarcodeAsync(dto.Barcode);
            if (exists != null) throw new InvalidOperationException("Barcode already exists");
        }
        // If name is changing, check normalized duplicates
        if (dto.Name != null)
        {
            var norm = NormalizeName(dto.Name);
            var nameExists = await _db.Products.Find(x => x.NormalizedName == norm && x.Id != p.Id).FirstOrDefaultAsync();
            if (nameExists != null) throw new InvalidOperationException("Aynı isimde ürün mevcut (isim varyasyonu tespit edildi)");
        }
        p.ApplyUpdate(dto);
        await _db.Products.ReplaceOneAsync(x => x.Id == id, p);
        return p;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _db.Products.DeleteOneAsync(x => x.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<string> GenerateUniqueBarcodeAsync()
    {
        // Simple 13-digit generator with check to avoid collision
        var rnd = new Random();
        for (int i = 0; i < 50; i++)
        {
            var code = string.Concat(Enumerable.Range(0, 13).Select(_ => rnd.Next(0, 10).ToString()));
            var exists = await GetByBarcodeAsync(code);
            if (exists == null) return code;
        }
        throw new Exception("Could not generate unique barcode");
    }
}
