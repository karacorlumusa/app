using MalatyaAvize.Api.Data;
using MalatyaAvize.Api.Models;
using MongoDB.Driver;

namespace MalatyaAvize.Api.Services;

public class FinanceService
{
    private readonly MongoContext _db;
    public FinanceService(MongoContext db) { _db = db; }

    public async Task<List<FinanceTransaction>> GetAsync(
        int skip,
        int limit,
        DateTime? start,
        DateTime? end,
        FinanceType? type,
        string? search)
    {
        var filter = Builders<FinanceTransaction>.Filter.Empty;
        var filters = new List<FilterDefinition<FinanceTransaction>>();
        if (start.HasValue) filters.Add(Builders<FinanceTransaction>.Filter.Gte(x => x.Date, start.Value));
        if (end.HasValue) filters.Add(Builders<FinanceTransaction>.Filter.Lte(x => x.Date, end.Value));
        if (type.HasValue) filters.Add(Builders<FinanceTransaction>.Filter.Eq(x => x.Type, type.Value));
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search;
            var any = Builders<FinanceTransaction>.Filter.Or(
                Builders<FinanceTransaction>.Filter.Regex(x => x.Category, s),
                Builders<FinanceTransaction>.Filter.Regex(x => x.Description, s),
                Builders<FinanceTransaction>.Filter.Regex(x => x.Person, s),
                Builders<FinanceTransaction>.Filter.Regex(x => x.Created_By_Name, s)
            );
            filters.Add(any);
        }
        if (filters.Count > 0) filter = Builders<FinanceTransaction>.Filter.And(filters);
        var list = await _db.Finance.Find(filter).SortByDescending(x => x.Date).Skip(skip).Limit(limit).ToListAsync();
        // Back-compat: If legacy 'id' exists but _id is empty, copy it to Id for consistent API responses
        foreach (var t in list)
        {
            if (!string.IsNullOrWhiteSpace(t.Legacy_Id) && string.IsNullOrWhiteSpace(t.Id))
                t.Id = t.Legacy_Id;
        }
        return list;
    }

    public async Task<FinanceTransaction> CreateAsync(FinanceTransactionCreateDto dto, string? userId, string? userName)
    {
        var tx = new FinanceTransaction
        {
            Type = dto.Type,
            Amount = Math.Round(dto.Amount, 2),
            Date = dto.Date ?? DateTime.UtcNow,
            Category = dto.Category,
            Description = dto.Description,
            Person = dto.Person,
            Created_By = userId,
            Created_By_Name = userName
        };
        await _db.Finance.InsertOneAsync(tx);
        return tx;
    }

    public async Task<FinanceTransaction?> UpdateAsync(string id, FinanceTransactionUpdateDto dto)
    {
        var update = Builders<FinanceTransaction>.Update.Combine(new List<UpdateDefinition<FinanceTransaction>>());
        var defs = new List<UpdateDefinition<FinanceTransaction>>();
        if (dto.Type.HasValue) defs.Add(Builders<FinanceTransaction>.Update.Set(x => x.Type, dto.Type.Value));
        if (dto.Amount.HasValue) defs.Add(Builders<FinanceTransaction>.Update.Set(x => x.Amount, Math.Round(dto.Amount.Value, 2)));
        if (dto.Date.HasValue) defs.Add(Builders<FinanceTransaction>.Update.Set(x => x.Date, dto.Date.Value));
        if (dto.Category != null) defs.Add(Builders<FinanceTransaction>.Update.Set(x => x.Category, dto.Category));
        if (dto.Description != null) defs.Add(Builders<FinanceTransaction>.Update.Set(x => x.Description, dto.Description));
        if (dto.Person != null) defs.Add(Builders<FinanceTransaction>.Update.Set(x => x.Person, dto.Person));
        if (defs.Count == 0) return await _db.Finance.Find(x => x.Id == id).FirstOrDefaultAsync();
        update = Builders<FinanceTransaction>.Update.Combine(defs);
        var res = await _db.Finance.FindOneAndUpdateAsync<FinanceTransaction, FinanceTransaction>(x => x.Id == id, update, new FindOneAndUpdateOptions<FinanceTransaction, FinanceTransaction> { ReturnDocument = ReturnDocument.After });
        return res;
    }

    public Task<bool> DeleteAsync(string id)
    {
        return _db.Finance.DeleteOneAsync(x => x.Id == id).ContinueWith(t => t.Result.DeletedCount == 1);
    }

    public async Task<FinanceSummary> GetSummaryAsync(DateTime? start, DateTime? end, FinanceType? type)
    {
        var filter = Builders<FinanceTransaction>.Filter.Empty;
        var filters = new List<FilterDefinition<FinanceTransaction>>();
        if (start.HasValue) filters.Add(Builders<FinanceTransaction>.Filter.Gte(x => x.Date, start.Value));
        if (end.HasValue) filters.Add(Builders<FinanceTransaction>.Filter.Lte(x => x.Date, end.Value));
        if (type.HasValue) filters.Add(Builders<FinanceTransaction>.Filter.Eq(x => x.Type, type.Value));
        if (filters.Count > 0) filter = Builders<FinanceTransaction>.Filter.And(filters);
        var list = await _db.Finance.Find(filter).ToListAsync();
        var inc = list.Where(x => x.Type == FinanceType.income).Sum(x => x.Amount);
        var exp = list.Where(x => x.Type == FinanceType.expense).Sum(x => x.Amount);
        return new FinanceSummary { Income = Math.Round(inc, 2), Expense = Math.Round(exp, 2) };
    }
}
