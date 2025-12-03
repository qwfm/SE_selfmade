from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from auth import get_current_user 
from database import get_db
from models import User

async def get_current_user_db(
    token_data: dict = Depends(get_current_user), # 1. Перевіряємо токен Auth0
    db: AsyncSession = Depends(get_db)            # 2. Беремо сесію БД
):
    """
    Повертає об'єкт користувача з нашої БД.
    Якщо користувача немає - створює його автоматично (Sign Up on first Login).
    """
    auth0_sub = token_data.get("sub")
    email = token_data.get("email") # Auth0 зазвичай передає email в токені або профайлі

    if not auth0_sub:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # Шукаємо користувача в нашій базі
    query = select(User).where(User.auth0_sub == auth0_sub)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if user is None:
        # Якщо юзер зайшов вперше - реєструємо його в нашій базі
        new_user = User(
            auth0_sub=auth0_sub,
            email=email or "unknown@example.com", # Email може бути прихованим залежно від налаштувань Auth0
            username=token_data.get("nickname")
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        return new_user
    
    return user