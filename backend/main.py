import os
from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import engine
from models import Base
from background_tasks import start_background_tasks

# --- ІМПОРТИ РОУТЕРІВ ---
from routers import lots, bids, payments, users, admin, settings

if not os.path.exists("uploads"):
    os.makedirs("uploads")

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting up database...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("Starting background tasks...")
    await start_background_tasks()
    
    yield
    print("Shutting down...")

app = FastAPI(title="Bid&Buy API", lifespan=lifespan)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(lots.router)
app.include_router(bids.router)
app.include_router(payments.router)
app.include_router(users.router)
app.include_router(admin.router)
app.include_router(settings.router)

@app.get("/")
def read_root():
    return {"message": "Bid&Buy API is running"}