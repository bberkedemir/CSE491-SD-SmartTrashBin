from sqlalchemy import Column, Integer, Float, String, DateTime, CheckConstraint
from sqlalchemy.sql import func
from app.core.database import Base


class Bin(Base):
    __tablename__ = "bins"

    id = Column(Integer, primary_key=True, index=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    title = Column(String(255), nullable=False, index=True)
    fill = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint('fill >= 0 AND fill <= 100', name='check_fill_range'),
    )