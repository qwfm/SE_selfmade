from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta, timezone
from typing import List

from database import get_db
from models import User, Lot
from schemas import UserOut, BlockUserRequest
from dependencies import get_current_user_db

router = APIRouter(
    prefix="/admin",
    tags=["admin"]
)

# Перевірка на адміна
def check_admin(user: User):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")

# 1. Список всіх користувачів (фільтрація)
@router.get("/users", response_model=List[UserOut])
async def get_all_users(
    search: str = "",
    only_blocked: bool = False,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    check_admin(current_user)
    
    query = select(User).order_by(User.id.desc())
    
    if search:
        query = query.where(User.username.ilike(f"%{search}%") | User.email.ilike(f"%{search}%"))
    
    if only_blocked:
        query = query.where(User.is_blocked == True)
        
    result = await db.execute(query)
    return result.scalars().all()

# 2. Заблокувати користувача
@router.post("/users/{user_id}/block")
async def block_user(
    user_id: int,
    block_data: BlockUserRequest,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    check_admin(current_user)
    
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot block yourself")

    user_query = select(User).where(User.id == user_id)
    user_result = await db.execute(user_query)
    target_user = user_result.scalar_one_or_none()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    target_user.is_blocked = True
    target_user.ban_reason = block_data.reason
    
    if block_data.is_permanent:
        target_user.ban_until = None
    else:
        target_user.ban_until = datetime.now(timezone.utc) + timedelta(days=block_data.duration_days)
    
    # ВИДАЛЯЄМО ВСІ ЛОТИ ЦЬОГО КОРИСТУВАЧА
    # (Cascade в моделях видалить ставки і платежі автоматично)
    from sqlalchemy import delete
    del_query = delete(Lot).where(Lot.seller_id == user_id)
    await db.execute(del_query)
    
    await db.commit()
    return {"message": f"User {target_user.username} blocked and lots deleted."}

# 3. Розблокувати
@router.post("/users/{user_id}/unblock")
async def unblock_user(
    user_id: int,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    check_admin(current_user)
    
    user_query = select(User).where(User.id == user_id)
    result = await db.execute(user_query)
    target_user = result.scalar_one_or_none()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    target_user.is_blocked = False
    target_user.ban_reason = None
    target_user.ban_until = None
    
    await db.commit()
    return {"message": "User unblocked"}

# 4. Видалити лот за ID (жорстке видалення)
@router.delete("/lots/{lot_id}")
async def admin_delete_lot(
    lot_id: int,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    check_admin(current_user)
    
    query = select(Lot).where(Lot.id == lot_id)
    result = await db.execute(query)
    lot = result.scalar_one_or_none()
    
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
        
    await db.delete(lot)
    await db.commit()
    
    return {"message": f"Lot #{lot_id} permanently deleted by admin"}