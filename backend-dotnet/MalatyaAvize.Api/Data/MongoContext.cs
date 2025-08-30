using MongoDB.Driver;
using MalatyaAvize.Api.Models;

namespace MalatyaAvize.Api.Data;

public class MongoContext
{
    public IMongoDatabase Database { get; }
    private static bool _indexesEnsured = false;

    public MongoContext(IMongoDatabase database)
    {
        Database = database;
        if (!_indexesEnsured)
        {
            EnsureIndexes();
            _indexesEnsured = true;
        }
    }

    public IMongoCollection<User> Users => Database.GetCollection<User>("users");
    public IMongoCollection<Product> Products => Database.GetCollection<Product>("products");
    public IMongoCollection<StockMovement> StockMovements => Database.GetCollection<StockMovement>("stock_movements");
    public IMongoCollection<Sale> Sales => Database.GetCollection<Sale>("sales");
    public IMongoCollection<FinanceTransaction> Finance => Database.GetCollection<FinanceTransaction>("finance");

    private void EnsureIndexes()
    {
        // Create unique index on products.normalized_name to prevent duplicates like "LedAmpul" vs "Led Ampul".
        try
        {
            var products = Products;
            var indexKeys = Builders<Product>.IndexKeys.Ascending(p => p.NormalizedName);
            var options = new CreateIndexOptions { Unique = true, Name = "ux_products_normalized_name", Sparse = true }; // allow empty values
            products.Indexes.CreateOne(new CreateIndexModel<Product>(indexKeys, options));
        }
        catch
        {
            // Ignore index errors on environments where index already exists or cannot be created.
        }
        return;
    }
}
