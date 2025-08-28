using MalatyaAvize.Api.Data;
using MalatyaAvize.Api.Models;
using MongoDB.Driver;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Globalization;

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
        if (dto.Items.Count == 0) throw new InvalidOperationException("No items");
        var items = new List<SaleItem>();
        double subtotal = 0, taxAmount = 0, total = 0;
        foreach (var i in dto.Items)
        {
            // Interpret unit price as VAT-inclusive (gross). Do NOT add KDV on top.
            var grossItemTotal = Math.Round(i.Unit_Price * i.Quantity, 2);
            var rate = (i.Tax_Rate / 100.0);
            var netItemTotal = i.Tax_Rate > 0
                ? Math.Round(grossItemTotal / (1 + rate), 2)
                : grossItemTotal;
            var itemTax = Math.Round(grossItemTotal - netItemTotal, 2);

            items.Add(new SaleItem
            {
                Product_Id = i.Product_Id,
                Barcode = i.Barcode,
                Product_Name = i.Product_Name,
                Quantity = i.Quantity,
                Unit_Price = i.Unit_Price, // gross per unit
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

        // decrease stocks
        foreach (var i in items)
        {
            var p = await _db.Products.Find(x => x.Id == i.Product_Id).FirstOrDefaultAsync();
            if (p != null)
            {
                p.Stock = Math.Max(0, p.Stock - i.Quantity);
                p.UpdatedAt = DateTime.UtcNow;
                await _db.Products.ReplaceOneAsync(x => x.Id == p.Id, p);
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
                            h.Cell().Element(HeaderCell).Text("KDV");
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
                             .BorderBottom(1).BorderColor(Colors.Grey.Lighten2);

                static IContainer DataCell(IContainer container, int row) =>
                    container.PaddingVertical(4).PaddingHorizontal(4)
                             .Background(row % 2 == 0 ? Colors.White : Colors.Grey.Lighten5);

                static IContainer FooterCell(IContainer container) =>
                    container.PaddingVertical(6).PaddingHorizontal(4)
                             .Background(Colors.Grey.Lighten3);
            });
        });

        return doc.GeneratePdf();
    }
}
