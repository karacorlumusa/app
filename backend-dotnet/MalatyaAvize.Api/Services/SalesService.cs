using MalatyaAvize.Api.Data;
using MalatyaAvize.Api.Models;
using MongoDB.Driver;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Globalization;
using Serilog;

namespace MalatyaAvize.Api.Services;

public class SalesService
{
    private readonly MongoContext _db;
    public SalesService(MongoContext db) { _db = db; }

    public async Task<List<Sale>> GetSalesAsync(int skip, int limit, DateTime? start, DateTime? end, string? cashierId)
    {
        var filter = Builders<Sale>.Filter.Empty;
        var filters = new List<FilterDefinition<Sale>>();
        if (start.HasValue) filters.Add(Builders<Sale>.Filter.Gte(x => x.Created_At, start.Value));
        if (end.HasValue) filters.Add(Builders<Sale>.Filter.Lte(x => x.Created_At, end.Value));
        if (!string.IsNullOrWhiteSpace(cashierId)) filters.Add(Builders<Sale>.Filter.Eq(x => x.Cashier_Id, cashierId));
        if (filters.Count > 0) filter = Builders<Sale>.Filter.And(filters);
        return await _db.Sales.Find(filter).SortByDescending(x => x.Created_At).Skip(skip).Limit(limit).ToListAsync();
    }

    public Task<Sale> GetByIdAsync(string id) => _db.Sales.Find(x => x.Id == id).FirstOrDefaultAsync();

    public async Task<Sale> CreateAsync(SaleCreateDto dto, string cashierId)
    {
        if (dto.Items.Count == 0) throw new InvalidOperationException("Sepet boş (ürün yok)");
        var items = new List<SaleItem>();
        // Fetch products up-front for validation
        var ids = dto.Items.Select(i => i.Product_Id).Where(id => !string.IsNullOrWhiteSpace(id)).Distinct().ToList();
        var products = ids.Count == 0
            ? new List<Product>()
            : await _db.Products.Find(p => ids.Contains(p.Id)).ToListAsync();
        var map = products.ToDictionary(p => p.Id, p => p);
        double subtotal = 0, taxAmount = 0, total = 0;
        foreach (var i in dto.Items)
        {
            if (i.Quantity <= 0) throw new InvalidOperationException("Geçersiz miktar (1 veya daha büyük olmalı)");
            if (i.Unit_Price <= 0) throw new InvalidOperationException("Geçersiz birim fiyat (0'dan büyük olmalı)");
            if (!map.TryGetValue(i.Product_Id, out var p))
                throw new InvalidOperationException($"Ürün bulunamadı: {i.Product_Name} ({i.Barcode})");
            if (i.Quantity > p.Stock)
                throw new InvalidOperationException($"Yetersiz stok: {p.Name} (mevcut {p.Stock}, istenen {i.Quantity})");
            // Interpret unit price as VAT-exclusive (net). Add KDV on top.
            var rate = (i.Tax_Rate / 100.0);
            var netItemTotal = Math.Round(i.Unit_Price * i.Quantity, 2);
            var itemTax = Math.Round(netItemTotal * rate, 2);
            var grossItemTotal = Math.Round(netItemTotal + itemTax, 2);

            items.Add(new SaleItem
            {
                Product_Id = i.Product_Id,
                Barcode = i.Barcode,
                Product_Name = i.Product_Name,
                Quantity = i.Quantity,
                Unit_Price = i.Unit_Price, // net per unit
                Tax_Rate = i.Tax_Rate,
                Total_Price = grossItemTotal // store gross total per line
            });

            subtotal += netItemTotal;
            taxAmount += itemTax;
            total += grossItemTotal;
        }
        subtotal = Math.Round(subtotal, 2);
        taxAmount = Math.Round(taxAmount, 2);
        total = Math.Round(total, 2);

        var sale = new Sale
        {
            Cashier_Id = cashierId,
            Items = items,
            Subtotal = Math.Round(subtotal, 2),
            Tax_Amount = Math.Round(taxAmount, 2),
            Total = total
        };
        await _db.Sales.InsertOneAsync(sale);

        // decrease stocks (best-effort and robust): atomic $inc, then clamp to zero if needed; log failures
        foreach (var i in items)
        {
            try
            {
                // Atomic decrement
                var filter = Builders<Product>.Filter.Eq(x => x.Id, i.Product_Id);
                var update = Builders<Product>.Update
                    .Inc(x => x.Stock, -i.Quantity)
                    .Set(x => x.UpdatedAt, DateTime.UtcNow);
                var res = await _db.Products.UpdateOneAsync(filter, update);
                if (res.MatchedCount == 0)
                {
                    Log.Warning("Stock update: product not found {ProductId} after sale {SaleId}", i.Product_Id, sale.Id);
                    continue;
                }
                // Clamp to zero if negative (concurrency safety)
                var p2 = await _db.Products.Find(filter).FirstOrDefaultAsync();
                if (p2 != null && p2.Stock < 0)
                {
                    await _db.Products.UpdateOneAsync(filter, Builders<Product>.Update.Set(x => x.Stock, 0).Set(x => x.UpdatedAt, DateTime.UtcNow));
                }
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Stock update failed for product {ProductId} after sale {SaleId}", i.Product_Id, sale.Id);
            }
        }
        return sale;
    }

    public async Task<object> GetDailyStatsAsync(DateTime? date)
    {
        var day = date?.Date ?? DateTime.UtcNow.Date;
        var next = day.AddDays(1);
        var sales = await GetSalesAsync(0, 100000, day, next, null);
        var dailyRevenue = sales.Sum(s => s.Total);
        var itemCount = sales.Sum(s => s.Items.Sum(i => i.Quantity));
        return new { date = day, total_sales = sales.Count, daily_revenue = dailyRevenue, daily_items_sold = itemCount };
    }

    public async Task<byte[]> GenerateIrsaliyePdfAsync(List<Sale> sales, DateTime start, DateTime end, string companyName, string companyAddress)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        // Map cashier ids to full names to avoid showing raw IDs
        var cashierIds = sales.Select(s => s.Cashier_Id).Where(id => !string.IsNullOrWhiteSpace(id)).Distinct().ToList();
        var users = cashierIds.Count == 0
            ? new List<User>()
            : await _db.Users.Find(u => cashierIds.Contains(u.Id)).ToListAsync();
        var nameMap = users.ToDictionary(u => u.Id, u => string.IsNullOrWhiteSpace(u.Full_Name) ? u.Username : u.Full_Name);

        // Format TRY without relying on OS cultures (Docker may run in globalization-invariant mode)
        string TL(double v)
        {
            // 12345.67 -> "12,345.67" (Invariant), then convert to Turkish-like format: "12.345,67 ₺"
            var s = v.ToString("N2", CultureInfo.InvariantCulture);
            s = s.Replace(",", "|").Replace(".", ",").Replace("|", ".");
            return s + " ₺";
        }

        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(30);
                page.Header().Column(h =>
                {
                    h.Item().Text(companyName).SemiBold().FontSize(22);
                    h.Item().Text(companyAddress).FontSize(10).FontColor(Colors.Grey.Darken2);
                });

                page.Content().Column(col =>
                {
                    col.Item().Text("Sevk İrsaliyesi (Aylık Rapor)").SemiBold().FontSize(16);
                    col.Item().Text($"Dönem: {start:dd.MM.yyyy} - {end.AddSeconds(-1):dd.MM.yyyy}").FontColor(Colors.Grey.Darken2);
                    col.Spacing(6);
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn(2); // Tarih
                            c.RelativeColumn(2); // Kasiyer
                            c.RelativeColumn(1); // Ürün Adedi
                            c.RelativeColumn(1); // Ara Toplam
                            c.RelativeColumn(1); // KDV
                            c.RelativeColumn(1); // Toplam
                        });

                        table.Header(h =>
                        {
                            h.Cell().Element(HeaderCell).Text("Tarih");
                            h.Cell().Element(HeaderCell).Text("Kasiyer");
                            h.Cell().Element(HeaderCell).Text("Ürün Adedi");
                            h.Cell().Element(HeaderCell).Text("Ara Toplam");
                            h.Cell().Element(HeaderCell).Text("KDV (% Oran)");
                            h.Cell().Element(HeaderCell).Text("Toplam");
                        });

                        double totalSub = 0, totalTax = 0, totalSum = 0;
                        var rowIndex = 0;
                        foreach (var s in sales)
                        {
                            var itemCount = s.Items.Sum(i => i.Quantity);
                            var cashierName = nameMap.TryGetValue(s.Cashier_Id, out var nm) ? nm : "-";
                            var r = rowIndex++;

                            table.Cell().Element(c => DataCell(c, r)).Text(s.Created_At.ToLocalTime().ToString("dd.MM.yyyy HH:mm"));
                            table.Cell().Element(c => DataCell(c, r)).Text(cashierName);
                            table.Cell().Element(c => DataCell(c, r)).Text(t => { t.Span(itemCount.ToString()); t.AlignRight(); });
                            table.Cell().Element(c => DataCell(c, r)).Text(t => { t.Span(TL(s.Subtotal)); t.AlignRight(); });
                            table.Cell().Element(c => DataCell(c, r)).Text(t => { t.Span(TL(s.Tax_Amount)); t.AlignRight(); });
                            table.Cell().Element(c => DataCell(c, r)).Text(t => { t.Span(TL(s.Total)); t.AlignRight(); });

                            totalSub += s.Subtotal; totalTax += s.Tax_Amount; totalSum += s.Total;
                        }

                        // Totals row
                        table.Cell().Element(FooterCell).Text("");
                        table.Cell().Element(c => FooterCell(c).DefaultTextStyle(x => x.SemiBold())).Text("TOPLAMLAR");
                        table.Cell().Element(FooterCell).Text("");
                        table.Cell().Element(c => FooterCell(c).DefaultTextStyle(x => x.SemiBold())).Text(t => { t.AlignRight(); t.Span(TL(totalSub)); });
                        table.Cell().Element(c => FooterCell(c).DefaultTextStyle(x => x.SemiBold())).Text(t => { t.AlignRight(); t.Span(TL(totalTax)); });
                        table.Cell().Element(c => FooterCell(c).DefaultTextStyle(x => x.SemiBold())).Text(t => { t.AlignRight(); t.Span(TL(totalSum)); });
                    });
                });

                page.Footer().AlignRight().DefaultTextStyle(x => x.FontSize(9).FontColor(Colors.Grey.Darken2)).Text(txt =>
                {
                    txt.Span("Oluşturma: ");
                    txt.Span(DateTime.Now.ToString("dd.MM.yyyy HH:mm"));
                });

                static IContainer HeaderCell(IContainer container) =>
                    container.DefaultTextStyle(x => x.SemiBold())
                             .PaddingVertical(6).PaddingHorizontal(4)
                             .Background(Colors.Grey.Lighten3)
                             .Border(1).BorderColor(Colors.Grey.Darken2);

                static IContainer DataCell(IContainer container, int row) =>
                    container.PaddingVertical(4).PaddingHorizontal(4)
                             .Background(row % 2 == 0 ? Colors.White : Colors.Grey.Lighten5)
                             .Border(0.5f).BorderColor(Colors.Grey.Darken2);

                static IContainer FooterCell(IContainer container) =>
                    container.PaddingVertical(6).PaddingHorizontal(4)
                             .Background(Colors.Grey.Lighten3)
                             .Border(1).BorderColor(Colors.Grey.Darken2);
            });
        });

        return doc.GeneratePdf();
    }
}
