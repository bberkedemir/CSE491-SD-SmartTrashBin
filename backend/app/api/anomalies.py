from datetime import datetime
from pathlib import Path, PurePosixPath
import re
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.auth_dependency import get_current_admin_user, get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.anomaly_upload import AnomalyUpload
from app.models.road_anomaly import RoadAnomaly
from app.models.user import User
from app.schemas.anomaly import (
    AnomalyImportItem,
    AnomalyImportRequest,
    AnomalyImportResponse,
    AnomalyUploadList,
    AnomalyUploadResponse,
    RoadAnomalyList,
    RoadAnomalyResponse,
)
from app.services.anomaly_analysis import analyze_upload, import_existing_analysis


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


def safe_import_relative_path(filename: str | None) -> Path:
    normalized = (filename or "file").replace("\\", "/")
    parts: list[str] = []
    for part in PurePosixPath(normalized).parts:
        if part in {"", ".", ".."}:
            continue
        cleaned = re.sub(r"[^A-Za-z0-9_. -]", "_", part.strip()).strip()
        parts.append((cleaned or "file")[:120])
    return Path(*parts) if parts else Path("file")


def is_relevant_import_file(relative_path: Path) -> bool:
    path_text = relative_path.as_posix().lower()
    suffix = relative_path.suffix.lower()
    if path_text.endswith("detections_report.csv"):
        return True
    if "gps" in path_text and suffix in {".json", ".csv"}:
        return True
    if "extracted_anomalies" in path_text and suffix in {".jpg", ".jpeg", ".png", ".webp"}:
        return True
    return False


def video_suffix(filename: str | None) -> str:
    suffix = Path(filename or "").suffix.lower()
    if suffix in {".mp4", ".mov", ".m4v", ".webm"}:
        return suffix
    return ".mp4"


def anomaly_image_url(image_path: str) -> str | None:
    uploads_root = BACKEND_ROOT / "uploads"
    path = Path(image_path)
    try:
        relative = path.relative_to(uploads_root)
    except ValueError:
        return None
    return f"/uploads/{relative.as_posix()}"


def driver_response_fields(driver: User | None) -> dict[str, str | None]:
    if driver is None:
        return {
            "driver_username": None,
            "driver_full_name": None,
            "driver_email": None,
        }
    return {
        "driver_username": driver.username,
        "driver_full_name": driver.full_name,
        "driver_email": driver.email,
    }


def driver_map_for_anomalies(db: Session, anomalies: list[RoadAnomaly]) -> dict[int, User]:
    driver_ids = {anomaly.driver_id for anomaly in anomalies if anomaly.driver_id is not None}
    if not driver_ids:
        return {}
    return {
        driver.id: driver
        for driver in db.query(User).filter(User.id.in_(driver_ids)).all()
    }


def to_road_anomaly_response(anomaly: RoadAnomaly, driver: User | None = None) -> RoadAnomalyResponse:
    return RoadAnomalyResponse.model_validate(anomaly).model_copy(
        update={
            "image_url": anomaly_image_url(anomaly.image_path),
            **driver_response_fields(driver),
        }
    )


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


@router.post("/import-existing", response_model=AnomalyImportResponse, status_code=status.HTTP_201_CREATED)
def import_existing_anomaly_outputs(
    payload: AnomalyImportRequest,
    _current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        results = import_existing_analysis(
            db=db,
            source_path=payload.source_path,
            driver_id=payload.driver_id,
            session_id=payload.session_id,
            copy_images=payload.copy_images,
        )
    except FileNotFoundError as exc:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Could not import files: {exc}") from exc

    total_imported = sum(result.imported_count for result in results)
    total_skipped = sum(result.skipped_count for result in results)
    return AnomalyImportResponse(
        imports=[
            AnomalyImportItem(
                upload=AnomalyUploadResponse.model_validate(result.upload),
                imported_count=result.imported_count,
                skipped_count=result.skipped_count,
                source_report_path=result.source_report_path,
            )
            for result in results
        ],
        total_imported=total_imported,
        total_skipped=total_skipped,
        message=f"Imported {total_imported} anomalies from {len(results)} report(s).",
    )


@router.post("/import-folder", response_model=AnomalyImportResponse, status_code=status.HTTP_201_CREATED)
async def import_existing_anomaly_folder(
    files: list[UploadFile] = File(...),
    relative_paths: list[str] = Form([]),
    driver_id: int | None = Form(None),
    session_id: str | None = Form(None),
    copy_images: bool = Form(True),
    _current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    staging_dir = BACKEND_ROOT / "uploads" / "anomaly_import_staging" / f"import_{uuid4().hex}"
    saved_count = 0

    for index, upload_file in enumerate(files):
        submitted_path = relative_paths[index] if index < len(relative_paths) and relative_paths[index] else upload_file.filename
        relative_path = safe_import_relative_path(submitted_path)
        if not is_relevant_import_file(relative_path):
            await upload_file.close()
            continue

        destination = staging_dir / relative_path
        written_bytes = await save_upload_file(upload_file, destination)
        if written_bytes > 0:
            saved_count += 1

    if saved_count == 0:
        raise HTTPException(
            status_code=400,
            detail="No importable files found. Select a folder containing detections_report.csv, GPS logs, and extracted anomaly images.",
        )

    try:
        results = import_existing_analysis(
            db=db,
            source_path=str(staging_dir),
            driver_id=driver_id,
            session_id=session_id,
            copy_images=copy_images,
        )
    except FileNotFoundError as exc:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Could not import files: {exc}") from exc

    total_imported = sum(result.imported_count for result in results)
    total_skipped = sum(result.skipped_count for result in results)
    return AnomalyImportResponse(
        imports=[
            AnomalyImportItem(
                upload=AnomalyUploadResponse.model_validate(result.upload),
                imported_count=result.imported_count,
                skipped_count=result.skipped_count,
                source_report_path=result.source_report_path,
            )
            for result in results
        ],
        total_imported=total_imported,
        total_skipped=total_skipped,
        message=f"Imported {total_imported} anomalies from {len(results)} selected folder report(s).",
    )


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
    drivers = driver_map_for_anomalies(db, anomalies)
    return RoadAnomalyList(
        anomalies=[
            to_road_anomaly_response(anomaly, drivers.get(anomaly.driver_id))
            for anomaly in anomalies
        ],
        total=query.count(),
    )


@router.get("/map", response_model=RoadAnomalyList)
def list_map_anomalies(
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(RoadAnomaly).filter(
        RoadAnomaly.latitude.isnot(None),
        RoadAnomaly.longitude.isnot(None),
    )
    user_role = str(current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    if user_role != "admin":
        query = query.filter(RoadAnomaly.driver_id == current_user.id)

    anomalies = query.order_by(desc(RoadAnomaly.created_at)).offset(skip).limit(limit).all()
    drivers = driver_map_for_anomalies(db, anomalies)
    return RoadAnomalyList(
        anomalies=[
            to_road_anomaly_response(anomaly, drivers.get(anomaly.driver_id))
            for anomaly in anomalies
        ],
        total=query.count(),
    )
