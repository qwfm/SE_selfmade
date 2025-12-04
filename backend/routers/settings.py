from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update

from database import get_db
from models import SiteSetting, User
from schemas import RulesOut, RulesUpdate
from dependencies import get_current_user_db

router = APIRouter(
    prefix="/settings",
    tags=["settings"]
)

# 1. Отримати правила (Публічний)
@router.get("/rules", response_model=RulesOut)
async def get_rules(db: AsyncSession = Depends(get_db)):
    query = select(SiteSetting).where(SiteSetting.key == "rules")
    result = await db.execute(query)
    setting = result.scalar_one_or_none()
    
    if not setting:
        return {"content": "Правила ще не встановлені."}
    
    return {"content": setting.value}

# 2. Оновити правила (Тільки адмін)
@router.put("/rules")
async def update_rules(
    rules_data: RulesUpdate,
    current_user: User = Depends(get_current_user_db),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin required")
    
    # Перевіряємо чи є запис
    query = select(SiteSetting).where(SiteSetting.key == "rules")
    result = await db.execute(query)
    setting = result.scalar_one_or_none()
    
    if setting:
        setting.value = rules_data.content
    else:
        new_setting = SiteSetting(key="rules", value=rules_data.content)
        db.add(new_setting)
        
    await db.commit()
    return {"content": rules_data.content}