from pydantic import BaseModel, Field
from typing import Optional
from app.models.truck import TruckStatus
from app.schemas.user import UserResponse


class TruckBase(BaseModel):
    license_plate: str = Field(..., max_length=20)
    model: str = Field(..., max_length=100)
    capacity_bins: Optional[int] = Field(None, ge=1)
    status: TruckStatus = TruckStatus.AVAILABLE


class TruckCreate(TruckBase):
    assigned_driver_id: Optional[int] = None


class TruckUpdate(BaseModel):
    license_plate: Optional[str] = Field(None, max_length=20)
    model: Optional[str] = Field(None, max_length=100)
    capacity_bins: Optional[int] = Field(None, ge=1)
    status: Optional[TruckStatus] = None
    assigned_driver_id: Optional[int] = None


class TruckResponse(TruckBase):
    id: int
    assigned_driver_id: Optional[int] = None
    assigned_driver: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class TruckAssignRequest(BaseModel):
    driver_id: Optional[int] = None
