# backend/schemas.py
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

# --- User Schemas ---
class UserBase(BaseModel):
    email: Optional[str] = None

class UserPublic(BaseModel):
    id: Optional[int] = None
    username: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    is_blocked: Optional[bool] = False
    
    class Config:
        from_attributes = True

class UserOut(UserBase):
    id: Optional[int] = None
    username: Optional[str] = None
    phone_number: Optional[str] = None
    bio: Optional[str] = None
    is_admin: bool = False
    is_blocked: bool = False
    ban_reason: Optional[str] = None
    ban_until: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        
class UserUpdate(BaseModel):
    username: Optional[str] = None
    phone_number: Optional[str] = None
    bio: Optional[str] = None

class BlockUserRequest(BaseModel):
    reason: str
    is_permanent: bool = False
    duration_days: Optional[int] = 0

# --- Image Schemas (ГАЛЕРЕЯ) ---
class LotImageOut(BaseModel):
    id: int
    image_url: str
    
    class Config:
        from_attributes = True

# --- Lot Schemas ---
class LotBase(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_price: Optional[Decimal] = None
    min_step: Optional[Decimal] = 10.0
    payment_deadline_days: Optional[int] = 0
    payment_deadline_hours: Optional[int] = 24
    payment_deadline_minutes: Optional[int] = 0
    lot_type: Optional[str] = "private"
    image_url: Optional[str] = None 

class LotCreate(LotBase):
    pass

class LotUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    # Картинки зазвичай оновлюються окремим роутом або перезаписом

class LotOut(LotBase):
    id: Optional[int] = None
    current_price: Optional[Decimal] = None
    status: Optional[str] = "active"
    seller_id: Optional[int] = None
    created_at: Optional[datetime] = None
    payment_deadline: Optional[datetime] = None
    
    seller: Optional[UserPublic] = None 
    images: List[LotImageOut] = [] # Список картинок для галереї

    class Config:
        from_attributes = True

# --- Bid Schemas ---
class LotMinimal(BaseModel):
    id: Optional[int] = None
    title: Optional[str] = "Unknown Lot"
    status: Optional[str] = "active"
    
    class Config:
        from_attributes = True

class BidCreate(BaseModel):
    amount: Decimal

class BidOut(BaseModel):
    id: Optional[int] = None
    amount: Optional[Decimal] = None
    timestamp: Optional[datetime] = None
    user_id: Optional[int] = None
    lot_id: Optional[int] = None # <--- ВАЖЛИВО: Щоб фронт знав ID лота
    is_active: bool = True
    
    class Config:
        from_attributes = True

class BidOutWithLot(BidOut):
    lot: Optional[LotMinimal] = None

# --- Payment Schemas ---
class PaymentCreate(BaseModel):
    lot_id: int 

class PaymentOut(BaseModel):
    id: Optional[int] = None
    amount: Optional[Decimal] = None
    lot_id: Optional[int] = None
    user_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        
class NotificationOut(BaseModel):
    id: int
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
        
class RulesUpdate(BaseModel):
    content: str

class RulesOut(BaseModel):
    content: str