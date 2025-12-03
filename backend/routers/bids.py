from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from datetime import datetime

from database import get_db
from models import Bid, Lot, User
from schemas import BidCreate, BidOut, BidOutWithLot
from dependencies import get_current_user_db

router = APIRouter(
    prefix="/bids",
    tags=["bids"]
)

# --- 1. СПОЧАТКУ РОУТИ З КОНКРЕТНИМИ ІМЕНАМИ (/my) ---

@router.get("/my", response_model=list[BidOutWithLot])
async def get_my_bids(
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    query = select(Bid).options(joinedload(Bid.lot)).where(Bid.user_id == current_user.id).order_by(Bid.timestamp.desc())
    result = await db.execute(query)
    bids = result.scalars().all()
    return bids

# --- 2. ПОТІМ РОУТИ З ДИНАМІЧНИМИ ID ({id}) ---

# Скасувати ставку (DELETE)
@router.delete("/{bid_id}")
async def cancel_bid(
    bid_id: int,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    # Знаходимо ставку
    query = select(Bid).options(joinedload(Bid.lot)).where(Bid.id == bid_id)
    result = await db.execute(query)
    bid = result.scalar_one_or_none()
    
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")

    # Перевірка власника
    if bid.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this bid")

    # Перевірка: чи можна ще скасувати? (Наприклад, якщо аукціон активний)
    if bid.lot.status != 'active':
         raise HTTPException(status_code=400, detail="Cannot cancel bid on closed auction")

    # Видаляємо ставку
    await db.delete(bid)
    
    # ВАЖЛИВО: Треба перерахувати current_price лота!
    # Знаходимо нову найвищу ставку
    new_highest_query = select(Bid).where(
        Bid.lot_id == bid.lot_id, 
        Bid.id != bid_id # виключаємо ту, що видаляємо (хоча delete вже спрацював, але для надійності)
    ).order_by(Bid.amount.desc()).limit(1)
    
    res = await db.execute(new_highest_query)
    new_highest = res.scalar_one_or_none()
    
    # Оновлюємо ціну лота
    if new_highest:
        bid.lot.current_price = new_highest.amount
    else:
        # Якщо ставок більше немає, повертаємо стартову ціну
        bid.lot.current_price = bid.lot.start_price

    await db.commit()
    
    return {"message": "Bid cancelled"}

# Зробити ставку (POST)
@router.post("/{lot_id}", response_model=BidOut)
async def place_bid(
    lot_id: int,
    bid_data: BidCreate,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    # ... (Ваш код створення ставки без змін) ...
    query = select(Lot).where(Lot.id == lot_id)
    result = await db.execute(query)
    lot = result.scalar_one_or_none()

    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    if lot.seller_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot bid on your own lot")

    if lot.status != "active":
        raise HTTPException(status_code=400, detail="Auction is closed")
    
    min_bid_amount = lot.current_price + lot.min_step
    if bid_data.amount < min_bid_amount:
        raise HTTPException(status_code=400, detail=f"Bid must be at least {min_bid_amount}")

    new_bid = Bid(
        amount=bid_data.amount,
        user_id=current_user.id,
        lot_id=lot.id,
        timestamp=datetime.utcnow(),
        is_active=True
    )
    
    lot.current_price = bid_data.amount
    db.add(new_bid)
    await db.commit()
    await db.refresh(new_bid)
    return new_bid

# Отримати історію ставок (GET)
@router.get("/{lot_id}", response_model=list[BidOut])
async def get_lot_bids(lot_id: int, db: AsyncSession = Depends(get_db)):
    query = select(Bid).where(Bid.lot_id == lot_id).order_by(Bid.amount.desc())
    result = await db.execute(query)
    bids = result.scalars().all()
    return bids