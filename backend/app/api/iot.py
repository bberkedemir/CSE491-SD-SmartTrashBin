from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.core.database import get_db
from app.core.config import settings
from app.crud.bin import bin_crud
from app.schemas.bin import BinUpdate
from app.schemas.log import LogCreate
from app.crud.log import LogCRUD

router = APIRouter()


class IoTFillUpdate(BaseModel):
    fill: int = Field(..., ge=0, le=100, description="Fill percentage (0-100)")


@router.put("/bins/{bin_id}/fill")
def update_bin_fill(
    bin_id: int,
    data: IoTFillUpdate,
    api_key: str = Query(..., description="IoT device API key"),
    db: Session = Depends(get_db)
):
    """
    IoT endpoint for ESP32 to update bin fill level.
    Uses a simple API key instead of JWT for microcontroller compatibility.
    """
    # 1. Verify API key
    if api_key != settings.IOT_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    # 2. Find the bin
    existing = bin_crud.get(db, bin_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Bin not found")

    # 3. Update fill level
    fill_before = existing.fill
    updated_bin = bin_crud.update(db, bin_id, BinUpdate(fill=data.fill))

    # 4. Log the update
    if fill_before != data.fill:
        LogCRUD.create_log(db, LogCreate(
            action="iot_update",
            bin_id=updated_bin.id,
            fill_before=fill_before,
            fill_after=updated_bin.fill,
            notes=f"IoT sensor update: {fill_before}% → {updated_bin.fill}%"
        ))

    return {
        "bin_id": updated_bin.id,
        "title": updated_bin.title,
        "fill": updated_bin.fill,
        "updated_at": str(updated_bin.updated_at)
    }
