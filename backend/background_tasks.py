# backend/background_tasks.py
import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, delete
from sqlalchemy.orm import joinedload
from database import AsyncSessionLocal
from models import Lot, Bid, Notification

async def check_expired_payments():
    """
    Задача 1: Перевіряє прострочені оплати.
    - Скасовує ставку переможця.
    - Надсилає сповіщення про провал.
    - Передає перемогу наступному.
    """
    while True:
        try:
            async with AsyncSessionLocal() as db:
                now = datetime.now(timezone.utc)
                
                # Шукаємо лоти, де час оплати вийшов
                query = select(Lot).where(
                    and_(
                        Lot.status == "pending_payment",
                        Lot.payment_deadline < now
                    )
                )
                result = await db.execute(query)
                expired_lots = result.scalars().all()
                
                for lot in expired_lots:
                    print(f"[TASK] Processing expired lot #{lot.id}")
                    
                    # Знаходимо поточного "переможця", який не заплатив
                    current_winner_bid_q = select(Bid).where(
                        Bid.lot_id == lot.id, 
                        Bid.is_active == True
                    ).order_by(Bid.amount.desc()).limit(1)
                    
                    cw_res = await db.execute(current_winner_bid_q)
                    failed_bid = cw_res.scalar_one_or_none()
                    
                    if failed_bid:
                        # 1. Скасовуємо ставку і ставимо мітку часу для видалення
                        failed_bid.is_active = False
                        failed_bid.cancelled_at = datetime.now(timezone.utc) # <--- ВАЖЛИВО для видалення через 10 хв
                        
                        # 2. Сповіщення невдасі
                        fail_notif = Notification(
                            user_id=failed_bid.user_id,
                            message=f"⏰ Час на оплату лота '{lot.title}' вичерпано. Вашу перемогу анульовано."
                        )
                        db.add(fail_notif)
                        
                        print(f"   -> Bid #{failed_bid.id} cancelled due to expiration.")

                        # 3. Шукаємо наступного
                        next_bid_q = select(Bid).where(
                            Bid.lot_id == lot.id, 
                            Bid.is_active == True
                        ).order_by(Bid.amount.desc()).limit(1)
                        
                        next_res = await db.execute(next_bid_q)
                        next_bid = next_res.scalar_one_or_none()
                        
                        if next_bid:
                            # Новий переможець
                            lot.current_price = next_bid.amount
                            lot.payment_deadline = now + timedelta(
                                days=lot.payment_deadline_days,
                                hours=lot.payment_deadline_hours,
                                minutes=lot.payment_deadline_minutes
                            )
                            
                            # Сповіщення новому переможцю
                            new_win_notif = Notification(
                                user_id=next_bid.user_id,
                                message=f"🎉 Попередній переможець не заплатив! Тепер ви виграли лот '{lot.title}'. Оплатіть до {lot.payment_deadline.strftime('%d.%m %H:%M')}."
                            )
                            db.add(new_win_notif)
                            print(f"   -> New winner found: User #{next_bid.user_id}")
                        else:
                            # Нікого немає -> Лот знову активний
                            lot.status = "active"
                            lot.payment_deadline = None
                            
                            seller_notif = Notification(
                                user_id=lot.seller_id,
                                message=f"⚠️ Переможець лота '{lot.title}' не оплатив, і інших ставок немає. Лот знову активний."
                            )
                            db.add(seller_notif)
                            print("   -> No other bids. Lot set to ACTIVE.")
                
                await db.commit()

        except Exception as e:
            print(f"[Check Expired Error]: {e}")
        
        await asyncio.sleep(10) # Перевірка кожні 10 сек

async def delete_old_cancelled_bids():
    """
    Задача 2: Видаляє ставки, які були скасовані (cancelled_at) більше 10 хвилин тому.
    """
    while True:
        try:
            async with AsyncSessionLocal() as db:
                now = datetime.now(timezone.utc)
                # Час "Ч" = зараз мінус 10 хвилин
                cutoff_time = now - timedelta(minutes=10)
                
                # Знаходимо ставки для фізичного видалення
                query = select(Bid).where(
                    and_(
                        Bid.is_active == False,
                        Bid.cancelled_at.isnot(None),
                        Bid.cancelled_at < cutoff_time
                    )
                )
                result = await db.execute(query)
                bids_to_delete = result.scalars().all()
                
                if bids_to_delete:
                    print(f"[CLEANUP] Found {len(bids_to_delete)} old cancelled bids. Deleting...")
                    for bid in bids_to_delete:
                        await db.delete(bid)
                    
                    await db.commit()
                    print(f"   -> Deleted successfully.")
                    
        except Exception as e:
            print(f"[Cleanup Bids Error]: {e}")
            
        await asyncio.sleep(60) # Перевірка раз на хвилину

async def start_background_tasks():
    asyncio.create_task(check_expired_payments())
    asyncio.create_task(delete_old_cancelled_bids())