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
        // Disabled to avoid conflicts with existing indices in a shared dev DB.
        // Application enforces uniqueness at service layer.
        return;
    }
}
