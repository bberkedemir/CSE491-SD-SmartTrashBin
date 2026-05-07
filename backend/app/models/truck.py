import enum
from sqlalchemy import Column, Integer, String, Enum as SQLAlchemyEnum, ForeignKey, UniqueConstraint
from app.core.database import Base


class TruckStatus(str, enum.Enum):
    AVAILABLE = "available"
    IN_SERVICE = "in_service"
    MAINTENANCE = "maintenance"


class Truck(Base):
    __tablename__ = "trucks"

    id = Column(Integer, primary_key=True, index=True)
    license_plate = Column(String(20), unique=True, nullable=False, index=True)
    model = Column(String(100), nullable=False)
    capacity_bins = Column(Integer, nullable=True)
    status = Column(SQLAlchemyEnum(TruckStatus), default=TruckStatus.AVAILABLE, nullable=False)
    assigned_driver_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
