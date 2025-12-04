from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from sqlalchemy import update

from database import get_db
from models import User, Notification
from schemas import UserOut, UserUpdate, NotificationOut
from dependencies import get_current_user_db

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

@router.get("/me", response_model=UserOut)
async def read_users_me(current_user: User = Depends(get_current_user_db)):
    return current_user

@router.patch("/me", response_model=UserOut)
async def update_user_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    # Використовуємо model_dump замість dict
    update_data = user_update.model_dump(exclude_unset=True) # <--- ЗАМІНИЛИ ТУТ

    for key, value in update_data.items():
        setattr(current_user, key, value)

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    return current_user

@router.get("/notifications", response_model=List[NotificationOut])
async def get_my_notifications(
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    query = select(Notification)\
        .where(Notification.user_id == current_user.id)\
        .order_by(Notification.created_at.desc())
        
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/notifications/read")
async def mark_notifications_read(
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    stmt = update(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).values(is_read=True)
    
    await db.execute(stmt)
    await db.commit()
    
    return {"message": "All notifications marked as read"}