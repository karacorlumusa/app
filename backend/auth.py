from datetime import datetime, timedelta
from typing import Optional
import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
from .models import User, UserRole
from .database import find_one

# Security configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def hash_password(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[dict]:
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return payload
    except jwt.PyJWTError:
        return None

async def authenticate_user(username: str, password: str) -> Optional[User]:
    """Authenticate user with username and password"""
    user_data = await find_one("users", {"username": username, "active": True})
    if not user_data:
        return None
    
    user = User(**user_data)
    if not verify_password(password, user.password_hash):
        return None
    
    return user

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Get current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token_data = verify_token(credentials.credentials)
    if token_data is None:
        raise credentials_exception
    
    username = token_data.get("sub")
    if username is None:
        raise credentials_exception
    
    user_data = await find_one("users", {"username": username, "active": True})
    if user_data is None:
        raise credentials_exception
    
    return User(**user_data)

async def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current user if they are admin"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

def create_admin_user_if_not_exists():
    """Create default admin user if none exists"""
    import asyncio
    from database import find_one, insert_one
    
    async def create_admin():
        # Check if any admin user exists
        admin_user = await find_one("users", {"role": "admin"})
        
        if not admin_user:
            # Create default admin
            admin_data = {
                "username": "admin",
                "password_hash": hash_password("admin123"),
                "full_name": "İbrahim Usta",
                "email": "admin@elektrikdukkani.com",
                "role": "admin",
                "active": True,
                "created_at": datetime.utcnow()
            }
            
            await insert_one("users", admin_data)
            print("Default admin user created: admin / admin123")
    
    # Run only if there's an event loop
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If loop is running, schedule the task
            asyncio.create_task(create_admin())
        else:
            # If no loop is running, run it
            asyncio.run(create_admin())
    except RuntimeError:
        # Event loop not available, will be handled during startup
        pass