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
    - Видаляє ставку переможця (HARD DELETE).
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
                        # 1. Зберігаємо дані для сповіщення
                        failed_user_id = failed_bid.user_id
                        
                        # 2. HARD DELETE - Видаляємо ставку повністю
                        await db.delete(failed_bid)
                        
                        # 3. Сповіщення невдасі
                        fail_notif = Notification(
                            user_id=failed_user_id,
                            message=f"⏰ Час на оплату лота '{lot.title}' вичерпано. Вашу перемогу анульовано та ставку видалено."
                        )
                        db.add(fail_notif)
                        
                        print(f"   -> Bid #{failed_bid.id} deleted due to expiration.")

                        # 4. Шукаємо наступного (тепер після видалення попередньої ставки)
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
                            # Нікого немає -> Лот знову активний, ціна повертається до стартової
                            lot.status = "active"
                            lot.current_price = lot.start_price
                            lot.payment_deadline = None
                            
                            seller_notif = Notification(
                                user_id=lot.seller_id,
                                message=f"⚠️ Переможець лота '{lot.title}' не оплатив, і інших ставок немає. Лот знову активний з початковою ціною ${lot.start_price}."
                            )
                            db.add(seller_notif)
                            print("   -> No other bids. Lot set to ACTIVE with start price.")
                
                await db.commit()

        except Exception as e:
            print(f"[Check Expired Error]: {e}")
        
        await asyncio.sleep(10) # Перевірка кожні 10 сек

async def delete_old_cancelled_bids():
    """
    Задача 2: Видаляє ставки, які були скасовані (cancelled_at) більше 10 хвилин тому.
    ПРИМІТКА: У поточній версії ми робимо HARD DELETE одразу, тому ця задача не використовується.
    Залишаємо на випадок майбутньої зміни логіки на SOFT DELETE.
    """
    while True:
        try:
            async with AsyncSessionLocal() as db:
                now = datetime.now(timezone.utc)
                cutoff_time = now - timedelta(minutes=10)
                
                # Знаходимо неактивні ставки старше 10 хвилин
                # (У поточній версії таких не буде, бо ми робимо HARD DELETE)
                query = select(Bid).where(
                    and_(
                        Bid.is_active == False,
                        Bid.timestamp < cutoff_time
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

async def close_inactive_lots():
    """
    Задача 3: Закриває лоти, які були активними без ставок 7+ днів
    """
    while True:
        try:
            async with AsyncSessionLocal() as db:
                now = datetime.now(timezone.utc)
                # Час "Ч" = зараз мінус 7 днів
                cutoff_time = now - timedelta(days=7)
                
                # Знаходимо лоти для закриття:
                # 1. Статус = active
                # 2. Створені більше 7 днів тому
                # 3. Немає жодної активної ставки
                query = select(Lot).where(
                    and_(
                        Lot.status == "active",
                        Lot.created_at < cutoff_time
                    )
                )
                result = await db.execute(query)
                old_lots = result.scalars().all()
                
                for lot in old_lots:
                    # Перевіряємо чи є активні ставки
                    bids_query = select(Bid).where(
                        Bid.lot_id == lot.id,
                        Bid.is_active == True
                    )
                    bids_result = await db.execute(bids_query)
                    active_bids = bids_result.scalars().all()
                    
                    # Якщо ставок немає - закриваємо
                    if len(active_bids) == 0:
                        lot.status = "closed_unsold"
                        lot.closed_at = now
                        
                        # Сповіщення продавцю
                        notification = Notification(
                            user_id=lot.seller_id,
                            message=f"⏰ Ваш лот '{lot.title}' був автоматично закритий через відсутність ставок протягом 7 днів."
                        )
                        db.add(notification)
                        
                        print(f"[AUTO-CLOSE] Lot #{lot.id} '{lot.title}' closed due to inactivity (7+ days, no bids)")
                
                await db.commit()
                
        except Exception as e:
            print(f"[Close Inactive Lots Error]: {e}")
        
        # Перевірка раз на годину (3600 секунд)
        await asyncio.sleep(3600)

async def start_background_tasks():
    """
    Запускає всі фонові задачі
    """
    asyncio.create_task(check_expired_payments())
    asyncio.create_task(delete_old_cancelled_bids())
    asyncio.create_task(close_inactive_lots())