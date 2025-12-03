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

# 1. Отримати всі лоти
@router.get("/", response_model=List[LotOut])
async def get_lots(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
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

# --- 3. ОТРИМАТИ ЛОТ (З ПЕРЕВІРКОЮ ПРОСТРОЧКИ) ---
@router.get("/{lot_id}", response_model=LotOut)
async def get_lot(lot_id: int, db: AsyncSession = Depends(get_db)):
    query = select(Lot).options(joinedload(Lot.seller)).where(Lot.id == lot_id)
    result = await db.execute(query)
    lot = result.scalar_one_or_none()
    
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    
    # === ЛОГІКА АВТОМАТИЧНОГО СКАСУВАННЯ / ПЕРЕДАЧІ ПЕРЕМОГИ ===
    # Перевіряємо, чи лот чекає оплати і чи вийшов час
    if lot.status == "pending_payment" and lot.payment_deadline:
        if datetime.now(timezone.utc) > lot.payment_deadline.replace(tzinfo=timezone.utc):
            print(f"Payment deadline expired for Lot #{lot.id}")
            
            # 1. Шукаємо всі АКТИВНІ ставки
            bids_query = select(Bid).where(
                Bid.lot_id == lot.id, 
                Bid.is_active == True
            ).order_by(Bid.amount.desc())
            
            bids_res = await db.execute(bids_query)
            active_bids = bids_res.scalars().all()
            
            if active_bids:
                # Поточний "переможець" - це перший у списку. Він прострочив.
                failed_winner_bid = active_bids[0]
                failed_winner_bid.is_active = False # Дискваліфікація!
                
                # 2. Перевіряємо, чи є наступний (Runner-up)
                if len(active_bids) > 1:
                    # Є наступний учасник
                    next_winner_bid = active_bids[1]
                    print(f"Transferring win to User #{next_winner_bid.user_id}")
                    
                    # Оновлюємо ціну лота до ціни нового переможця
                    lot.current_price = next_winner_bid.amount
                    
                    # Даємо новому переможцю новий час на оплату
                    lot.payment_deadline = datetime.now(timezone.utc) + timedelta(
                        days=lot.payment_deadline_days,
                        hours=lot.payment_deadline_hours,
                        minutes=lot.payment_deadline_minutes
                    )
                    # Статус залишається 'pending_payment'
                    
                else:
                    # Учасників більше немає (це був єдиний).
                    print("No other bids. Reverting lot to ACTIVE.")
                    
                    lot.status = "active"
                    lot.payment_deadline = None
                    lot.current_price = lot.start_price # Скидаємо ціну до стартової
            
            else:
                # Дивна ситуація: статус pending, а активних ставок немає. Просто скидаємо.
                lot.status = "active"
                lot.payment_deadline = None
                lot.current_price = lot.start_price

            await db.commit()
            await db.refresh(lot)

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
    bid_query = select(Bid).where(Bid.lot_id == lot.id, Bid.is_active == True).order_by(Bid.amount.desc()).limit(1)
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