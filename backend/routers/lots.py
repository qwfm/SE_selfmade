from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import shutil
import uuid
import os

from database import get_db
from models import Lot, User, Bid
from schemas import LotOut
from dependencies import get_current_user_db 
from sqlalchemy.orm import joinedload
from sqlalchemy import desc

router = APIRouter(
    prefix="/lots",
    tags=["lots"]
)

# ... (get_lots, get_my_lots, get_lot залишаються без змін) ...

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

# 3. Отримати лот
@router.get("/{lot_id}", response_model=LotOut)
async def get_lot(lot_id: int, db: AsyncSession = Depends(get_db)):
    query = select(Lot).options(joinedload(Lot.seller)).where(Lot.id == lot_id)
    result = await db.execute(query)
    lot = result.scalar_one_or_none()
    
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    
    # Логіка прострочення
    if lot.status == "pending_payment" and lot.payment_deadline:
        if datetime.now(timezone.utc) > lot.payment_deadline.replace(tzinfo=timezone.utc):
            bids_query = select(Bid).where(Bid.lot_id == lot.id, Bid.is_active == True).order_by(Bid.amount.desc())
            bids_res = await db.execute(bids_query)
            active_bids = bids_res.scalars().all()
            
            if active_bids:
                failed_winner_bid = active_bids[0]
                failed_winner_bid.is_active = False
                if len(active_bids) > 1:
                    next_winner_bid = active_bids[1]
                    lot.current_price = next_winner_bid.amount
                    lot.payment_deadline = datetime.now(timezone.utc) + timedelta(
                        days=lot.payment_deadline_days, hours=lot.payment_deadline_hours, minutes=lot.payment_deadline_minutes
                    )
                else:
                    lot.status = "active"
                    lot.payment_deadline = None
                    lot.current_price = lot.start_price
            else:
                lot.status = "active"
                lot.payment_deadline = None
                lot.current_price = lot.start_price

            await db.commit()
            await db.refresh(lot)

    return lot

# 4. Створити лот (ОНОВЛЕНО ДЛЯ ЗАВАНТАЖЕННЯ ФАЙЛІВ)
@router.post("/", response_model=LotOut)
async def create_lot(
    request: Request,
    title: str = Form(...),
    description: str = Form(None),
    start_price: float = Form(...),
    min_step: float = Form(10.0),
    payment_deadline_days: int = Form(0),
    payment_deadline_hours: int = Form(24),
    payment_deadline_minutes: int = Form(0),
    image: UploadFile = File(None), # Файл тепер тут
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    image_url = None
    
    # Обробка файлу
    if image:
        # Генеруємо унікальне ім'я
        file_ext = image.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{file_ext}"
        file_path = f"uploads/{filename}"
        
        # Зберігаємо на диск
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
            
        # Генеруємо повне посилання (наприклад: http://localhost:8000/uploads/abc.jpg)
        base_url = str(request.base_url) # http://localhost:8000/
        image_url = f"{base_url}uploads/{filename}"

    new_lot = Lot(
        title=title,
        description=description,
        start_price=start_price,
        current_price=start_price,
        min_step=min_step,
        payment_deadline_days=payment_deadline_days,
        payment_deadline_hours=payment_deadline_hours,
        payment_deadline_minutes=payment_deadline_minutes,
        image_url=image_url, # Зберігаємо наше локальне посилання
        seller_id=current_user.id,
        status="active"
    )
    db.add(new_lot)
    await db.commit()
    await db.refresh(new_lot)
    return new_lot

# 5. Закриття аукціону
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
        message = "Auction closed. Winner selected."

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

    # Якщо є картинка - видаляємо її з диску (опціонально, але гарний тон)
    if lot.image_url and "uploads/" in lot.image_url:
        try:
            filename = lot.image_url.split("uploads/")[-1]
            if os.path.exists(f"uploads/{filename}"):
                os.remove(f"uploads/{filename}")
        except Exception:
            pass

    await db.delete(lot)
    await db.commit()
    
    return {"message": "Lot deleted successfully"}