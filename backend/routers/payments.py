from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta
from typing import List

from database import get_db
from models import Payment, Lot, User, Bid
from schemas import PaymentCreate, PaymentOut
from dependencies import get_current_user_db

router = APIRouter(
    prefix="/payments",
    tags=["payments"]
)

@router.post("/", response_model=PaymentOut)
async def process_payment(
    payment_data: PaymentCreate,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    # 1. Знаходимо лот
    query = select(Lot).where(Lot.id == payment_data.lot_id)
    result = await db.execute(query)
    lot = result.scalar_one_or_none()

    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    # 2. Перевірка: Чи лот вже проданий?
    if lot.status == "sold":
        raise HTTPException(status_code=400, detail="Lot already sold")

    # 3. Перевірка: Чи є payment_deadline? (Аукціон має бути закритий)
    if not lot.payment_deadline:
        raise HTTPException(status_code=400, detail="Auction is still active. Cannot pay yet.")
    
    # 4. Перевірка: Чи не прострочений payment_deadline?
    if lot.payment_deadline.replace(tzinfo=None) < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Payment deadline has passed. Winner has changed.")

    # 5. Перевірка: Чи користувач є переможцем?
    # Шукаємо найвищу активну ставку для цього лота
    bid_query = select(Bid).where(
        Bid.lot_id == lot.id,
        Bid.is_active == True
    ).order_by(Bid.amount.desc()).limit(1)
    bid_result = await db.execute(bid_query)
    highest_bid = bid_result.scalar_one_or_none()

    if not highest_bid:
        raise HTTPException(status_code=400, detail="No active bids for this lot")

    if highest_bid.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the auction winner can pay for this lot")

    # 6. Створення платежу
    amount_to_pay = highest_bid.amount # Платимо стільки, скільки поставили

    new_payment = Payment(
        lot_id=lot.id,
        user_id=current_user.id,
        amount=amount_to_pay
    )
    
    # Оновлюємо статус лота
    lot.status = "sold"
    lot.payment_deadline = None  # Очищаємо payment_deadline після оплати

    db.add(new_payment)
    await db.commit()
    await db.refresh(new_payment)

    return new_payment

# Endpoint для перевірки прострочених платежів та передачі перемоги наступному
@router.post("/check-expired")
async def check_expired_payments(
    db: AsyncSession = Depends(get_db)
):
    """
    Перевіряє лоти з простроченим payment_deadline та передає перемогу наступному переможцю.
    Цей endpoint можна викликати періодично (наприклад, через cron job).
    """
    now = datetime.utcnow()
    
    # Знаходимо лоти з простроченим payment_deadline, які ще не продані
    query = select(Lot).where(
        Lot.payment_deadline.isnot(None),
        Lot.payment_deadline < now,
        Lot.status != "sold"
    )
    result = await db.execute(query)
    expired_lots = result.scalars().all()
    
    updated_lots = []
    
    for lot in expired_lots:
        # Знаходимо всі активні ставки для цього лота, відсортовані за сумою (від найвищої)
        bids_query = select(Bid).where(
            Bid.lot_id == lot.id,
            Bid.is_active == True
        ).order_by(Bid.amount.desc())
        bids_result = await db.execute(bids_query)
        all_bids = bids_result.scalars().all()
        
        if len(all_bids) == 0:
            # Немає ставок - закриваємо лот
            lot.status = "closed"
            lot.payment_deadline = None
            updated_lots.append({"lot_id": lot.id, "action": "closed", "reason": "no_bids"})
        elif len(all_bids) == 1:
            # Тільки одна ставка - закриваємо лот (переможець не оплатив, інших немає)
            lot.status = "closed"
            lot.payment_deadline = None
            updated_lots.append({"lot_id": lot.id, "action": "closed", "reason": "only_one_bid"})
        else:
            # Є інші ставки - передаємо перемогу наступному
            # Деактивуємо попередню найвищу ставку
            previous_winner_bid = all_bids[0]
            previous_winner_bid.is_active = False
            
            # Нова найвища ставка стає переможцем
            new_winner_bid = all_bids[1]
            
            # Встановлюємо новий payment_deadline = поточний час + дні + години + хвилини
            now = datetime.utcnow()
            payment_deadline = now + timedelta(
                days=lot.payment_deadline_days,
                hours=lot.payment_deadline_hours,
                minutes=lot.payment_deadline_minutes
            )
            lot.payment_deadline = payment_deadline
            
            updated_lots.append({
                "lot_id": lot.id,
                "action": "winner_changed",
                "previous_winner_id": previous_winner_bid.user_id,
                "new_winner_id": new_winner_bid.user_id,
                "new_payment_deadline": lot.payment_deadline.isoformat() if lot.payment_deadline else None
            })
    
    await db.commit()
    
    return {
        "message": f"Checked {len(expired_lots)} lots with expired payment deadlines",
        "updated_lots": updated_lots
    }