from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from datetime import datetime, timedelta, timezone

from database import get_db
from models import Lot, User, Bid
from schemas import LotCreate, LotOut, LotUpdate
from dependencies import get_current_user_db 
from sqlalchemy.orm import joinedload
from sqlalchemy import desc

router = APIRouter(
    prefix="/lots",
    tags=["lots"]
)

# 1. Отримати всі лоти (Всі статуси: active, sold, closed...)
@router.get("/", response_model=List[LotOut])
async def get_lots(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    # Ми прибрали фільтр .where(Lot.status == 'active'), щоб фронтенд отримував все
    # і міг сам фільтрувати через випадаючий список.
    # Також додали сортування: новіші (з більшим ID) спочатку.
    query = select(Lot)\
        .options(joinedload(Lot.seller))\
        .order_by(Lot.id.desc())\
        .offset(skip)\
        .limit(limit)
        
    result = await db.execute(query)
    lots = result.scalars().all()
    return lots

# 2. Отримати мої лоти
@router.get("/my", response_model=List[LotOut])
async def get_my_lots(
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    query = select(Lot).where(Lot.seller_id == current_user.id).order_by(Lot.id.desc())
    result = await db.execute(query)
    return result.scalars().all()

# 3. Отримати конкретний лот
@router.get("/{lot_id}", response_model=LotOut)
async def get_lot(lot_id: int, db: AsyncSession = Depends(get_db)):
    query = select(Lot).options(joinedload(Lot.seller)).where(Lot.id == lot_id)
    result = await db.execute(query)
    lot = result.scalar_one_or_none()
    
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    
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

# 5. Закриття аукціону продавцем
@router.post("/{lot_id}/close")
async def close_lot(
    lot_id: int,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    query = select(Lot).where(Lot.id == lot_id)
    result = await db.execute(query)
    lot = result.scalar_one_or_none()

    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    if lot.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the seller can close the auction")

    if lot.status != "active":
        raise HTTPException(status_code=400, detail="Auction is already closed")

    # Перевірка ставок
    bid_query = select(Bid).where(Bid.lot_id == lot.id).order_by(Bid.amount.desc()).limit(1)
    bid_result = await db.execute(bid_query)
    highest_bid = bid_result.scalar_one_or_none()

    if not highest_bid:
        lot.status = "closed_unsold"
        message = "Auction closed without bids"
    else:
        lot.status = "pending_payment"
        
        now = datetime.now(timezone.utc)
        lot.payment_deadline = now + timedelta(
            days=lot.payment_deadline_days,
            hours=lot.payment_deadline_hours,
            minutes=lot.payment_deadline_minutes
        )
        message = "Auction closed. Winner selected. Waiting for payment."

    await db.commit()
    
    return {"message": message, "status": lot.status}

# 6. Видалити лот
@router.delete("/{lot_id}")
async def delete_lot(
    lot_id: int,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    query = select(Lot).where(Lot.id == lot_id)
    result = await db.execute(query)
    lot = result.scalar_one_or_none()

    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    if lot.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this lot")

    await db.delete(lot)
    await db.commit()
    
    return {"message": "Lot deleted successfully"}