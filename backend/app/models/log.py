from sqlalchemy import Column, Integer, Float, String, DateTime, CheckConstraint, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class CollectionLog(Base):
    __tablename__ = "collection_logs"

    id = Column(Integer, primary_key=True, index=True)
    bin_id = Column(Integer, ForeignKey("bins.id", ondelete="SET NULL"), nullable=True)
    action = Column(String)
    fill_before = Column(Integer, nullable=True)
    fill_after = Column(Integer, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


