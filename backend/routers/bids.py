from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone, timedelta
from typing import List

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
    # 1. Знаходимо ставку разом з лотом
    query = select(Bid).options(joinedload(Bid.lot)).where(Bid.id == bid_id)
    result = await db.execute(query)
    bid = result.scalar_one_or_none()

    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")

    if bid.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this bid")

    lot = bid.lot

    # 2. Перевірка статусу лота
    # Можна скасувати, якщо лот активний АБО якщо це pending_payment (перемога)
    if lot.status not in ["active", "pending_payment"]:
        raise HTTPException(status_code=400, detail="Cannot cancel bid on sold or closed auction")

    if lot.status == "pending_payment":
        # Перевіряємо, чи це ставка переможця (найвища активна)
        best_bid_q = select(Bid).where(Bid.lot_id == lot.id, Bid.is_active == True).order_by(Bid.amount.desc()).limit(1)
        best_bid_res = await db.execute(best_bid_q)
        current_winner = best_bid_res.scalar_one_or_none()

        if current_winner and current_winner.id != bid.id:
             raise HTTPException(status_code=400, detail="You can only cancel if you are the current winner")

    # 3. "М'яке" видалення (деактивація)
    bid.is_active = False
    
    # 4. ПЕРЕРАХУНОК (Хто тепер лідер?)
    # Шукаємо наступну найвищу АКТИВНУ ставку
    next_best_bid_q = select(Bid).where(
        Bid.lot_id == lot.id, 
        Bid.is_active == True
    ).order_by(Bid.amount.desc()).limit(1)
    
    next_res = await db.execute(next_best_bid_q)
    next_best_bid = next_res.scalar_one_or_none()

    if next_best_bid:
        # Є новий лідер
        lot.current_price = next_best_bid.amount
        
        # Якщо лот був у стані очікування оплати, оновлюємо таймер для нового переможця
        if lot.status == "pending_payment":
            now = datetime.now(timezone.utc)
            lot.payment_deadline = now + timedelta(
                days=lot.payment_deadline_days,
                hours=lot.payment_deadline_hours,
                minutes=lot.payment_deadline_minutes
            )
    else:
        # Ставок більше немає
        lot.current_price = lot.start_price
        
        if lot.status == "pending_payment":
            lot.status = "active"
            lot.payment_deadline = None

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
    # 1. Знаходимо лот
    query = select(Lot).where(Lot.id == lot_id)
    result = await db.execute(query)
    lot = result.scalar_one_or_none()

    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    # 2. Перевірки правил
    if lot.seller_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot bid on your own lot")

    if lot.status != "active":
        raise HTTPException(status_code=400, detail="Auction is closed")
    
    # 3. Валідація суми (має бути більша за поточну ціну + крок)
    # Примітка: навіть якщо користувач перебиває сам себе, він має підняти ціну відповідно до кроку
    min_bid_amount = lot.current_price + lot.min_step
    
    if bid_data.amount < min_bid_amount:
        raise HTTPException(status_code=400, detail=f"Bid must be at least {min_bid_amount}")

    # --- ГОЛОВНА ЗМІНА: ПЕРЕВІРКА НА ІСНУЮЧУ СТАВКУ ---
    existing_bid_query = select(Bid).where(
        Bid.lot_id == lot.id,
        Bid.user_id == current_user.id,
        Bid.is_active == True
    )
    existing_bid_result = await db.execute(existing_bid_query)
    existing_bid = existing_bid_result.scalar_one_or_none()

    final_bid = None

    if existing_bid:
        # А) ОНОВЛЮЄМО ІСНУЮЧУ СТАВКУ
        existing_bid.amount = bid_data.amount
        existing_bid.timestamp = datetime.now(timezone.utc)
        final_bid = existing_bid
        print(f"Updated existing bid #{existing_bid.id} to {bid_data.amount}")
    else:
        # Б) СТВОРЮЄМО НОВУ СТАВКУ
        new_bid = Bid(
            amount=bid_data.amount,
            user_id=current_user.id,
            lot_id=lot.id,
            timestamp=datetime.now(timezone.utc),
            is_active=True
        )
        db.add(new_bid)
        final_bid = new_bid
        print(f"Created new bid for User #{current_user.id}")

    # 4. Оновлюємо ціну лота
    lot.current_price = bid_data.amount
    
    await db.commit()
    await db.refresh(final_bid)
    
    return final_bid

# Отримати історію ставок (GET)
# 2. Отримати історію ставок для лота
@router.get("/{lot_id}", response_model=List[BidOut])
async def get_bids_by_lot(
    lot_id: int, 
    db: AsyncSession = Depends(get_db)
):
    # --- ЗМІНА ТУТ: Додано Bid.is_active == True ---
    # Ми не показуємо скасовані ставки (через несплату або видалення)
    query = select(Bid)\
        .where(Bid.lot_id == lot_id, Bid.is_active == True)\
        .order_by(Bid.amount.desc())
        
    result = await db.execute(query)
    return result.scalars().all()