import asyncio
import os
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, delete
from sqlalchemy.orm import joinedload
from database import AsyncSessionLocal
from models import Lot, Bid

async def check_expired_payments():
    while True:
        try:
            async with AsyncSessionLocal() as db:
                now = datetime.now(timezone.utc)
                
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
                    
                    bids_query = select(Bid).where(
                        Bid.lot_id == lot.id,
                        Bid.is_active == True
                    ).order_by(Bid.amount.desc())
                    
                    bids_res = await db.execute(bids_query)
                    all_bids = bids_res.scalars().all()
                    
                    if not all_bids:
                        lot.status = "active"
                        lot.payment_deadline = None
                        lot.current_price = lot.start_price
                        print(f"   -> No bids found. Reactivated lot.")
                        continue
                        
                    failed_winner_bid = all_bids[0]
                    
                    failed_winner_bid.is_active = False
                    print(f"   -> Cancelled bid #{failed_winner_bid.id} (User {failed_winner_bid.user_id}, ${failed_winner_bid.amount})")
                    
                    
                    if len(all_bids) > 1:
                        next_winner_bid = all_bids[1] 
                        
                        lot.current_price = next_winner_bid.amount
                        
                        lot.payment_deadline = now + timedelta(
                            days=lot.payment_deadline_days,
                            hours=lot.payment_deadline_hours,
                            minutes=lot.payment_deadline_minutes
                        )
                        
                        print(f"   -> New winner: User {next_winner_bid.user_id} (${next_winner_bid.amount})")
                    else:
                        print(f"   -> No other bidders. Reactivating lot.")
                        lot.status = "active"
                        lot.payment_deadline = None
                        lot.current_price = lot.start_price
                
                await db.commit()
                
        except Exception as e:
            print(f"[BACKGROUND ERROR]: {e}")
        
        await asyncio.sleep(10)

async def clean_unsold_lots():
    while True:
        try:
            async with AsyncSessionLocal() as db:
                now = datetime.now(timezone.utc)
                deadline = now - timedelta(hours=24) 
                
                query = select(Lot).options(joinedload(Lot.images)).where(
                    and_(
                        Lot.status == "closed_unsold",
                        Lot.closed_at.isnot(None),
                        Lot.closed_at < deadline
                    )
                )
                
                result = await db.execute(query)
                lots_to_delete = result.unique().scalars().all()
                
                if lots_to_delete:
                    print(f"[BACKGROUND] Found {len(lots_to_delete)} unsold lots older than 24h. Deleting...")
                
                for lot in lots_to_delete:
                    if lot.images:
                        for img in lot.images:
                            if "uploads/" in img.image_url:
                                try:
                                    filename = img.image_url.split("/")[-1]
                                    if os.path.exists(f"uploads/{filename}"):
                                        os.remove(f"uploads/{filename}")
                                except Exception: pass
                    
                    await db.delete(lot)
                    print(f"   -> Deleted Lot #{lot.id}")

                await db.commit()
                
        except Exception as e:
            print(f"[BACKGROUND CLEANUP ERROR]: {e}")
        
        await asyncio.sleep(60)

async def start_background_tasks():
    asyncio.create_task(check_expired_payments())
    asyncio.create_task(clean_unsold_lots())