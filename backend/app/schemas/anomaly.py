from datetime import datetime

from pydantic import BaseModel


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


class RoadAnomalyResponse(BaseModel):
    id: int
    upload_id: int
    driver_id: int | None = None
    class_name: str
    track_id: int
    confidence: float
    timestamp_seconds: float
    image_path: str
    latitude: float | None = None
    longitude: float | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class RoadAnomalyList(BaseModel):
    anomalies: list[RoadAnomalyResponse]
    total: int
