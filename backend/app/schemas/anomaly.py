from datetime import datetime
from typing import Literal

from pydantic import BaseModel


RoadAnomalyStatus = Literal["default", "needs_repair", "repaired"]


class AnomalyUploadResponse(BaseModel):
    id: int
    session_id: str
    status: str
    video_path: str
    gps_log_path: str
    point_count: int
    duration_seconds: int
    started_at: datetime | None = None
    ended_at: datetime | None = None
    created_at: datetime | None = None
    message: str = "Upload received and queued for analysis"

    class Config:
        from_attributes = True


class AnomalyUploadList(BaseModel):
    uploads: list[AnomalyUploadResponse]
    total: int


class AnomalyImportRequest(BaseModel):
    source_path: str
    driver_id: int | None = None
    session_id: str | None = None
    copy_images: bool = True


class AnomalyImportItem(BaseModel):
    upload: AnomalyUploadResponse
    imported_count: int
    skipped_count: int
    source_report_path: str


class AnomalyImportResponse(BaseModel):
    imports: list[AnomalyImportItem]
    total_imported: int
    total_skipped: int
    message: str


class RoadAnomalyResponse(BaseModel):
    id: int
    upload_id: int
    driver_id: int | None = None
    class_name: str
    track_id: int
    confidence: float
    timestamp_seconds: float
    image_path: str
    status: RoadAnomalyStatus = "default"
    image_url: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    driver_username: str | None = None
    driver_full_name: str | None = None
    driver_email: str | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class RoadAnomalyList(BaseModel):
    anomalies: list[RoadAnomalyResponse]
    total: int


class RoadAnomalyStatusUpdate(BaseModel):
    status: RoadAnomalyStatus
