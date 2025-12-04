from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timezone
from auth import get_current_user 
from database import get_db
from models import User

async def get_current_user_db(
    token_data: dict = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)            
):
    auth0_sub = token_data.get("sub")
    email = token_data.get("email")

    if not auth0_sub:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    query = select(User).where(User.auth0_sub == auth0_sub)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if user is None:
        new_user = User(
            auth0_sub=auth0_sub,
            email=email or "unknown@example.com", 
            username=token_data.get("nickname")
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        return new_user
    
    # --- ПЕРЕВІРКА БЛОКУВАННЯ ---
    if user.is_blocked:
        # Перевіряємо, чи не закінчився термін бану
        if user.ban_until and user.ban_until.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            # Розблокуємо автоматично
            user.is_blocked = False
            user.ban_reason = None
            user.ban_until = None
            db.add(user)
            await db.commit()
        else:
            # БАН АКТИВНИЙ
            reason = user.ban_reason or "Порушення правил спільноти"
            until = user.ban_until.strftime('%Y-%m-%d %H:%M') if user.ban_until else "Назавжди"
            raise HTTPException(
                status_code=403, 
                detail=f"Ваш акаунт заблоковано. Причина: {reason}. Термін: {until}"
            )
    
    return user