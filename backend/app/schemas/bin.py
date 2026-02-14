from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Dict, Any


class BinBase(BaseModel):
    lat: float = Field(..., description="Latitude coordinate")
    lng: float = Field(..., description="Longitude coordinate") 
    title: str = Field(..., min_length=1, max_length=255, description="Bin title/name")
    fill: int = Field(..., ge=0, le=100, description="Fill percentage (0-100)")


class BinCreate(BinBase):
    pass


class BinUpdate(BaseModel):
    lat: float | None = Field(None, description="Latitude coordinate")
    lng: float | None = Field(None, description="Longitude coordinate")
    title: str | None = Field(None, min_length=1, max_length=255, description="Bin title/name")
    fill: int | None = Field(None, ge=0, le=100, description="Fill percentage (0-100)")


class BinInDB(BinBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Bin(BinInDB):
    pass


class BinList(BaseModel):
    bins: List[Bin]
    total: int
    page: int
    size: int


class BinBulkCreate(BaseModel):
    bins: List[BinCreate]


class BulkImportResult(BaseModel):
    success_count: int
    skipped_count: int
    errors: List[Dict[str, Any]]
    processed_bins: List[Dict[str, Any]] = []


class FileUploadResponse(BaseModel):
    message: str
    results: BulkImportResult