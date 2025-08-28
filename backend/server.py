from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import uuid
import os
import logging
from datetime import datetime, timedelta
from typing import List, Optional

# Import our modules
from .models import *
from .database import connect_to_mongo, close_mongo_connection
from .auth import authenticate_user, create_access_token, get_current_user, get_current_admin_user, create_admin_user_if_not_exists
from .services import UserService, ProductService, StockService, SalesService, DashboardService

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Malatya Avize Aydınlatma - Stok ve Satış Sistemi",
    description="Malatya Avize Aydınlatma için stok ve satış yönetim sistemi",
    version="1.0.0"
)

# CORS middleware (read allowed origins from env, comma-separated)
origins_env = os.getenv("CORS_ORIGINS", "http://localhost:3000")
allow_origins = [o.strip() for o in origins_env.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create API router
api_router = APIRouter(prefix="/api")

# Health check
@api_router.get("/")
async def root():
    return {"message": "Malatya Avize Aydınlatma API v1.0", "status": "running"}

# Authentication endpoints
@api_router.post("/auth/login", response_model=LoginResponse)
async def login(login_data: LoginRequest):
    user = await authenticate_user(login_data.username, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    access_token = create_access_token(data={"sub": user.username})
    return LoginResponse(
        access_token=access_token,
        user=UserResponse(**user.dict())
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(**current_user.dict())

@api_router.post("/auth/logout")
async def logout():
    return {"message": "Logout successful"}

# User management endpoints (Admin only)
@api_router.get("/users", response_model=List[UserResponse])
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_admin_user)
):
    users = await UserService.get_users(skip=skip, limit=limit)
    return [UserResponse(**user.dict()) for user in users]

@api_router.post("/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_admin_user)
):
    try:
        user = await UserService.create_user(user_data)
        return UserResponse(**user.dict())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_admin_user)
):
    user = await UserService.update_user(user_id, user_update)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user.dict())

@api_router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: User = Depends(get_current_admin_user)
):
    success = await UserService.delete_user(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

# Product management endpoints
@api_router.get("/products", response_model=List[Product])
async def get_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    low_stock: bool = Query(False),
    current_user: User = Depends(get_current_user)
):
    products = await ProductService.get_products(
        skip=skip, 
        limit=limit, 
        search=search, 
        category=category, 
        low_stock=low_stock
    )
    return products

@api_router.post("/products", response_model=Product)
async def create_product(
    product_data: ProductCreate,
    current_user: User = Depends(get_current_admin_user)
):
    try:
        product = await ProductService.create_product(product_data)
        return product
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/products/barcode/{barcode}", response_model=Product)
async def get_product_by_barcode(
    barcode: str,
    current_user: User = Depends(get_current_user)
):
    product = await ProductService.get_product_by_barcode(barcode)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(
    product_id: str,
    current_user: User = Depends(get_current_user)
):
    product = await ProductService.get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(
    product_id: str,
    product_update: ProductUpdate,
    current_user: User = Depends(get_current_admin_user)
):
    try:
        product = await ProductService.update_product(product_id, product_update)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        return product
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/products/generate-barcode")
async def generate_barcode(
    current_user: User = Depends(get_current_admin_user)
):
    """Generate a unique barcode on the server side."""
    code = await ProductService.generate_unique_barcode()
    return {"barcode": code}

@api_router.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    current_user: User = Depends(get_current_admin_user)
):
    success = await ProductService.delete_product(product_id)
    if not success:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted successfully"}

# Stock management endpoints
@api_router.get("/stock/movements", response_model=List[StockMovement])
async def get_stock_movements(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    product_id: Optional[str] = Query(None),
    movement_type: Optional[StockMovementType] = Query(None),
    current_user: User = Depends(get_current_user)
):
    movements = await StockService.get_movements(
        skip=skip, 
        limit=limit, 
        product_id=product_id, 
        movement_type=movement_type
    )
    return movements

@api_router.post("/stock/movement", response_model=StockMovement)
async def create_stock_movement(
    movement_data: StockMovementCreate,
    current_user: User = Depends(get_current_user)
):
    try:
        movement = await StockService.create_movement(movement_data, current_user.id)
        return movement
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/stock/low", response_model=List[Product])
async def get_low_stock_products(
    current_user: User = Depends(get_current_user)
):
    return await StockService.get_low_stock_products()

# Sales management endpoints
@api_router.get("/sales", response_model=List[Sale])
async def get_sales(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user)
):
    # Cashiers can only see their own sales
    cashier_id = None if current_user.role == UserRole.admin else current_user.id
    
    sales = await SalesService.get_sales(
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        cashier_id=cashier_id
    )
    return sales

@api_router.post("/sales", response_model=Sale)
async def create_sale(
    sale_data: SaleCreate,
    current_user: User = Depends(get_current_user)
):
    try:
        sale = await SalesService.create_sale(sale_data, current_user.id)
        return sale
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/sales/{sale_id}", response_model=Sale)
async def get_sale(
    sale_id: str,
    current_user: User = Depends(get_current_user)
):
    sale = await SalesService.get_sale_by_id(sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    # Cashiers can only see their own sales
    if current_user.role == UserRole.cashier and sale.cashier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return sale

@api_router.get("/sales/reports/daily")
async def get_daily_sales_report(
    date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user)
):
    return await SalesService.get_daily_stats(date)

# Irsaliye (Monthly/Range) PDF Report
@api_router.get("/sales/reports/irsaliye")
async def get_irsaliye_pdf(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Generate a PDF report in 'İrsaliye' style for the given date range.
    If dates are omitted, defaults to current month.
    """
    try:
        # Determine date range
        now = datetime.utcnow()
        if not start_date:
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if not end_date:
            # End of month
            if start_date.month == 12:
                end_date = start_date.replace(year=start_date.year + 1, month=1)
            else:
                end_date = start_date.replace(month=start_date.month + 1)
            end_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0)

        sales = await SalesService.get_sales(
            skip=0, limit=10000, start_date=start_date, end_date=end_date, cashier_id=None if current_user.role == UserRole.admin else current_user.id
        )

        # Build PDF
        from io import BytesIO
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm, topMargin=12*mm, bottomMargin=12*mm)
        styles = getSampleStyleSheet()

        company_name = os.getenv("COMPANY_NAME", "Malatya Avize Aydınlatma")
        company_address = os.getenv("COMPANY_ADDRESS", "Malatya, Türkiye")
        period_text = f"Dönem: {start_date.strftime('%d.%m.%Y')} - {(end_date - timedelta(seconds=1)).strftime('%d.%m.%Y')}"

        elements = []
        elements.append(Paragraph(f"<b>{company_name}</b>", styles['Title']))
        elements.append(Paragraph(company_address, styles['Normal']))
        elements.append(Spacer(1, 6))
        elements.append(Paragraph("<b>Sevk İrsaliyesi (Aylık Rapor)</b>", styles['Heading2']))
        elements.append(Paragraph(period_text, styles['Normal']))
        elements.append(Spacer(1, 8))

        # Table header per typical irsaliye content
        data = [["Tarih", "Satış No", "Ürün Adedi", "Ara Toplam", "KDV", "Toplam"]]

        total_sub = 0.0
        total_tax = 0.0
        total_sum = 0.0

        for s in sales:
            item_count = sum([i.quantity for i in s.items])
            data.append([
                s.created_at.strftime('%d.%m.%Y %H:%M'),
                s.id[-8:],
                item_count,
                f"{s.subtotal:,.2f}",
                f"{s.tax_amount:,.2f}",
                f"{s.total:,.2f}",
            ])
            total_sub += s.subtotal
            total_tax += s.tax_amount
            total_sum += s.total

        # totals row
        data.append(["", "TOPLAMLAR", "", f"{total_sub:,.2f}", f"{total_tax:,.2f}", f"{total_sum:,.2f}"])

        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.lightgrey),
            ('TEXTCOLOR', (0,0), (-1,0), colors.black),
            ('ALIGN', (2,1), (-1,-1), 'RIGHT'),
            ('GRID', (0,0), (-1,-1), 0.25, colors.grey),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ]))
        elements.append(table)

        elements.append(Spacer(1, 12))
        elements.append(Paragraph("Not: Bu çıktı sevk irsaliyesi formatında aylık satış özetidir.", styles['Italic']))

        doc.build(elements)
        buffer.seek(0)

        filename = f"irsaliye_{start_date.strftime('%Y-%m')}.pdf"
        headers = {"Content-Disposition": f"attachment; filename={filename}"}
        return StreamingResponse(buffer, media_type="application/pdf", headers=headers)
    except Exception as e:
        logger.error(f"Irsaliye PDF generation error: {e}")
        raise HTTPException(status_code=500, detail="Could not generate PDF")

# Dashboard endpoints
@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user)
):
    return await DashboardService.get_dashboard_stats()

@api_router.get("/dashboard/top-products", response_model=List[TopProduct])
async def get_top_products(
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_user)
):
    return await DashboardService.get_top_products(limit)

@api_router.get("/dashboard/cashier-performance", response_model=List[CashierPerformance])
async def get_cashier_performance(
    current_user: User = Depends(get_current_admin_user)
):
    return await DashboardService.get_cashier_performance()

# Include API router
app.include_router(api_router)

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize the application"""
    try:
        await connect_to_mongo()
        logger.info("Database connected successfully")
        
        # Create default admin user if none exists
        await create_default_admin()
        
    except Exception as e:
        logger.error(f"Startup error: {e}")
        raise

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    await close_mongo_connection()
    logger.info("Application shutdown complete")

async def create_default_admin():
    """Create default admin user if none exists"""
    from .database import find_one, insert_one
    from .auth import hash_password
    
    # Check if any admin user exists
    admin_user = await find_one("users", {"role": "admin"})
    
    if not admin_user:
        # Create default admin and cashier users
        users_data = [
            {
                "id": str(uuid.uuid4()),
                "username": "admin",
                "password_hash": hash_password("admin123"),
                "full_name": "İbrahim Usta",
                "email": "admin@elektrikdukkani.com",
                "role": "admin",
                "active": True,
                "created_at": datetime.utcnow()
            },
            {
                "id": str(uuid.uuid4()),
                "username": "kasiyer1",
                "password_hash": hash_password("kasiyer123"),
                "full_name": "Ahmet Yılmaz",
                "email": "ahmet@elektrikdukkani.com",
                "role": "cashier",
                "active": True,
                "created_at": datetime.utcnow()
            },
            {
                "id": str(uuid.uuid4()),
                "username": "kasiyer2",
                "password_hash": hash_password("kasiyer456"),
                "full_name": "Mehmet Demir",
                "email": "mehmet@elektrikdukkani.com",
                "role": "cashier",
                "active": True,
                "created_at": datetime.utcnow()
            }
        ]
        
        for user_data in users_data:
            await insert_one("users", user_data)
        
        logger.info("Default users created successfully")
        
        # Create sample products
        await create_sample_products()

async def create_sample_products():
    """Create sample products for testing"""
    from .database import insert_one
    
    sample_products = [
        {
            "id": str(uuid.uuid4()),
            "barcode": "8690123456789",
            "name": "LED Ampul 9W E27 Beyaz Işık",
            "category": "Aydınlatma",
            "brand": "Philips",
            "stock": 45,
            "min_stock": 10,
            "buy_price": 12.50,
            "sell_price": 18.90,
            "tax_rate": 18,
            "supplier": "Elektrik Toptan AŞ",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "barcode": "8690987654321",
            "name": "Kablo 2.5mm NYA Siyah (100m)",
            "category": "Kablolar",
            "brand": "Nexans",
            "stock": 8,
            "min_stock": 5,
            "buy_price": 185.00,
            "sell_price": 285.00,
            "tax_rate": 18,
            "supplier": "Kablo Dünyası",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "barcode": "8691234567890",
            "name": "Anahtar Tekli Beyaz",
            "category": "Elektrik Aksesuarları",
            "brand": "Viko",
            "stock": 120,
            "min_stock": 20,
            "buy_price": 8.75,
            "sell_price": 14.50,
            "tax_rate": 18,
            "supplier": "Viko Bayi",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "barcode": "8692345678901",
            "name": "Priz Topraklı Beyaz",
            "category": "Elektrik Aksesuarları",
            "brand": "Schneider",
            "stock": 65,
            "min_stock": 15,
            "buy_price": 15.25,
            "sell_price": 24.90,
            "tax_rate": 18,
            "supplier": "Schneider Bayi",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "barcode": "8693456789012",
            "name": "Sigorta 16A C Tipi",
            "category": "Sigortalar",
            "brand": "ABB",
            "stock": 25,
            "min_stock": 10,
            "buy_price": 32.00,
            "sell_price": 48.50,
            "tax_rate": 18,
            "supplier": "ABB Distribütörü",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
    ]
    
    for product_data in sample_products:
        await insert_one("products", product_data)
    
    logger.info("Sample products created successfully")
