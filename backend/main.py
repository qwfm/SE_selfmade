from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from database import engine
from models import Base

# --- ІМПОРТИ РОУТЕРІВ ---
from routers import lots, bids, payments, users  # <--- 1. Додайте users сюди

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting up database...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    print("Shutting down...")

app = FastAPI(title="Bid&Buy API", lifespan=lifespan)

origins = [
    "http://localhost:3000",
    "http://localhost:5173",  # Vite dev server
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ПІДКЛЮЧЕННЯ РОУТЕРІВ ---
app.include_router(lots.router)
app.include_router(bids.router)
app.include_router(payments.router)
app.include_router(users.router)  # <--- 2. Додайте цей рядок!

@app.get("/")
def read_root():
    return {"message": "Bid&Buy API is running"}