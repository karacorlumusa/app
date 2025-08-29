from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid

# Enums
class UserRole(str, Enum):
    admin = "admin"
    cashier = "cashier"

class StockMovementType(str, Enum):
    stock_in = "in"
    stock_out = "out"

class PaymentMethod(str, Enum):
    cash = "cash"
    card = "card"

class FinanceType(str, Enum):
    income = "income"
    expense = "expense"

# Base Models
class BaseDBModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)

# User Models
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    full_name: str = Field(..., min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    role: UserRole
    active: bool = True

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100)

class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6, max_length=100)

class User(UserBase, BaseDBModel):
    password_hash: str

class UserResponse(UserBase, BaseDBModel):
    pass

# Authentication Models
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Product Models
class ProductBase(BaseModel):
    barcode: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., min_length=1, max_length=100)
    brand: str = Field(..., min_length=1, max_length=100)
    stock: int = Field(..., ge=0)
    min_stock: int = Field(..., ge=0)
    buy_price: float = Field(..., ge=0)
    sell_price: float = Field(..., ge=0)
    tax_rate: int = Field(..., ge=0, le=100)
    supplier: Optional[str] = Field(None, max_length=200)

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    barcode: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    brand: Optional[str] = Field(None, min_length=1, max_length=100)
    stock: Optional[int] = Field(None, ge=0)
    min_stock: Optional[int] = Field(None, ge=0)
    buy_price: Optional[float] = Field(None, ge=0)
    sell_price: Optional[float] = Field(None, ge=0)
    tax_rate: Optional[int] = Field(None, ge=0, le=100)
    supplier: Optional[str] = Field(None, max_length=200)

class Product(ProductBase, BaseDBModel):
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Stock Movement Models
class StockMovementBase(BaseModel):
    product_id: str
    type: StockMovementType
    quantity: int = Field(..., gt=0)
    unit_price: Optional[float] = Field(None, ge=0)
    supplier: Optional[str] = Field(None, max_length=200)
    note: Optional[str] = Field(None, max_length=500)

class StockMovementCreate(StockMovementBase):
    pass

class StockMovement(StockMovementBase, BaseDBModel):
    created_by: str
    total_price: Optional[float] = None
    
    def __init__(self, **data):
        super().__init__(**data)
        if self.unit_price:
            self.total_price = self.unit_price * self.quantity

# Sale Models
class SaleItemBase(BaseModel):
    product_id: str
    barcode: str
    product_name: str
    quantity: int = Field(..., gt=0)
    unit_price: float = Field(..., ge=0)
    tax_rate: int = Field(..., ge=0, le=100)

class SaleItem(SaleItemBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    total_price: float

class SaleBase(BaseModel):
    items: List[SaleItemBase]
    payment_method: Optional[PaymentMethod] = None

class SaleCreate(SaleBase):
    pass

class Sale(BaseDBModel):
    cashier_id: str
    items: List[SaleItem]
    subtotal: float
    tax_amount: float
    total: float
    payment_method: Optional[PaymentMethod] = None

# Dashboard Models
class DashboardStats(BaseModel):
    total_products: int
    total_stock: int
    daily_revenue: float
    low_stock_count: int
    daily_items_sold: int
    total_sales: int

class TopProduct(BaseModel):
    product_id: str
    name: str
    category: str
    quantity_sold: int
    revenue: float

class CashierPerformance(BaseModel):
    cashier_name: str
    sales_count: int
    total_revenue: float
    average_sale: float

# Report Models
class SalesReportFilter(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    cashier_id: Optional[str] = None

class StockReportItem(BaseModel):
    product: Product
    current_stock: int
    movements_count: int
    last_movement: Optional[datetime] = None

# Response Models
class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

class PaginatedResponse(BaseModel):
    items: List[dict]
    total: int
    page: int
    per_page: int
    pages: int

# Finance (Income/Expense) Models
class FinanceTransactionBase(BaseModel):
    type: FinanceType
    amount: float = Field(..., ge=0)
    date: datetime = Field(default_factory=datetime.utcnow)
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    person: Optional[str] = Field(None, max_length=100)

class FinanceTransactionCreate(FinanceTransactionBase):
    pass

class FinanceTransactionUpdate(BaseModel):
    type: Optional[FinanceType] = None
    amount: Optional[float] = Field(None, ge=0)
    date: Optional[datetime] = None
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    person: Optional[str] = Field(None, max_length=100)

class FinanceTransaction(FinanceTransactionBase, BaseDBModel):
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None