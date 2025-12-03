from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Numeric, DateTime, Text, func
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    auth0_sub = Column(String, unique=True, nullable=False, index=True) 
    email = Column(String, nullable=False)
    username = Column(String, nullable=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    phone_number = Column(String, nullable=True)
    bio = Column(Text, nullable=True) 

    lots = relationship("Lot", back_populates="seller") 
    bids = relationship("Bid", back_populates="bidder") 
    payments = relationship("Payment", back_populates="payer")

class Lot(Base):
    __tablename__ = "lots"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    start_price = Column(Numeric(10, 2), nullable=False)
    current_price = Column(Numeric(10, 2), nullable=True)
    min_step = Column(Numeric(10, 2), default=1.0)
    status = Column(String, default="active") # active, sold, closed
    image_url = Column(String, nullable=True)
    payment_deadline = Column(DateTime(timezone=True), nullable=True)
    payment_deadline_days = Column(Integer, nullable=False, default=0)  # Кількість днів для оплати
    payment_deadline_hours = Column(Integer, nullable=False, default=24)  # Кількість годин для оплати
    payment_deadline_minutes = Column(Integer, nullable=False, default=0)  # Кількість хвилин для оплати
    
    seller_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    seller = relationship("User", back_populates="lots")
    bids = relationship("Bid", back_populates="lot", order_by="desc(Bid.amount)")
    payment = relationship("Payment", back_populates="lot", uselist=False)

class Bid(Base):
    __tablename__ = "bids"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    
    user_id = Column(Integer, ForeignKey("users.id"))
    lot_id = Column(Integer, ForeignKey("lots.id"))

    bidder = relationship("User", back_populates="bids")
    lot = relationship("Lot", back_populates="bids")

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    lot_id = Column(Integer, ForeignKey("lots.id"))
    user_id = Column(Integer, ForeignKey("users.id"))

    payer = relationship("User", back_populates="payments")
    lot = relationship("Lot", back_populates="payment")