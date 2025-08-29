using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Security.Claims;
using MongoDB.Driver;
using MalatyaAvize.Api.Models;
using MalatyaAvize.Api.Data;
using MalatyaAvize.Api.Services;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Security.Cryptography;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Malatya Avize Dünyası API (.NET)",
        Version = "v1"
    });
});

// JSON options (keep property names as-is, support snake_case DTOs via attributes)
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = null;
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

// CORS
var corsOrigins = builder.Configuration["CORS_ORIGINS"]?.Split(',') ?? new[] { "http://localhost:3000" };
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(corsOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Mongo + JWT
var mongoUrl = builder.Configuration["MONGO_URL"] ?? Environment.GetEnvironmentVariable("MONGO_URL") ?? "mongodb://mongo:27017";
var dbName = builder.Configuration["DB_NAME"] ?? Environment.GetEnvironmentVariable("DB_NAME") ?? "elektrik_dukkani";
var secret = builder.Configuration["SECRET_KEY"] ?? Environment.GetEnvironmentVariable("SECRET_KEY") ?? "change-me-in-prod";
// Derive a 256-bit key from the secret for HMAC-SHA256
byte[] signingKey = SHA256.HashData(Encoding.UTF8.GetBytes(secret));

builder.Services.AddSingleton<IMongoClient>(_ => new MongoClient(mongoUrl));
builder.Services.AddScoped(sp => sp.GetRequiredService<IMongoClient>().GetDatabase(dbName));
builder.Services.AddScoped<MongoContext>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(signingKey)
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<ProductService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<StockService>();
builder.Services.AddScoped<SalesService>();
builder.Services.AddScoped<FinanceService>();

var app = builder.Build();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapGet("/api", () => Results.Ok(new { message = "Malatya Avize Dünyası .NET API", status = "running" }));
// Lightweight health/probe for auth
app.MapGet("/api/auth/me/health", () => Results.Ok(new { status = "ok" }));
app.MapPost("/api/auth/login", async (AuthService auth, MongoContext db, LoginRequest body) =>
{
    var user = await auth.AuthenticateAsync(body.Username, body.Password);
    if (user is null) return Results.Unauthorized();
    var token = auth.CreateToken(user);
    var resp = new LoginResponse
    {
        Access_Token = token,
        Token_Type = "bearer",
        User = new UserResponseDto { Id = user.Id, Created_At = user.CreatedAt, Username = user.Username, Full_Name = user.Full_Name, Email = user.Email, Role = user.Role, Active = user.Active }
    };
    return Results.Ok(resp);
});

app.MapGet("/api/auth/me", async (ClaimsPrincipal principal, MongoContext db) =>
{
    var username = principal.Identity?.Name;
    if (string.IsNullOrEmpty(username)) return Results.Unauthorized();
    var user = await db.Users.Find(x => x.Username == username).FirstOrDefaultAsync();
    if (user is null) return Results.Unauthorized();
    var resp = new UserResponseDto { Id = user.Id, Created_At = user.CreatedAt, Username = user.Username, Full_Name = user.Full_Name, Email = user.Email, Role = user.Role, Active = user.Active };
    return Results.Ok(resp);
}).RequireAuthorization();

app.MapPost("/api/auth/logout", () => Results.Ok(new { message = "Logout successful" }));

// Products endpoints (mirror FastAPI)
app.MapGet("/api/products",
    async (ProductService svc, int skip = 0, int limit = 50, string? search = null, string? category = null, bool low_stock = false) =>
    {
        var items = await svc.GetProductsAsync(skip, limit, search, category, low_stock);
        return Results.Ok(items.Select(p => p.ToDto()));
    }
).RequireAuthorization();

app.MapGet("/api/products/{id}", async (ProductService svc, string id) =>
{
    var p = await svc.GetByIdAsync(id);
    return p is null ? Results.NotFound() : Results.Ok(p.ToDto());
}).RequireAuthorization();

app.MapGet("/api/products/barcode/{barcode}", async (ProductService svc, string barcode) =>
{
    var p = await svc.GetByBarcodeAsync(barcode);
    return p is null ? Results.NotFound() : Results.Ok(p.ToDto());
}).RequireAuthorization();

app.MapPost("/api/products", async (ClaimsPrincipal principal, ProductService svc, ProductCreateDto body) =>
{
    var role = principal.FindFirstValue(ClaimTypes.Role);
    if (!string.Equals(role, nameof(UserRole.admin), StringComparison.OrdinalIgnoreCase)) return Results.Forbid();
    try
    {
        var p = await svc.CreateAsync(body);
        return Results.Ok(p.ToDto());
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { detail = ex.Message });
    }
}).RequireAuthorization();

app.MapPut("/api/products/{id}", async (ClaimsPrincipal principal, ProductService svc, string id, ProductUpdateDto body) =>
{
    var role = principal.FindFirstValue(ClaimTypes.Role);
    if (!string.Equals(role, nameof(UserRole.admin), StringComparison.OrdinalIgnoreCase)) return Results.Forbid();
    try
    {
        var p = await svc.UpdateAsync(id, body);
        return p is null ? Results.NotFound() : Results.Ok(p.ToDto());
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { detail = ex.Message });
    }
}).RequireAuthorization();

app.MapDelete("/api/products/{id}", async (ClaimsPrincipal principal, ProductService svc, string id) =>
{
    var role = principal.FindFirstValue(ClaimTypes.Role);
    if (!string.Equals(role, nameof(UserRole.admin), StringComparison.OrdinalIgnoreCase)) return Results.Forbid();
    var ok = await svc.DeleteAsync(id);
    return ok ? Results.Ok(new { message = "Product deleted successfully" }) : Results.NotFound();
}).RequireAuthorization();

app.MapGet("/api/products/generate-barcode", async (ClaimsPrincipal principal, ProductService svc) =>
{
    var role = principal.FindFirstValue(ClaimTypes.Role);
    if (!string.Equals(role, nameof(UserRole.admin), StringComparison.OrdinalIgnoreCase)) return Results.Forbid();
    var code = await svc.GenerateUniqueBarcodeAsync();
    return Results.Ok(new { barcode = code });
}).RequireAuthorization();

// Seed default users/products on first run (dev parity)
// Dynamic DEV seed (no hardcoded data). Requires Development env + admin.
app.MapPost("/api/dev/seed", async (
    ClaimsPrincipal principal,
    MongoContext db,
    UserService userSvc,
    ProductService productSvc,
    SeedRequest req
) =>
{
    if (!app.Environment.IsDevelopment()) return Results.Forbid();
    var role = principal.FindFirstValue(ClaimTypes.Role);
    if (!string.Equals(role, nameof(UserRole.admin), StringComparison.OrdinalIgnoreCase)) return Results.Forbid();

    var summary = new { created_users = 0, created_products = 0, cleared = false };

    // Optionally clear
    if (req.Clear == true)
    {
        await db.Users.DeleteManyAsync(_ => true);
        await db.Products.DeleteManyAsync(_ => true);
        await db.Sales.DeleteManyAsync(_ => true);
        await db.StockMovements.DeleteManyAsync(_ => true);
        await db.Finance.DeleteManyAsync(_ => true);
        summary = new { created_users = 0, created_products = 0, cleared = true };
    }

    var usersCount = 0;
    if (req.Users != null)
    {
        foreach (var u in req.Users)
        {
            try { await userSvc.CreateAsync(u); usersCount++; } catch { /* skip duplicates */ }
        }
    }

    var productsCount = 0;
    if (req.Products != null)
    {
        foreach (var p in req.Products)
        {
            try { await productSvc.CreateAsync(p); productsCount++; } catch { /* skip duplicates */ }
        }
    }

    return Results.Ok(new { message = "Seed complete", cleared = summary.cleared, created_users = usersCount, created_products = productsCount });
}).RequireAuthorization();

// DEV ONLY: set password for a user (useful to reset admin password during debugging)
app.MapPost("/api/dev/set-password", async (ClaimsPrincipal principal, MongoContext db, string username, string password) =>
{
    if (!app.Environment.IsDevelopment()) return Results.Forbid();
    var role = principal.FindFirstValue(ClaimTypes.Role);
    if (!string.Equals(role, nameof(UserRole.admin), StringComparison.OrdinalIgnoreCase)) return Results.Forbid();
    var user = await db.Users.Find(x => x.Username == username).FirstOrDefaultAsync();
    if (user is null) return Results.NotFound(new { detail = "User not found" });
    user.Password_Hash = BCrypt.Net.BCrypt.HashPassword(password);
    await db.Users.ReplaceOneAsync(x => x.Id == user.Id, user);
    return Results.Ok(new { message = "Password updated" });
}).RequireAuthorization();

// DEV ONLY: Bootstrap first admin if database has no users
app.MapPost("/api/dev/bootstrap-admin", async (MongoContext db, BootstrapAdminRequest req) =>
{
    if (!app.Environment.IsDevelopment()) return Results.Forbid();
    var count = await db.Users.CountDocumentsAsync(_ => true);
    if (count > 0) return Results.BadRequest(new { detail = "Users already exist" });
    if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
        return Results.BadRequest(new { detail = "username and password required" });
    var user = new User
    {
        Username = req.Username.Trim(),
        Full_Name = string.IsNullOrWhiteSpace(req.Full_Name) ? req.Username : req.Full_Name!.Trim(),
        Email = req.Email,
        Role = UserRole.admin,
        Active = true,
        Password_Hash = BCrypt.Net.BCrypt.HashPassword(req.Password)
    };
    await db.Users.InsertOneAsync(user);
    return Results.Ok(new { message = "Admin created", id = user.Id, username = user.Username });
});


// Users (admin-only) - for simplicity, authorization attribute only; implement role check later if needed
app.MapGet("/api/users", async (ClaimsPrincipal principal, UserService svc, int skip = 0, int limit = 50) =>
{
    var role = principal.FindFirstValue(ClaimTypes.Role);
    if (!string.Equals(role, nameof(UserRole.admin), StringComparison.OrdinalIgnoreCase)) return Results.Forbid();
    var users = await svc.GetUsersAsync(skip, limit);
    return Results.Ok(users.Select(u => u.ToDto()));
}).RequireAuthorization();

app.MapPost("/api/users", async (ClaimsPrincipal principal, UserService svc, UserCreateDto body) =>
{
    var role = principal.FindFirstValue(ClaimTypes.Role);
    if (!string.Equals(role, nameof(UserRole.admin), StringComparison.OrdinalIgnoreCase)) return Results.Forbid();
    try
    {
        var u = await svc.CreateAsync(body);
        return Results.Ok(u.ToDto());
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { detail = ex.Message });
    }
}).RequireAuthorization();

app.MapPut("/api/users/{id}", async (ClaimsPrincipal principal, UserService svc, string id, UserUpdateDto body) =>
{
    var role = principal.FindFirstValue(ClaimTypes.Role);
    if (!string.Equals(role, nameof(UserRole.admin), StringComparison.OrdinalIgnoreCase)) return Results.Forbid();
    try
    {
        var u = await svc.UpdateAsync(id, body);
        return u is null ? Results.NotFound() : Results.Ok(u.ToDto());
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { detail = ex.Message });
    }
}).RequireAuthorization();

app.MapDelete("/api/users/{id}", async (ClaimsPrincipal principal, UserService svc, string id) =>
{
    var role = principal.FindFirstValue(ClaimTypes.Role);
    if (!string.Equals(role, nameof(UserRole.admin), StringComparison.OrdinalIgnoreCase)) return Results.Forbid();
    var ok = await svc.DeleteAsync(id);
    return ok ? Results.Ok(new { message = "User deleted successfully" }) : Results.NotFound();
}).RequireAuthorization();

// Stock
app.MapGet("/api/stock/movements", async (StockService svc, int skip = 0, int limit = 50, string? product_id = null, string? movement_type = null) =>
{
    var list = await svc.GetMovementsAsync(skip, limit, product_id, movement_type);
    return Results.Ok(list);
}).RequireAuthorization();

app.MapPost("/api/stock/movement", async (StockService svc, ClaimsPrincipal principal, StockMovement body) =>
{
    var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();
    try
    {
        var m = await svc.CreateMovementAsync(body, userId);
        return Results.Ok(m);
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { detail = ex.Message });
    }
}).RequireAuthorization();

app.MapGet("/api/stock/low", async (StockService svc) =>
{
    var items = await svc.GetLowStockProductsAsync();
    return Results.Ok(items.Select(p => p.ToDto()));
}).RequireAuthorization();

// Sales
app.MapGet("/api/sales", async (SalesService svc, ClaimsPrincipal principal, int skip = 0, int limit = 50, DateTime? start_date = null, DateTime? end_date = null) =>
{
    string? cashierId = null;
    var role = principal.FindFirstValue(ClaimTypes.Role);
    if (!string.Equals(role, nameof(UserRole.admin), StringComparison.OrdinalIgnoreCase))
        cashierId = principal.FindFirstValue(ClaimTypes.NameIdentifier);

    var list = await svc.GetSalesAsync(skip, limit, start_date, end_date, cashierId);
    return Results.Ok(list);
}).RequireAuthorization();

app.MapPost("/api/sales", async (SalesService svc, ClaimsPrincipal principal, SaleCreateDto body) =>
{
    var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();
    try
    {
        var sale = await svc.CreateAsync(body, userId);
        return Results.Ok(sale);
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { detail = ex.Message });
    }
}).RequireAuthorization();

app.MapGet("/api/sales/{id}", async (SalesService svc, ClaimsPrincipal principal, string id) =>
{
    var sale = await svc.GetByIdAsync(id);
    if (sale is null) return Results.NotFound();
    var role = principal.FindFirstValue(ClaimTypes.Role);
    if (!string.Equals(role, nameof(UserRole.admin), StringComparison.OrdinalIgnoreCase))
    {
        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.Equals(userId, sale.Cashier_Id, StringComparison.Ordinal)) return Results.Forbid();
    }
    return Results.Ok(sale);
}).RequireAuthorization();

app.MapGet("/api/sales/reports/daily", async (SalesService svc, DateTime? date) =>
{
    var stats = await svc.GetDailyStatsAsync(date);
    return Results.Ok(stats);
}).RequireAuthorization();

// İrsaliye PDF
app.MapGet("/api/sales/reports/irsaliye", async (SalesService svc, ClaimsPrincipal principal, DateTime? start_date, DateTime? end_date, IConfiguration cfg) =>
{
    var now = DateTime.UtcNow;
    var start = start_date ?? new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
    var end = end_date ?? start.AddMonths(1);
    string? cashierId = null;
    var role = principal.FindFirstValue(ClaimTypes.Role);
    if (!string.Equals(role, nameof(UserRole.admin), StringComparison.OrdinalIgnoreCase))
        cashierId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    var sales = await svc.GetSalesAsync(0, 100000, start, end, cashierId);
    var company = cfg["COMPANY_NAME"] ?? "Malatya Avize Dünyası";
    var address = cfg["COMPANY_ADDRESS"] ?? "Malatya, Türkiye";
    var pdf = await svc.GenerateIrsaliyePdfAsync(sales, start, end, company, address);
    var fileName = $"irsaliye_{start:yyyy-MM}.pdf";
    return Results.File(pdf, "application/pdf", fileName);
}).RequireAuthorization();

// Finance
app.MapGet("/api/finance/transactions", async (FinanceService svc, int? skip = null, int? limit = null, DateTime? start_date = null, DateTime? end_date = null, string? type = null, string? search = null) =>
{
    FinanceType? parsedType = null;
    if (!string.IsNullOrWhiteSpace(type) && !string.Equals(type, "all", StringComparison.OrdinalIgnoreCase))
    {
        if (Enum.TryParse<FinanceType>(type, true, out var t)) parsedType = t;
    }
    var sk = skip ?? 0;
    var lm = limit ?? 50;
    var list = await svc.GetAsync(sk, Math.Clamp(lm <= 0 ? 100 : lm, 1, 1000), start_date, end_date, parsedType, search);
    return Results.Ok(list);
}).RequireAuthorization();

app.MapPost("/api/finance/transactions", async (FinanceService svc, ClaimsPrincipal principal, FinanceTransactionCreateDto body) =>
{
    var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    var fullName = principal.Identity?.Name ?? string.Empty;
    var tx = await svc.CreateAsync(body, userId, fullName);
    return Results.Ok(tx);
}).RequireAuthorization();

app.MapPut("/api/finance/transactions/{id}", async (FinanceService svc, string id, FinanceTransactionUpdateDto body) =>
{
    var tx = await svc.UpdateAsync(id, body);
    return tx is null ? Results.NotFound() : Results.Ok(tx);
}).RequireAuthorization();

app.MapDelete("/api/finance/transactions/{id}", async (FinanceService svc, string id) =>
{
    var ok = await svc.DeleteAsync(id);
    return ok ? Results.Ok(new { ok = true }) : Results.NotFound();
}).RequireAuthorization();

app.MapGet("/api/finance/summary", async (FinanceService svc, DateTime? start_date, DateTime? end_date, string? type) =>
{
    FinanceType? parsedType = null;
    if (!string.IsNullOrWhiteSpace(type) && !string.Equals(type, "all", StringComparison.OrdinalIgnoreCase))
    {
        if (Enum.TryParse<FinanceType>(type, true, out var t)) parsedType = t;
    }
    var s = await svc.GetSummaryAsync(start_date, end_date, parsedType);
    return Results.Ok(s);
}).RequireAuthorization();

// Dashboard
app.MapGet("/api/dashboard/stats", async (MongoContext db) =>
{
    var totalProducts = (int)await db.Products.CountDocumentsAsync(_ => true);
    var all = await db.Products.Find(_ => true).ToListAsync();
    var totalStock = all.Sum(p => p.Stock);
    // rough daily revenue based on sales for today
    var today = DateTime.UtcNow.Date; var next = today.AddDays(1);
    var dailySales = await db.Sales.Find(x => x.Created_At >= today && x.Created_At < next).ToListAsync();
    var dailyRevenue = dailySales.Sum(s => s.Total);
    var lowStockCount = all.Count(p => p.Stock <= p.MinStock);
    var dailyItemsSold = dailySales.Sum(s => s.Items.Sum(i => i.Quantity));
    var stats = new DashboardStats
    {
        Total_Products = totalProducts,
        Total_Stock = totalStock,
        Daily_Revenue = dailyRevenue,
        Low_Stock_Count = lowStockCount,
        Daily_Items_Sold = dailyItemsSold,
        Total_Sales = (int)await db.Sales.CountDocumentsAsync(_ => true)
    };
    return Results.Ok(stats);
}).RequireAuthorization();

app.MapGet("/api/dashboard/top-products", async (MongoContext db, int limit) =>
{
    var sales = await db.Sales.Find(_ => true).ToListAsync();
    var grouped = sales.SelectMany(s => s.Items)
        .GroupBy(i => new { i.Product_Id, i.Product_Name })
        .Select(g => new TopProduct
        {
            Product_Id = g.Key.Product_Id,
            Name = g.Key.Product_Name,
            Category = "",
            Quantity_Sold = g.Sum(x => x.Quantity),
            Revenue = g.Sum(x => x.Total_Price)
        })
        .OrderByDescending(x => x.Quantity_Sold)
        .Take(Math.Max(1, Math.Min(20, limit)))
        .ToList();
    return Results.Ok(grouped);
}).RequireAuthorization();

app.MapGet("/api/dashboard/cashier-performance", async (MongoContext db) =>
{
    var sales = await db.Sales.Find(_ => true).ToListAsync();
    var ids = sales.Select(s => s.Cashier_Id).Where(id => !string.IsNullOrWhiteSpace(id)).Distinct().ToList();
    var users = ids.Count == 0 ? new List<User>() : await db.Users.Find(u => ids.Contains(u.Id)).ToListAsync();
    var nameMap = users.ToDictionary(u => u.Id, u => string.IsNullOrWhiteSpace(u.Full_Name) ? (u.Username ?? u.Id) : u.Full_Name);

    var byCashier = sales.GroupBy(s => s.Cashier_Id)
        .Select(g => new CashierPerformance
        {
            Cashier_Name = (!string.IsNullOrWhiteSpace(g.Key) && nameMap.TryGetValue(g.Key, out var nm))
                ? nm
                : (string.IsNullOrWhiteSpace(g.Key) ? "Bilinmiyor" : g.Key),
            Sales_Count = g.Count(),
            Total_Revenue = g.Sum(x => x.Total),
            Average_Sale = g.Average(x => x.Total)
        }).ToList();
    return Results.Ok(byCashier);
}).RequireAuthorization();

app.Run();
