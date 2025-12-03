from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User
from schemas import UserOut, UserUpdate
from dependencies import get_current_user_db

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

@router.get("/me", response_model=UserOut)
async def read_users_me(current_user: User = Depends(get_current_user_db)):
    return current_user

@router.patch("/me", response_model=UserOut)
async def update_user_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    # Використовуємо model_dump замість dict
    update_data = user_update.model_dump(exclude_unset=True) # <--- ЗАМІНИЛИ ТУТ

    for key, value in update_data.items():
        setattr(current_user, key, value)

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    return current_user