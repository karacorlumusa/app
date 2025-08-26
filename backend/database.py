from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
import os
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class Database:
    client: Optional[AsyncIOMotorClient] = None
    database: Optional[AsyncIOMotorDatabase] = None

# Database instance
db = Database()

async def get_database() -> AsyncIOMotorDatabase:
    return db.database

async def connect_to_mongo():
    """Create database connection"""
    try:
        db.client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db.database = db.client[os.environ["DB_NAME"]]
        
        # Test connection
        await db.client.admin.command('ping')
        logger.info("Successfully connected to MongoDB")
        
        # Create indexes
        await create_indexes()
        
    except Exception as e:
        logger.error(f"Could not connect to MongoDB: {e}")
        raise

async def close_mongo_connection():
    """Close database connection"""
    if db.client:
        db.client.close()
        logger.info("Disconnected from MongoDB")

async def create_indexes():
    """Create database indexes for better performance"""
    try:
        database = await get_database()
        
        # Users collection indexes
        await database.users.create_index("username", unique=True)
        await database.users.create_index("email")
        await database.users.create_index("role")
        
        # Products collection indexes
        await database.products.create_index("barcode", unique=True)
        await database.products.create_index("name")
        await database.products.create_index("category")
        await database.products.create_index("brand")
        await database.products.create_index("stock")
        
        # Stock movements collection indexes
        await database.stock_movements.create_index("product_id")
        await database.stock_movements.create_index("type")
        await database.stock_movements.create_index("created_at")
        await database.stock_movements.create_index("created_by")
        
        # Sales collection indexes
        await database.sales.create_index("cashier_id")
        await database.sales.create_index("created_at")
        await database.sales.create_index("total")
        
        logger.info("Database indexes created successfully")
        
    except Exception as e:
        logger.error(f"Error creating indexes: {e}")

# Collection helpers
async def get_collection(collection_name: str):
    """Get a collection from the database"""
    database = await get_database()
    return database[collection_name]

# Generic CRUD operations
async def insert_one(collection_name: str, document: dict) -> str:
    """Insert a single document"""
    collection = await get_collection(collection_name)
    result = await collection.insert_one(document)
    return str(result.inserted_id)

async def find_one(collection_name: str, filter_dict: dict) -> Optional[dict]:
    """Find a single document"""
    collection = await get_collection(collection_name)
    result = await collection.find_one(filter_dict)
    if result:
        result["_id"] = str(result["_id"])
    return result

async def find_many(collection_name: str, filter_dict: dict = None, skip: int = 0, limit: int = None, sort: dict = None) -> list:
    """Find multiple documents"""
    collection = await get_collection(collection_name)
    
    cursor = collection.find(filter_dict or {})
    
    if sort:
        cursor = cursor.sort(list(sort.items()))
    
    if skip > 0:
        cursor = cursor.skip(skip)
        
    if limit:
        cursor = cursor.limit(limit)
    
    results = []
    async for document in cursor:
        document["_id"] = str(document["_id"])
        results.append(document)
    
    return results

async def update_one(collection_name: str, filter_dict: dict, update_dict: dict) -> bool:
    """Update a single document"""
    collection = await get_collection(collection_name)
    update_dict["updated_at"] = datetime.utcnow()
    result = await collection.update_one(filter_dict, {"$set": update_dict})
    return result.modified_count > 0

async def delete_one(collection_name: str, filter_dict: dict) -> bool:
    """Delete a single document"""
    collection = await get_collection(collection_name)
    result = await collection.delete_one(filter_dict)
    return result.deleted_count > 0

async def count_documents(collection_name: str, filter_dict: dict = None) -> int:
    """Count documents"""
    collection = await get_collection(collection_name)
    return await collection.count_documents(filter_dict or {})

async def aggregate(collection_name: str, pipeline: list) -> list:
    """Perform aggregation"""
    collection = await get_collection(collection_name)
    results = []
    async for document in collection.aggregate(pipeline):
        if "_id" in document:
            document["_id"] = str(document["_id"])
        results.append(document)
    return results