# Elektrikçi Dükkanı Stok Yönetim Sistemi - API Contracts

## Backend API Endpoints

### Authentication
- `POST /api/auth/login` - Kullanıcı girişi
- `POST /api/auth/logout` - Kullanıcı çıkışı  
- `GET /api/auth/me` - Mevcut kullanıcı bilgisi

### Users Management (Admin Only)
- `GET /api/users` - Kullanıcı listesi
- `POST /api/users` - Yeni kullanıcı oluştur
- `PUT /api/users/{id}` - Kullanıcı güncelle
- `DELETE /api/users/{id}` - Kullanıcı sil

### Products Management
- `GET /api/products` - Ürün listesi (filtreleme, arama)
- `POST /api/products` - Yeni ürün ekle
- `GET /api/products/{id}` - Ürün detayı
- `PUT /api/products/{id}` - Ürün güncelle
- `DELETE /api/products/{id}` - Ürün sil
- `GET /api/products/barcode/{barcode}` - Barkoda göre ürün bul

### Stock Management
- `GET /api/stock/movements` - Stok hareketleri
- `POST /api/stock/in` - Stok giriş
- `POST /api/stock/out` - Stok çıkış
- `GET /api/stock/low` - Düşük stok uyarıları
- `GET /api/stock/report` - Stok raporu

### Sales Management
- `GET /api/sales` - Satış listesi
- `POST /api/sales` - Yeni satış kaydet
- `GET /api/sales/{id}` - Satış detayı
- `GET /api/sales/daily` - Günlük satış raporu
- `GET /api/sales/reports` - Detaylı satış raporları

### Dashboard
- `GET /api/dashboard/stats` - Genel istatistikler
- `GET /api/dashboard/top-products` - En çok satan ürünler
- `GET /api/dashboard/cashier-performance` - Kasiyer performansı

## Database Models

### User
- id, username, password_hash, full_name, email, role, active, created_at

### Product  
- id, barcode, name, category, brand, stock, min_stock, buy_price, sell_price, tax_rate, supplier, created_at, updated_at

### StockMovement
- id, product_id, type (in/out), quantity, unit_price, total_price, supplier, note, created_by, created_at

### Sale
- id, cashier_id, subtotal, tax_amount, total, created_at

### SaleItem
- id, sale_id, product_id, barcode, product_name, quantity, unit_price, total_price, tax_rate

## Mock Data Integration

### Frontend Mock Replacement:
1. Login component: Remove mock users, use real API
2. Product management: Replace mockProducts with API calls
3. Stock management: Use real stock movements API
4. Sales: Replace mock sales with real API
5. Dashboard: Use real statistics from API

### Frontend Changes Required:
1. Add API service layer (axios calls)
2. Add authentication state management
3. Replace all mock data with API calls
4. Add loading states and error handling
5. Update components to use real data

## Security Features:
- JWT token authentication
- Role-based access control
- Password hashing (bcrypt)
- Input validation and sanitization
- CORS configuration