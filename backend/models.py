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
    is_blocked = Column(Boolean, default=False)
    ban_reason = Column(String, nullable=True)
    ban_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    phone_number = Column(String, nullable=True)
    bio = Column(Text, nullable=True) 

    lots = relationship("Lot", back_populates="seller") 
    bids = relationship("Bid", back_populates="bidder") 
    payments = relationship("Payment", back_populates="payer")
    
    notifications = relationship("Notification", back_populates="recipient", cascade="all, delete-orphan")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    recipient = relationship("User", back_populates="notifications")

class Lot(Base):
    __tablename__ = "lots"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    start_price = Column(Numeric(10, 2), nullable=False)
    current_price = Column(Numeric(10, 2), nullable=True)
    min_step = Column(Numeric(10, 2), default=10.00)
    status = Column(String, default="active", index=True)
    image_url = Column(String, nullable=True)
    payment_deadline_days = Column(Integer, nullable=False, default=0)
    payment_deadline_hours = Column(Integer, nullable=False, default=24)
    payment_deadline_minutes = Column(Integer, nullable=False, default=0)
    payment_deadline = Column(DateTime(timezone=True), nullable=True)
    lot_type = Column(String, default="private")
    seller_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)
    
    seller = relationship("User", back_populates="lots")
    images = relationship("LotImage", back_populates="lot", cascade="all, delete-orphan")
    bids = relationship("Bid", back_populates="lot", order_by="desc(Bid.amount)", cascade="all, delete-orphan")
    payment = relationship("Payment", back_populates="lot", uselist=False, cascade="all, delete-orphan")

class LotImage(Base):
    __tablename__ = "lot_images"
    id = Column(Integer, primary_key=True, index=True)
    image_url = Column(String, nullable=False)
    lot_id = Column(Integer, ForeignKey("lots.id"))
    lot = relationship("Lot", back_populates="images")

class Bid(Base):
    __tablename__ = "bids"
    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    lot_id = Column(Integer, ForeignKey("lots.id"))
    # cancelled_at - ВИДАЛЕНО, бо тепер hard delete
    bidder = relationship("User", back_populates="bids")
    lot = relationship("Lot", back_populates="bids")

class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user_id = Column(Integer, ForeignKey("users.id"))
    lot_id = Column(Integer, ForeignKey("lots.id"))
    payer = relationship("User", back_populates="payments")
    lot = relationship("Lot", back_populates="payment")
    
class SiteSetting(Base):
    __tablename__ = "site_settings"
    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False)