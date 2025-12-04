from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete, update
from datetime import datetime, timedelta, timezone
from typing import List

from database import get_db
from models import User, Lot, Bid, Notification
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

# 1. Список всіх користувачів
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

# 2. Заблокувати користувача + ВИДАЛИТИ ЛОТИ + СКАСУВАТИ СТАВКИ
@router.post("/users/{user_id}/block")
async def block_user(
    user_id: int,
    block_data: BlockUserRequest,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    check_admin(current_user)
    
    # Знаходимо користувача
    user_query = select(User).where(User.id == user_id)
    result = await db.execute(user_query)
    target_user = result.scalar_one_or_none()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if target_user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot block an admin")

    # 1. Блокуємо самого юзера
    target_user.is_blocked = True
    target_user.ban_reason = block_data.reason
    
    if block_data.is_permanent:
        target_user.ban_until = None
    else:
        target_user.ban_until = datetime.now(timezone.utc) + timedelta(days=block_data.duration_days)

    # 2. Видаляємо його ЛОТИ (Hard Delete)
    del_lots_query = delete(Lot).where(Lot.seller_id == user_id)
    await db.execute(del_lots_query)
    
    # 3. Скасовуємо його СТАВКИ (Soft Delete + Recalculate Prices)
    
    # А) Спочатку знаходимо ID лотів, де цей юзер мав АКТИВНІ ставки
    active_bids_query = select(Bid).where(Bid.user_id == user_id, Bid.is_active == True)
    active_bids_res = await db.execute(active_bids_query)
    bids_to_cancel = active_bids_res.scalars().all()
    
    affected_lot_ids = {bid.lot_id for bid in bids_to_cancel}

    # Б) Деактивуємо ставки
    # Ми використовуємо update замість delete, щоб зберегти історію "злочинів", 
    # але is_active=False прибере їх з фронтенду та розрахунків
    deactivate_query = update(Bid).where(Bid.user_id == user_id).values(is_active=False)
    await db.execute(deactivate_query)
    
    # В) ПЕРЕРАХОВУЄМО ЦІНИ для постраждалих лотів
    # Оскільки ми прибрали ставки лідера, ціна лота має впасти до наступної найвищої
    for lot_id in affected_lot_ids:
        # Шукаємо лот
        lot_q = select(Lot).where(Lot.id == lot_id)
        lot_r = await db.execute(lot_q)
        lot = lot_r.scalar_one_or_none()
        
        if lot and lot.status == "active":
            # Шукаємо нову найвищу активну ставку
            new_best_bid_q = select(Bid)\
                .where(Bid.lot_id == lot_id, Bid.is_active == True)\
                .order_by(Bid.amount.desc())\
                .limit(1)
            
            new_best_bid_res = await db.execute(new_best_bid_q)
            new_best_bid = new_best_bid_res.scalar_one_or_none()
            
            if new_best_bid:
                lot.current_price = new_best_bid.amount
                print(f"Recalculated Lot #{lot_id}: New price {lot.current_price} (User #{new_best_bid.user_id})")
            else:
                # Якщо ставок більше немає, повертаємось до стартової
                lot.current_price = lot.start_price
                print(f"Recalculated Lot #{lot_id}: Reset to start price {lot.start_price}")

    await db.commit()
    return {"message": f"User {target_user.username} blocked. Lots deleted. Bids cancelled and prices updated."}

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
    
    # Примітка: Ми НЕ відновлюємо видалені лоти та ставки автоматично,
    # бо це може створити конфлікти (наприклад, лот вже продано іншому).
    
    await db.commit()
    return {"message": "User unblocked"}

# 4. Видалити лот за ID (адмінське видалення)
@router.delete("/lots/{lot_id}")
async def admin_delete_lot(
    lot_id: int,
    reason: str = "Порушення правил платформи", # <--- Причина за замовчуванням
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    check_admin(current_user)
    
    # 1. Знаходимо лот
    query = select(Lot).where(Lot.id == lot_id)
    result = await db.execute(query)
    lot = result.scalar_one_or_none()

    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    seller_id = lot.seller_id
    lot_title = lot.title

    # 3. Видаляємо лот з БД
    await db.delete(lot)
    
    # 4. Створюємо повідомлення для продавця
    notification = Notification(
        user_id=seller_id,
        message=f"Ваш лот '{lot_title}' було видалено адміністратором. Причина: {reason}"
    )
    db.add(notification)

    await db.commit()
    
    return {"message": f"Lot #{lot_id} deleted. Notification sent to seller."}