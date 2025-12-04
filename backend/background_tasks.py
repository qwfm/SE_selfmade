# backend/background_tasks.py
import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_
from database import AsyncSessionLocal
from models import Lot, Bid

async def check_expired_payments():
    """
    Фонова задача: 
    1. Знаходить лоти в статусі 'pending_payment', у яких вийшов час (payment_deadline).
    2. Скасовує ставку поточного переможця (is_active = False).
    3. Передає перемогу наступному (Runner-up).
    """
    while True:
        try:
            async with AsyncSessionLocal() as db:
                now = datetime.now(timezone.utc)
                
                # Знаходимо всі лоти з простроченим дедлайном
                query = select(Lot).where(
                    and_(
                        Lot.status == "pending_payment",
                        Lot.payment_deadline.isnot(None),
                        Lot.payment_deadline < now
                    )
                )
                
                result = await db.execute(query)
                expired_lots = result.scalars().all()
                
                if expired_lots:
                    print(f"[BACKGROUND] Found {len(expired_lots)} expired lots. Processing...")
                
                for lot in expired_lots:
                    print(f"[BACKGROUND] Lot #{lot.id} payment expired.")
                    
                    # Знаходимо всі АКТИВНІ ставки для цього лота, відсортовані від найвищої
                    bids_query = select(Bid).where(
                        Bid.lot_id == lot.id,
                        Bid.is_active == True
                    ).order_by(Bid.amount.desc())
                    
                    bids_res = await db.execute(bids_query)
                    all_bids = bids_res.scalars().all()
                    
                    if not all_bids:
                        # Дивна ситуація: статус pending, але ставок немає.
                        lot.status = "active"
                        lot.payment_deadline = None
                        lot.current_price = lot.start_price
                        print(f"   -> No bids found. Reactivated lot.")
                        continue
                        
                    # Поточний переможець (той, хто не заплатив)
                    failed_winner_bid = all_bids[0]
                    
                    # 1. СКАСОВУЄМО СТАВКУ ЧЕЛІКА
                    failed_winner_bid.is_active = False
                    print(f"   -> Cancelled bid #{failed_winner_bid.id} (User {failed_winner_bid.user_id}, ${failed_winner_bid.amount})")
                    
                    # 2. Шукаємо наступного переможця
                    # Оскільки ми щойно деактивували [0], наступний активний буде [1] (якщо він був)
                    if len(all_bids) > 1:
                        next_winner_bid = all_bids[1] # Це вже наступна ставка, бо список був відсортований
                        
                        # Оновлюємо ціну лота до ставки нового переможця
                        lot.current_price = next_winner_bid.amount
                        
                        # Оновлюємо дедлайн (даємо новому переможцю стільки ж часу)
                        lot.payment_deadline = now + timedelta(
                            days=lot.payment_deadline_days,
                            hours=lot.payment_deadline_hours,
                            minutes=lot.payment_deadline_minutes
                        )
                        
                        print(f"   -> New winner: User {next_winner_bid.user_id} (${next_winner_bid.amount})")
                    else:
                        # Більше нікого немає
                        print(f"   -> No other bidders. Reactivating lot.")
                        lot.status = "active"
                        lot.payment_deadline = None
                        lot.current_price = lot.start_price
                
                await db.commit()
                
        except Exception as e:
            print(f"[BACKGROUND ERROR]: {e}")
        
        # Перевіряємо кожні 10 секунд (можна рідше, але для тесту 10 ок)
        await asyncio.sleep(10)

async def start_background_tasks():
    asyncio.create_task(check_expired_payments())