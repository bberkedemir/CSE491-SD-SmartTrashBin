from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.core.database import Base


class RoadAnomaly(Base):
    __tablename__ = "road_anomalies"

    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(Integer, ForeignKey("anomaly_uploads.id", ondelete="CASCADE"), nullable=False, index=True)
    driver_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    class_name = Column(String, nullable=False, index=True)
    track_id = Column(Integer, nullable=False)
    confidence = Column(Float, nullable=False)
    timestamp_seconds = Column(Float, nullable=False)
    image_path = Column(String, nullable=False)
    status = Column(String, nullable=False, default="default")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
