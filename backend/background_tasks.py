# backend/background_tasks.py
import asyncio
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_
from database import AsyncSessionLocal
from models import Lot, Bid
from datetime import timedelta

async def check_expired_payments():
    """
    Фонова задача: перевіряє прострочені payment_deadline
    та автоматично реактивує лоти або передає перемогу.
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
                
                print(f"[BACKGROUND] Checking expired payments... Found {len(expired_lots)} lots")
                
                for lot in expired_lots:
                    print(f"[BACKGROUND] Processing expired Lot #{lot.id}")
                    
                    # Шукаємо всі активні ставки
                    bids_query = select(Bid).where(
                        Bid.lot_id == lot.id,
                        Bid.is_active == True
                    ).order_by(Bid.amount.desc())
                    
                    bids_res = await db.execute(bids_query)
                    active_bids = bids_res.scalars().all()
                    
                    if active_bids:
                        # Дискваліфікуємо поточного переможця
                        failed_winner = active_bids[0]
                        failed_winner.is_active = False
                        print(f"[BACKGROUND] Disqualified User #{failed_winner.user_id} from Lot #{lot.id}")
                        
                        if len(active_bids) > 1:
                            # Є наступний учасник - передаємо йому
                            next_winner = active_bids[1]
                            lot.current_price = next_winner.amount
                            lot.payment_deadline = now + timedelta(
                                days=lot.payment_deadline_days,
                                hours=lot.payment_deadline_hours,
                                minutes=lot.payment_deadline_minutes
                            )
                            print(f"[BACKGROUND] Transferred win to User #{next_winner.user_id}")
                        else:
                            # ⚠️ ЄДИНИЙ УЧАСНИК - РЕАКТИВУЄМО ЛОТ
                            lot.status = "active"
                            lot.payment_deadline = None
                            lot.current_price = lot.start_price
                            print(f"[BACKGROUND] ✅ Reactivated Lot #{lot.id} to ACTIVE")
                    else:
                        # Немає ставок - просто реактивуємо
                        lot.status = "active"
                        lot.payment_deadline = None
                        lot.current_price = lot.start_price
                        print(f"[BACKGROUND] Reactivated Lot #{lot.id} (no bids)")
                
                await db.commit()
                
        except Exception as e:
            print(f"[BACKGROUND ERROR]: {e}")
        
        # Перевіряємо кожні 60 секунд
        await asyncio.sleep(60)


# Функція для запуску фонової задачі
async def start_background_tasks():
    """Запускає всі фонові задачі"""
    asyncio.create_task(check_expired_payments())