from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from models import *
from database import *
from auth import hash_password
import logging

logger = logging.getLogger(__name__)

class UserService:
    @staticmethod
    async def create_user(user_data: UserCreate) -> User:
        """Create a new user"""
        # Check if username already exists
        existing_user = await find_one("users", {"username": user_data.username})
        if existing_user:
            raise ValueError("Username already exists")
        
        # Create user document
        user_dict = user_data.dict()
        user_dict["password_hash"] = hash_password(user_dict.pop("password"))
        user_dict["created_at"] = datetime.utcnow()
        
        user = User(**user_dict)
        await insert_one("users", user.dict())
        
        return user
    
    @staticmethod
    async def get_users(skip: int = 0, limit: int = 100) -> List[User]:
        """Get all users"""
        users_data = await find_many("users", {}, skip=skip, limit=limit, sort={"created_at": -1})
        return [User(**user) for user in users_data]
    
    @staticmethod
    async def get_user_by_id(user_id: str) -> Optional[User]:
        """Get user by ID"""
        user_data = await find_one("users", {"id": user_id})
        return User(**user_data) if user_data else None
    
    @staticmethod
    async def update_user(user_id: str, user_update: UserUpdate) -> Optional[User]:
        """Update user"""
        update_dict = {k: v for k, v in user_update.dict().items() if v is not None}
        
        # Hash password if provided
        if "password" in update_dict:
            update_dict["password_hash"] = hash_password(update_dict.pop("password"))
        
        success = await update_one("users", {"id": user_id}, update_dict)
        if success:
            return await UserService.get_user_by_id(user_id)
        return None
    
    @staticmethod
    async def delete_user(user_id: str) -> bool:
        """Delete user"""
        return await delete_one("users", {"id": user_id})

class ProductService:
    @staticmethod
    async def create_product(product_data: ProductCreate) -> Product:
        """Create a new product"""
        # Check if barcode already exists
        existing_product = await find_one("products", {"barcode": product_data.barcode})
        if existing_product:
            raise ValueError("Barcode already exists")
        
        product = Product(**product_data.dict())
        await insert_one("products", product.dict())
        
        return product
    
    @staticmethod
    async def get_products(
        skip: int = 0, 
        limit: int = 100, 
        search: str = None, 
        category: str = None,
        low_stock: bool = False
    ) -> List[Product]:
        """Get products with filters"""
        filter_dict = {}
        
        if search:
            filter_dict["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"barcode": {"$regex": search, "$options": "i"}},
                {"brand": {"$regex": search, "$options": "i"}}
            ]
        
        if category:
            filter_dict["category"] = category
        
        if low_stock:
            filter_dict["$expr"] = {"$lte": ["$stock", "$min_stock"]}
        
        products_data = await find_many("products", filter_dict, skip=skip, limit=limit, sort={"updated_at": -1})
        return [Product(**product) for product in products_data]
    
    @staticmethod
    async def get_product_by_id(product_id: str) -> Optional[Product]:
        """Get product by ID"""
        product_data = await find_one("products", {"id": product_id})
        return Product(**product_data) if product_data else None
    
    @staticmethod
    async def get_product_by_barcode(barcode: str) -> Optional[Product]:
        """Get product by barcode"""
        product_data = await find_one("products", {"barcode": barcode})
        return Product(**product_data) if product_data else None
    
    @staticmethod
    async def update_product(product_id: str, product_update: ProductUpdate) -> Optional[Product]:
        """Update product"""
        update_dict = {k: v for k, v in product_update.dict().items() if v is not None}
        
        success = await update_one("products", {"id": product_id}, update_dict)
        if success:
            return await ProductService.get_product_by_id(product_id)
        return None
    
    @staticmethod
    async def delete_product(product_id: str) -> bool:
        """Delete product"""
        return await delete_one("products", {"id": product_id})
    
    @staticmethod
    async def update_stock(product_id: str, quantity_change: int) -> Optional[Product]:
        """Update product stock"""
        product = await ProductService.get_product_by_id(product_id)
        if not product:
            return None
        
        new_stock = max(0, product.stock + quantity_change)
        update_dict = {"stock": new_stock, "updated_at": datetime.utcnow()}
        
        await update_one("products", {"id": product_id}, update_dict)
        return await ProductService.get_product_by_id(product_id)

class StockService:
    @staticmethod
    async def create_movement(movement_data: StockMovementCreate, user_id: str) -> StockMovement:
        """Create stock movement"""
        product = await ProductService.get_product_by_id(movement_data.product_id)
        if not product:
            raise ValueError("Product not found")
        
        # Create movement
        movement_dict = movement_data.dict()
        movement_dict["created_by"] = user_id
        movement = StockMovement(**movement_dict)
        
        await insert_one("stock_movements", movement.dict())
        
        # Update product stock
        quantity_change = movement.quantity if movement.type == StockMovementType.stock_in else -movement.quantity
        await ProductService.update_stock(movement.product_id, quantity_change)
        
        return movement
    
    @staticmethod
    async def get_movements(
        skip: int = 0, 
        limit: int = 100, 
        product_id: str = None,
        movement_type: StockMovementType = None
    ) -> List[StockMovement]:
        """Get stock movements"""
        filter_dict = {}
        
        if product_id:
            filter_dict["product_id"] = product_id
        
        if movement_type:
            filter_dict["type"] = movement_type.value
        
        movements_data = await find_many("stock_movements", filter_dict, skip=skip, limit=limit, sort={"created_at": -1})
        return [StockMovement(**movement) for movement in movements_data]
    
    @staticmethod
    async def get_low_stock_products() -> List[Product]:
        """Get products with low stock"""
        return await ProductService.get_products(low_stock=True)

class SalesService:
    @staticmethod
    async def create_sale(sale_data: SaleCreate, cashier_id: str) -> Sale:
        """Create a new sale"""
        # Validate and calculate totals
        subtotal = 0
        tax_amount = 0
        items = []
        
        for item_data in sale_data.items:
            # Verify product exists and has enough stock
            product = await ProductService.get_product_by_id(item_data.product_id)
            if not product:
                raise ValueError(f"Product not found: {item_data.product_id}")
            
            if product.stock < item_data.quantity:
                raise ValueError(f"Insufficient stock for {product.name}")
            
            # Calculate item totals
            item_total = item_data.quantity * item_data.unit_price
            item_tax = item_total * item_data.tax_rate / 100
            
            sale_item = SaleItem(
                **item_data.dict(),
                total_price=item_total
            )
            
            items.append(sale_item)
            subtotal += item_total
            tax_amount += item_tax
        
        total = subtotal + tax_amount
        
        # Create sale
        sale = Sale(
            cashier_id=cashier_id,
            items=items,
            subtotal=subtotal,
            tax_amount=tax_amount,
            total=total
        )
        
        await insert_one("sales", sale.dict())
        
        # Update product stocks
        for item in items:
            await ProductService.update_stock(item.product_id, -item.quantity)
        
        return sale
    
    @staticmethod
    async def get_sales(
        skip: int = 0, 
        limit: int = 100,
        start_date: datetime = None,
        end_date: datetime = None,
        cashier_id: str = None
    ) -> List[Sale]:
        """Get sales with filters"""
        filter_dict = {}
        
        if start_date or end_date:
            date_filter = {}
            if start_date:
                date_filter["$gte"] = start_date
            if end_date:
                date_filter["$lte"] = end_date
            filter_dict["created_at"] = date_filter
        
        if cashier_id:
            filter_dict["cashier_id"] = cashier_id
        
        sales_data = await find_many("sales", filter_dict, skip=skip, limit=limit, sort={"created_at": -1})
        return [Sale(**sale) for sale in sales_data]
    
    @staticmethod
    async def get_sale_by_id(sale_id: str) -> Optional[Sale]:
        """Get sale by ID"""
        sale_data = await find_one("sales", {"id": sale_id})
        return Sale(**sale_data) if sale_data else None
    
    @staticmethod
    async def get_daily_stats(date: datetime = None) -> Dict[str, Any]:
        """Get daily sales statistics"""
        if not date:
            date = datetime.utcnow()
        
        start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        
        pipeline = [
            {
                "$match": {
                    "created_at": {
                        "$gte": start_of_day,
                        "$lt": end_of_day
                    }
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_sales": {"$sum": 1},
                    "total_revenue": {"$sum": "$total"},
                    "total_items": {
                        "$sum": {
                            "$sum": "$items.quantity"
                        }
                    }
                }
            }
        ]
        
        result = await aggregate("sales", pipeline)
        
        if result:
            stats = result[0]
            return {
                "total_sales": stats["total_sales"],
                "total_revenue": stats["total_revenue"],
                "total_items_sold": stats["total_items"],
                "date": date.isoformat()
            }
        
        return {
            "total_sales": 0,
            "total_revenue": 0.0,
            "total_items_sold": 0,
            "date": date.isoformat()
        }

class DashboardService:
    @staticmethod
    async def get_dashboard_stats() -> DashboardStats:
        """Get dashboard statistics"""
        # Get basic counts
        total_products = await count_documents("products")
        
        # Get total stock
        pipeline = [
            {"$group": {"_id": None, "total_stock": {"$sum": "$stock"}}}
        ]
        stock_result = await aggregate("products", pipeline)
        total_stock = stock_result[0]["total_stock"] if stock_result else 0
        
        # Get daily revenue
        daily_stats = await SalesService.get_daily_stats()
        daily_revenue = daily_stats["total_revenue"]
        daily_items_sold = daily_stats["total_items_sold"]
        
        # Get low stock count
        low_stock_products = await StockService.get_low_stock_products()
        low_stock_count = len(low_stock_products)
        
        # Get total sales count
        total_sales = await count_documents("sales")
        
        return DashboardStats(
            total_products=total_products,
            total_stock=total_stock,
            daily_revenue=daily_revenue,
            low_stock_count=low_stock_count,
            daily_items_sold=daily_items_sold,
            total_sales=total_sales
        )
    
    @staticmethod
    async def get_top_products(limit: int = 5) -> List[TopProduct]:
        """Get top selling products"""
        # This would require more complex aggregation in a real scenario
        # For now, return empty list - can be implemented with sales data analysis
        return []
    
    @staticmethod
    async def get_cashier_performance() -> List[CashierPerformance]:
        """Get cashier performance statistics"""
        pipeline = [
            {
                "$group": {
                    "_id": "$cashier_id",
                    "sales_count": {"$sum": 1},
                    "total_revenue": {"$sum": "$total"}
                }
            },
            {
                "$lookup": {
                    "from": "users",
                    "localField": "_id",
                    "foreignField": "id",
                    "as": "cashier"
                }
            },
            {
                "$unwind": "$cashier"
            },
            {
                "$project": {
                    "cashier_name": "$cashier.full_name",
                    "sales_count": 1,
                    "total_revenue": 1,
                    "average_sale": {"$divide": ["$total_revenue", "$sales_count"]}
                }
            },
            {"$sort": {"total_revenue": -1}}
        ]
        
        results = await aggregate("sales", pipeline)
        
        return [
            CashierPerformance(
                cashier_name=result["cashier_name"],
                sales_count=result["sales_count"],
                total_revenue=result["total_revenue"],
                average_sale=result["average_sale"]
            ) for result in results
        ]