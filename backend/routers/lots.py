# backend/routers/lots.py
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import shutil
import uuid
import os

from database import get_db
from models import Lot, User, Bid, LotImage
from schemas import LotOut
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
        .options(joinedload(Lot.seller), joinedload(Lot.images))\
        .order_by(Lot.id.desc())\
        .offset(skip)\
        .limit(limit)
        
    result = await db.execute(query)
    # Тут теж важливо unique(), бо є images
    lots = result.unique().scalars().all()
    return lots

# 2. Отримати мої лоти
@router.get("/my", response_model=List[LotOut])
async def get_my_lots(
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    query = select(Lot)\
        .options(joinedload(Lot.images))\
        .where(Lot.seller_id == current_user.id)\
        .order_by(Lot.id.desc())
        
    result = await db.execute(query)
    return result.unique().scalars().all()

# 3. СТВОРИТИ ЛОТ (ПІДТРИМКА ДО 5 ФАЙЛІВ)
@router.post("/", response_model=LotOut)
async def create_lot(
    title: str = Form(...),
    description: str = Form(None),
    start_price: float = Form(...),
    min_step: float = Form(10.0),
    payment_deadline_days: int = Form(0),
    payment_deadline_hours: int = Form(24),
    payment_deadline_minutes: int = Form(0),
    images: List[UploadFile] = File(default=None), 
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    if images and len(images) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images allowed")

    new_lot = Lot(
        title=title,
        description=description,
        start_price=start_price,
        current_price=start_price,
        min_step=min_step,
        payment_deadline_days=payment_deadline_days,
        payment_deadline_hours=payment_deadline_hours,
        payment_deadline_minutes=payment_deadline_minutes,
        seller_id=current_user.id,
        status="active"
    )
    
    db.add(new_lot)
    await db.commit()
    await db.refresh(new_lot)

    if images:
        for index, img in enumerate(images):
            if img.filename:
                file_ext = img.filename.split(".")[-1]
                file_name = f"{uuid.uuid4()}.{file_ext}"
                file_path = f"uploads/{file_name}"
                
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(img.file, buffer)
                
                full_url = f"http://localhost:8000/uploads/{file_name}"
                
                new_image = LotImage(
                    image_url=full_url,
                    lot_id=new_lot.id
                )
                db.add(new_image)
                
                if index == 0:
                    new_lot.image_url = full_url

        await db.commit()
        await db.refresh(new_lot)
    
    # Повторний запит для правильного повернення структури
    query = select(Lot).options(joinedload(Lot.images)).where(Lot.id == new_lot.id)
    result = await db.execute(query)
    final_lot = result.unique().scalar_one()
    
    return final_lot

# 4. Отримати лот за ID (ТУТ БУЛА ПОМИЛКА)
@router.get("/{lot_id}", response_model=LotOut)
async def get_lot(lot_id: int, db: AsyncSession = Depends(get_db)):
    query = select(Lot)\
        .options(joinedload(Lot.seller), joinedload(Lot.images))\
        .where(Lot.id == lot_id)
        
    result = await db.execute(query)
    # ДОДАНО .unique() перед scalar_one_or_none
    lot = result.unique().scalar_one_or_none()
    
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    return lot

# 5. Закрити лот
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
        raise HTTPException(status_code=403, detail="Not authorized to close this lot")

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
    # Тут теж додаємо unique(), про всяк випадок, хоча delete працює з об'єктом
    query = select(Lot).options(joinedload(Lot.images)).where(Lot.id == lot_id)
    result = await db.execute(query)
    lot = result.unique().scalar_one_or_none()

    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    if lot.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this lot")

    if lot.images:
        for img in lot.images:
            if "uploads/" in img.image_url:
                try:
                    filename = img.image_url.split("/")[-1]
                    if os.path.exists(f"uploads/{filename}"):
                        os.remove(f"uploads/{filename}")
                except Exception as e:
                    print(f"Error deleting file: {e}")

    await db.delete(lot)
    await db.commit()
    
    return {"message": "Lot deleted"}

@router.patch("/{lot_id}")
async def update_lot(
    lot_id: int,
    title: str = Form(None),
    description: str = Form(None),
    start_price: float = Form(None),
    min_step: float = Form(None),
    # Нові параметри для картинок
    new_images: List[UploadFile] = File(default=None),
    delete_image_ids: List[int] = Form(default=None), # Список ID для видалення
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    # 1. Знаходимо лот з картинками
    query = select(Lot).options(joinedload(Lot.images)).where(Lot.id == lot_id)
    result = await db.execute(query)
    lot = result.unique().scalar_one_or_none()

    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    # 2. Перевірка прав і ставок
    if lot.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    bids_query = select(Bid).where(Bid.lot_id == lot_id)
    bids_res = await db.execute(bids_query)
    if len(bids_res.scalars().all()) > 0:
        raise HTTPException(status_code=400, detail="Cannot edit lot after bids have been placed")

    # 3. Валідація ліміту картинок (5 штук)
    current_images_count = len(lot.images)
    delete_count = len(delete_image_ids) if delete_image_ids else 0
    new_count = len([img for img in new_images if img.filename]) if new_images else 0
    
    final_count = current_images_count - delete_count + new_count
    
    if final_count > 5:
        raise HTTPException(status_code=400, detail=f"Total images cannot exceed 5. Resulting count: {final_count}")

    # 4. Оновлення текстових полів
    if title: lot.title = title
    if description: lot.description = description
    if min_step: lot.min_step = min_step
    if start_price:
        lot.start_price = start_price
        lot.current_price = start_price

    # 5. ВИДАЛЕННЯ КАРТИНОК
    if delete_image_ids:
        # Фільтруємо картинки, які належать цьому лоту і є в списку на видалення
        images_to_delete = [img for img in lot.images if img.id in delete_image_ids]
        
        for img in images_to_delete:
            # Видаляємо файл з диску
            if "uploads/" in img.image_url:
                try:
                    filename = img.image_url.split("/")[-1]
                    if os.path.exists(f"uploads/{filename}"):
                        os.remove(f"uploads/{filename}")
                except Exception as e:
                    print(f"Error deleting file: {e}")
            
            # Видаляємо з БД
            await db.delete(img)
            
            # Якщо ми видалили обкладинку (image_url в Lot), треба очистити це поле
            if lot.image_url == img.image_url:
                lot.image_url = None

    # 6. ДОДАВАННЯ НОВИХ КАРТИНОК
    if new_images:
        for img in new_images:
            if img.filename:
                file_ext = img.filename.split(".")[-1]
                file_name = f"{uuid.uuid4()}.{file_ext}"
                file_path = f"uploads/{file_name}"
                
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(img.file, buffer)
                
                full_url = f"http://localhost:8000/uploads/{file_name}"
                
                new_image_obj = LotImage(image_url=full_url, lot_id=lot.id)
                db.add(new_image_obj)
                
                # Якщо обкладинки немає (або ми її видалили), ставимо першу нову як обкладинку
                if not lot.image_url:
                    lot.image_url = full_url

    await db.commit()
    
    # Оновлюємо обкладинку, якщо список змінився, а image_url пустий
    # (Беремо першу з тих, що залишились)
    await db.refresh(lot)
    # Re-fetch images to be sure
    lot_reloaded = await db.execute(select(Lot).options(joinedload(Lot.images)).where(Lot.id == lot_id))
    lot = lot_reloaded.unique().scalar_one()
    
    if not lot.image_url and lot.images:
        lot.image_url = lot.images[0].image_url
        await db.commit()

    return lot