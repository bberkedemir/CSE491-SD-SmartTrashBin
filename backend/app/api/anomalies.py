from datetime import datetime
from pathlib import Path
import re

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.auth_dependency import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.anomaly_upload import AnomalyUpload
from app.models.road_anomaly import RoadAnomaly
from app.models.user import User
from app.schemas.anomaly import AnomalyUploadList, AnomalyUploadResponse, RoadAnomalyList
from app.services.anomaly_analysis import analyze_upload


router = APIRouter()

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def get_upload_root() -> Path:
    configured = Path(settings.ANOMALY_UPLOAD_DIR)
    if configured.is_absolute():
        return configured
    return BACKEND_ROOT / configured


def safe_session_id(session_id: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_.-]", "_", session_id.strip())
    return cleaned[:80]


def parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid datetime value: {value}",
        ) from exc


async def save_upload_file(upload_file: UploadFile, destination: Path) -> int:
    destination.parent.mkdir(parents=True, exist_ok=True)
    total_bytes = 0
    with destination.open("wb") as output:
        while True:
            chunk = await upload_file.read(1024 * 1024)
            if not chunk:
                break
            total_bytes += len(chunk)
            output.write(chunk)
    await upload_file.close()
    return total_bytes


def video_suffix(filename: str | None) -> str:
    suffix = Path(filename or "").suffix.lower()
    if suffix in {".mp4", ".mov", ".m4v", ".webm"}:
        return suffix
    return ".mp4"


@router.post("/uploads", response_model=AnomalyUploadResponse, status_code=status.HTTP_201_CREATED)
async def create_anomaly_upload(
    background_tasks: BackgroundTasks,
    session_id: str = Form(...),
    started_at: str | None = Form(None),
    ended_at: str | None = Form(None),
    point_count: int = Form(0),
    duration_seconds: int = Form(0),
    video: UploadFile = File(...),
    gps_log: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cleaned_session_id = safe_session_id(session_id)
    if not cleaned_session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    existing = db.query(AnomalyUpload).filter(AnomalyUpload.session_id == cleaned_session_id).first()
    if existing and existing.driver_id != current_user.id:
        raise HTTPException(status_code=409, detail="session_id already exists")

    upload_dir = get_upload_root() / f"driver_{current_user.id}" / cleaned_session_id
    video_path = upload_dir / f"video{video_suffix(video.filename)}"
    gps_path = upload_dir / "gps-log.json"

    video_bytes = await save_upload_file(video, video_path)
    gps_bytes = await save_upload_file(gps_log, gps_path)
    if video_bytes == 0 or gps_bytes == 0:
        raise HTTPException(status_code=400, detail="video and gps_log files must not be empty")

    upload = existing or AnomalyUpload(session_id=cleaned_session_id, driver_id=current_user.id)
    upload.status = "analysis_pending"
    upload.video_path = str(video_path)
    upload.gps_log_path = str(gps_path)
    upload.point_count = max(point_count, 0)
    upload.duration_seconds = max(duration_seconds, 0)
    upload.started_at = parse_iso_datetime(started_at)
    upload.ended_at = parse_iso_datetime(ended_at)

    if not existing:
        db.add(upload)
    db.commit()
    db.refresh(upload)
    background_tasks.add_task(analyze_upload, upload.id)
    return upload


@router.get("/uploads", response_model=AnomalyUploadList)
def list_anomaly_uploads(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(AnomalyUpload).filter(AnomalyUpload.driver_id == current_user.id)
    uploads = query.order_by(desc(AnomalyUpload.created_at)).offset(skip).limit(limit).all()
    return AnomalyUploadList(uploads=uploads, total=query.count())


@router.post("/uploads/{upload_id}/analyze", response_model=AnomalyUploadResponse)
def queue_upload_analysis(
    upload_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    upload = db.query(AnomalyUpload).filter(AnomalyUpload.id == upload_id).first()
    if not upload or upload.driver_id != current_user.id:
        raise HTTPException(status_code=404, detail="Upload not found")

    if upload.status != "analysis_running":
        upload.status = "analysis_pending"
        db.commit()
        db.refresh(upload)
        background_tasks.add_task(analyze_upload, upload.id)
    return upload


@router.get("/uploads/{upload_id}/anomalies", response_model=RoadAnomalyList)
def list_upload_anomalies(
    upload_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    upload = db.query(AnomalyUpload).filter(AnomalyUpload.id == upload_id).first()
    if not upload or upload.driver_id != current_user.id:
        raise HTTPException(status_code=404, detail="Upload not found")

    query = db.query(RoadAnomaly).filter(RoadAnomaly.upload_id == upload_id)
    anomalies = query.order_by(RoadAnomaly.timestamp_seconds.asc()).offset(skip).limit(limit).all()
    return RoadAnomalyList(anomalies=anomalies, total=query.count())
