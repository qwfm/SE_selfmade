from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from datetime import datetime

from database import get_db
from models import Bid, Lot, User
from schemas import BidCreate, BidOut, BidOutWithLot # <--- Додали BidOutWithLot
from dependencies import get_current_user_db

router = APIRouter(
    prefix="/bids",
    tags=["bids"]
)

# 1. Зробити ставку
@router.post("/{lot_id}", response_model=BidOut)
async def place_bid(
    lot_id: int,
    bid_data: BidCreate,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    query = select(Lot).where(Lot.id == lot_id)
    result = await db.execute(query)
    lot = result.scalar_one_or_none()

    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    if lot.seller_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot bid on your own lot")

    if lot.status != "active":
        raise HTTPException(status_code=400, detail="Auction is closed")
    
    if lot.payment_deadline and lot.payment_deadline.replace(tzinfo=None) < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Auction is waiting for payment")

    min_bid_amount = lot.current_price + lot.min_step
    if bid_data.amount < min_bid_amount:
        raise HTTPException(
            status_code=400, 
            detail=f"Bid must be at least {min_bid_amount}"
        )

    new_bid = Bid(
        amount=bid_data.amount,
        user_id=current_user.id,
        lot_id=lot.id,
        timestamp=datetime.utcnow()
    )
    
    lot.current_price = bid_data.amount
    
    db.add(new_bid)
    await db.commit()
    await db.refresh(new_bid)
    
    return new_bid

# 2. Отримати історію ставок для лота (Публічний)
@router.get("/{lot_id}", response_model=list[BidOut])
async def get_lot_bids(lot_id: int, db: AsyncSession = Depends(get_db)):
    query = select(Bid).where(Bid.lot_id == lot_id).order_by(Bid.amount.desc())
    result = await db.execute(query)
    bids = result.scalars().all()
    return bids

# 3. НОВИЙ: Отримати МОЇ ставки (Історія)
@router.get("/my", response_model=list[BidOutWithLot])
async def get_my_bids(
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    # joinedload(Bid.lot) обов'язковий!
    query = select(Bid).options(joinedload(Bid.lot)).where(Bid.user_id == current_user.id).order_by(Bid.timestamp.desc())
    result = await db.execute(query)
    bids = result.scalars().all()
    return bids