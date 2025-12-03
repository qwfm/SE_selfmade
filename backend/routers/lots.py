from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from datetime import datetime, timedelta, timezone # <--- 1. Додано timezone

from database import get_db
from models import Lot, User, Bid
from schemas import LotCreate, LotOut, LotUpdate
from dependencies import get_current_user_db 
from sqlalchemy.orm import joinedload

router = APIRouter(
    prefix="/lots",
    tags=["lots"]
)

# 1. Отримати всі активні лоти
@router.get("/", response_model=List[LotOut])
async def get_lots(skip: int = 0, limit: int = 20, db: AsyncSession = Depends(get_db)):
    query = select(Lot).options(joinedload(Lot.seller)).where(Lot.status == 'active').offset(skip).limit(limit)
    result = await db.execute(query)
    lots = result.scalars().all()
    return lots

# 2. Отримати мої лоти
@router.get("/my", response_model=List[LotOut])
async def get_my_lots(
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    query = select(Lot).where(Lot.seller_id == current_user.id)
    result = await db.execute(query)
    return result.scalars().all()

# 3. Отримати конкретний лот (БЕЗ АВТОМАТИКИ)
@router.get("/{lot_id}", response_model=LotOut)
async def get_lot(lot_id: int, db: AsyncSession = Depends(get_db)):
    # Просто віддаємо дані, нічого не змінюємо
    query = select(Lot).options(joinedload(Lot.seller)).where(Lot.id == lot_id)
    result = await db.execute(query)
    lot = result.scalar_one_or_none()
    
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    
    # Лот буде 'active' доки продавець не натисне кнопку.

    return lot

# 4. Створити лот
@router.post("/", response_model=LotOut)
async def create_lot(
    lot_data: LotCreate,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    new_lot = Lot(
        **lot_data.model_dump(),
        seller_id=current_user.id,
        current_price=lot_data.start_price,
        status="active"
    )
    db.add(new_lot)
    await db.commit()
    await db.refresh(new_lot)
    return new_lot

# 5. Ручне закриття аукціону продавцем
@router.post("/{lot_id}/close")
async def close_lot(
    lot_id: int,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    # 1. Знаходимо лот
    query = select(Lot).where(Lot.id == lot_id)
    result = await db.execute(query)
    lot = result.scalar_one_or_none()

    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    # 2. Перевірка: чи це продавець?
    if lot.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the seller can close the auction")

    # 3. Перевірка: чи лот ще активний?
    if lot.status != "active":
        raise HTTPException(status_code=400, detail="Auction is already closed")

    # 4. Перевірка: чи є хоч одна ставка?
    bid_query = select(Bid).where(Bid.lot_id == lot.id).order_by(Bid.amount.desc()).limit(1)
    bid_result = await db.execute(bid_query)
    highest_bid = bid_result.scalar_one_or_none()

    if not highest_bid:
        # Якщо ставок немає, просто закриваємо
        lot.status = "closed_unsold"
        message = "Auction closed without bids"
    else:
        # Якщо ставки є -> Переводимо в режим оплати
        lot.status = "pending_payment"
        
        # Встановлюємо ДЕДЛАЙН ОПЛАТИ
        # --- ВИПРАВЛЕННЯ ТУТ ---
        now = datetime.now(timezone.utc) # Використовуємо timezone-aware об'єкт
        # -----------------------
        
        lot.payment_deadline = now + timedelta(
            days=lot.payment_deadline_days,
            hours=lot.payment_deadline_hours,
            minutes=lot.payment_deadline_minutes
        )
        message = "Auction closed. Winner selected. Waiting for payment."

    await db.commit()
    
    return {"message": message, "status": lot.status}