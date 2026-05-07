from __future__ import annotations

import csv
import json
import os
import re
import shutil
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.anomaly_upload import AnomalyUpload
from app.models.road_anomaly import RoadAnomaly
from app.models.user import User


REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = Path(__file__).resolve().parents[2]
STATIC_UPLOADS_ROOT = BACKEND_ROOT / "uploads"


@dataclass(frozen=True)
class GpsPoint:
    timestamp: datetime
    latitude: float
    longitude: float


@dataclass(frozen=True)
class DetectionRecord:
    class_name: str
    track_id: int
    confidence: float
    timestamp_seconds: float
    image_path: str


@dataclass(frozen=True)
class ImportResult:
    upload: AnomalyUpload
    imported_count: int
    skipped_count: int
    source_report_path: str


def resolve_repo_path(value: str) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path
    return REPO_ROOT / path


def parse_datetime(value: str | datetime | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def safe_name(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]", "_", value.strip()).strip("_") or "unknown"


def normalized_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def row_value(row: dict[str, Any], *names: str) -> str | None:
    normalized = {normalized_key(key): value for key, value in row.items()}
    for name in names:
        value = normalized.get(normalized_key(name))
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def read_gps_rows(gps_path: Path) -> list[dict[str, Any]]:
    if gps_path.suffix.lower() == ".csv":
        with gps_path.open(newline="", encoding="utf-8") as file:
            return list(csv.DictReader(file))

    with gps_path.open(encoding="utf-8") as file:
        data = json.load(file)

    if isinstance(data, dict):
        points = data.get("points", [])
    else:
        points = data
    if not isinstance(points, list):
        return []
    return [point for point in points if isinstance(point, dict)]


def load_gps_points(gps_path: str) -> list[GpsPoint]:
    points: list[GpsPoint] = []
    for row in read_gps_rows(Path(gps_path)):
        timestamp = row.get("timestamp") or row.get("time") or row.get("created_at")
        latitude = row.get("latitude", row.get("lat"))
        longitude = row.get("longitude", row.get("lng", row.get("lon")))
        if timestamp is None or latitude is None or longitude is None:
            continue
        try:
            parsed_timestamp = parse_datetime(str(timestamp))
            if parsed_timestamp is None:
                continue
            points.append(
                GpsPoint(
                    timestamp=parsed_timestamp,
                    latitude=float(latitude),
                    longitude=float(longitude),
                )
            )
        except (TypeError, ValueError):
            continue
    return sorted(points, key=lambda point: point.timestamp)


def interpolate_location(
    gps_points: list[GpsPoint],
    started_at: datetime | None,
    timestamp_seconds: float,
) -> tuple[float, float] | None:
    if not gps_points:
        return None

    base_time = parse_datetime(started_at) or gps_points[0].timestamp
    target_time = base_time + timedelta(seconds=timestamp_seconds)

    if target_time <= gps_points[0].timestamp:
        first = gps_points[0]
        return first.latitude, first.longitude

    if target_time >= gps_points[-1].timestamp:
        last = gps_points[-1]
        return last.latitude, last.longitude

    for index in range(1, len(gps_points)):
        previous = gps_points[index - 1]
        current = gps_points[index]
        if target_time > current.timestamp:
            continue

        span_seconds = (current.timestamp - previous.timestamp).total_seconds()
        if span_seconds <= 0:
            return current.latitude, current.longitude

        ratio = (target_time - previous.timestamp).total_seconds() / span_seconds
        latitude = previous.latitude + (current.latitude - previous.latitude) * ratio
        longitude = previous.longitude + (current.longitude - previous.longitude) * ratio
        return latitude, longitude

    fallback = gps_points[-1]
    return fallback.latitude, fallback.longitude


def resolve_import_source(source_path: str) -> Path:
    cleaned = source_path.strip().strip('"').strip("'")
    if not cleaned:
        raise ValueError("Source path is required")

    path = Path(cleaned).expanduser()
    candidates = [path] if path.is_absolute() else [
        REPO_ROOT / path,
        BACKEND_ROOT / path,
        Path.cwd() / path,
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()

    raise FileNotFoundError(f"Import source not found: {source_path}")


def find_detection_reports(source: Path) -> list[Path]:
    if source.is_file():
        if source.name.lower() != "detections_report.csv":
            raise ValueError("Import file must be named detections_report.csv")
        return [source]

    reports = sorted(source.rglob("detections_report.csv"))
    if not reports:
        raise FileNotFoundError("No detections_report.csv found under the selected folder")
    return reports


def session_dir_for_report(report_path: Path) -> Path:
    if report_path.parent.name == "detected_output":
        analysis_dir = report_path.parent.parent
        if analysis_dir.name == "analysis":
            return analysis_dir.parent
        return report_path.parent.parent
    return report_path.parent


def find_first_matching_file(root: Path, patterns: tuple[str, ...]) -> Path | None:
    for pattern in patterns:
        direct = sorted(root.glob(pattern))
        if direct:
            return direct[0]
    for pattern in patterns:
        recursive = sorted(root.rglob(pattern))
        if recursive:
            return recursive[0]
    return None


def find_gps_path(session_dir: Path) -> Path | None:
    return find_first_matching_file(
        session_dir,
        ("gps-log.json", "gps_log.json", "gps*.json", "gps-log.csv", "gps_log.csv", "gps*.csv"),
    )


def find_video_path(session_dir: Path) -> Path | None:
    return find_first_matching_file(
        session_dir,
        ("video.mp4", "video.mov", "video.m4v", "video.webm", "*.mp4", "*.mov", "*.m4v", "*.webm"),
    )


def read_gps_metadata(gps_path: Path | None) -> dict[str, Any]:
    if gps_path is None or gps_path.suffix.lower() != ".json":
        return {}

    try:
        with gps_path.open(encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError):
        return {}

    return data if isinstance(data, dict) else {}


def infer_session_id(session_dir: Path, gps_metadata: dict[str, Any]) -> str:
    gps_session_id = gps_metadata.get("sessionId") or gps_metadata.get("session_id")
    if gps_session_id:
        return safe_name(str(gps_session_id))
    return safe_name(session_dir.name)


def infer_driver_id_from_path(path: Path) -> int | None:
    for part in path.parts:
        match = re.fullmatch(r"driver[_-](\d+)", part, flags=re.IGNORECASE)
        if match:
            return int(match.group(1))
    return None


def resolve_driver_id(db, requested_driver_id: int | None, source_path: Path) -> int | None:
    if requested_driver_id is not None:
        if db.query(User).filter(User.id == requested_driver_id).first() is None:
            raise ValueError(f"Driver #{requested_driver_id} was not found")
        return requested_driver_id

    inferred_driver_id = infer_driver_id_from_path(source_path)
    if inferred_driver_id is None:
        return None
    if db.query(User).filter(User.id == inferred_driver_id).first() is None:
        return None
    return inferred_driver_id


def parse_detection_report(report_path: Path) -> tuple[list[DetectionRecord], int]:
    detections: list[DetectionRecord] = []
    skipped_count = 0

    with report_path.open(newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            class_name = row_value(row, "Class Name", "class_name", "class")
            track_id = row_value(row, "Track ID", "track_id", "track")
            confidence = row_value(row, "Max Confidence", "confidence", "conf")
            timestamp = row_value(row, "Timestamp (s)", "timestamp_seconds", "timestamp")
            image_path = row_value(row, "Saved Image Path", "image_path", "saved_image_path")

            if not all([class_name, track_id, confidence, timestamp, image_path]):
                skipped_count += 1
                continue

            try:
                confidence_value = float(confidence)
                if confidence_value > 1:
                    confidence_value = confidence_value / 100
                detections.append(
                    DetectionRecord(
                        class_name=str(class_name),
                        track_id=int(float(track_id)),
                        confidence=confidence_value,
                        timestamp_seconds=float(timestamp),
                        image_path=str(image_path),
                    )
                )
            except (TypeError, ValueError):
                skipped_count += 1

    return detections, skipped_count


def resolve_saved_image_path(saved_image_path: str, report_path: Path, session_dir: Path, source_root: Path) -> Path | None:
    raw_path = Path(saved_image_path)
    if raw_path.is_absolute() and raw_path.exists():
        return raw_path.resolve()

    candidates = [
        session_dir / raw_path,
        source_root / raw_path,
        session_dir.parent / raw_path,
        report_path.parent / raw_path,
        REPO_ROOT / raw_path,
        REPO_ROOT / "road-anomaly-detection" / raw_path,
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()

    file_name = raw_path.name
    if file_name:
        for root in (session_dir, source_root):
            matches = sorted(root.rglob(file_name))
            if matches:
                return matches[0].resolve()

    return None


def image_is_served_by_backend(image_path: Path) -> bool:
    try:
        image_path.resolve().relative_to(STATIC_UPLOADS_ROOT.resolve())
        return True
    except ValueError:
        return False


def served_image_path(
    source_image: Path,
    session_id: str,
    driver_id: int | None,
    class_name: str,
    copy_images: bool,
) -> str:
    if image_is_served_by_backend(source_image) or not copy_images:
        return str(source_image)

    driver_folder = f"driver_{driver_id}" if driver_id is not None else "driver_unknown"
    destination = (
        STATIC_UPLOADS_ROOT
        / "imported_anomaly_sessions"
        / driver_folder
        / safe_name(session_id)
        / "analysis"
        / "extracted_anomalies"
        / safe_name(class_name)
        / source_image.name
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source_image.resolve() != destination.resolve():
        shutil.copy2(source_image, destination)
    return str(destination)


def upload_times_from_metadata(gps_metadata: dict[str, Any]) -> tuple[datetime | None, datetime | None]:
    started_at = gps_metadata.get("startedAt") or gps_metadata.get("started_at")
    ended_at = gps_metadata.get("endedAt") or gps_metadata.get("ended_at")
    return parse_datetime(started_at), parse_datetime(ended_at)


def duration_from_metadata(
    gps_metadata: dict[str, Any],
    started_at: datetime | None,
    ended_at: datetime | None,
    detections: list[DetectionRecord],
) -> int:
    explicit_duration = gps_metadata.get("durationSeconds") or gps_metadata.get("duration_seconds")
    if explicit_duration is not None:
        try:
            return max(0, int(float(explicit_duration)))
        except (TypeError, ValueError):
            pass

    if started_at is not None and ended_at is not None:
        return max(0, int((ended_at - started_at).total_seconds()))

    if detections:
        return max(0, int(max(detection.timestamp_seconds for detection in detections)))
    return 0


def import_existing_analysis(
    db,
    source_path: str,
    driver_id: int | None = None,
    session_id: str | None = None,
    copy_images: bool = True,
) -> list[ImportResult]:
    source = resolve_import_source(source_path)
    source_root = source.parent if source.is_file() else source
    reports = find_detection_reports(source)
    if session_id and len(reports) > 1:
        raise ValueError("A custom session_id can only be used when importing one detections_report.csv")

    results: list[ImportResult] = []
    for report_path in reports:
        session_dir = session_dir_for_report(report_path)
        gps_path = find_gps_path(session_dir)
        video_path = find_video_path(session_dir)
        gps_metadata = read_gps_metadata(gps_path)
        resolved_session_id = safe_name(session_id) if session_id else infer_session_id(session_dir, gps_metadata)
        resolved_driver_id = resolve_driver_id(db, driver_id, session_dir)
        detections, skipped_count = parse_detection_report(report_path)
        gps_points = load_gps_points(str(gps_path)) if gps_path else []
        started_at, ended_at = upload_times_from_metadata(gps_metadata)

        existing = db.query(AnomalyUpload).filter(AnomalyUpload.session_id == resolved_session_id).first()
        upload = existing or AnomalyUpload(session_id=resolved_session_id)
        upload.driver_id = resolved_driver_id
        upload.status = "analysis_complete"
        upload.video_path = str(video_path or report_path)
        upload.gps_log_path = str(gps_path or report_path)
        upload.point_count = int(gps_metadata.get("pointCount") or gps_metadata.get("point_count") or len(gps_points))
        upload.duration_seconds = duration_from_metadata(gps_metadata, started_at, ended_at, detections)
        upload.started_at = started_at
        upload.ended_at = ended_at

        if not existing:
            db.add(upload)
        db.flush()

        db.query(RoadAnomaly).filter(RoadAnomaly.upload_id == upload.id).delete()
        imported_count = 0
        for detection in detections:
            resolved_image = resolve_saved_image_path(detection.image_path, report_path, session_dir, source_root)
            if resolved_image is None:
                skipped_count += 1
                continue

            stored_image_path = served_image_path(
                resolved_image,
                resolved_session_id,
                resolved_driver_id,
                detection.class_name,
                copy_images,
            )
            location = interpolate_location(gps_points, started_at, detection.timestamp_seconds)
            db.add(
                RoadAnomaly(
                    upload_id=upload.id,
                    driver_id=resolved_driver_id,
                    class_name=detection.class_name,
                    track_id=detection.track_id,
                    confidence=detection.confidence,
                    timestamp_seconds=detection.timestamp_seconds,
                    image_path=stored_image_path,
                    latitude=location[0] if location else None,
                    longitude=location[1] if location else None,
                )
            )
            imported_count += 1

        results.append(
            ImportResult(
                upload=upload,
                imported_count=imported_count,
                skipped_count=skipped_count,
                source_report_path=str(report_path),
            )
        )

    db.commit()
    for result in results:
        db.refresh(result.upload)
    return results


def run_tracking_analysis(video_path: str, output_dir: Path) -> list[DetectionRecord]:
    output_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("YOLO_CONFIG_DIR", str(output_dir / "ultralytics_settings"))

    try:
        import cv2
        from ultralytics import YOLO
    except ImportError as exc:
        raise RuntimeError(
            "Road anomaly analysis requires opencv-python-headless and ultralytics. "
            "Install backend requirements before running analysis."
        ) from exc

    model_path = resolve_repo_path(settings.ANOMALY_MODEL_PATH)
    if not model_path.exists():
        raise FileNotFoundError(f"YOLO model not found at {model_path}")

    extract_dir = output_dir / "extracted_anomalies"
    annotated_dir = output_dir / "detected_output"
    extract_dir.mkdir(parents=True, exist_ok=True)
    annotated_dir.mkdir(parents=True, exist_ok=True)

    model = YOLO(str(model_path))
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open uploaded video: {video_path}")

    fps = capture.get(cv2.CAP_PROP_FPS) or 30
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    video_name = Path(video_path).stem

    writer = None
    if settings.ANOMALY_SAVE_ANNOTATED_VIDEO and width > 0 and height > 0:
        annotated_path = annotated_dir / f"{video_name}_tracked.mp4"
        writer = cv2.VideoWriter(
            str(annotated_path),
            cv2.VideoWriter_fourcc(*"mp4v"),
            fps,
            (width, height),
        )

    best_records: dict[int, DetectionRecord] = {}
    frame_index = 0

    while True:
        ok, frame = capture.read()
        if not ok:
            break

        timestamp_seconds = capture.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
        if timestamp_seconds <= 0 and fps > 0:
            timestamp_seconds = frame_index / fps

        annotated_frame = frame
        results = model.track(
            frame,
            persist=True,
            tracker="bytetrack.yaml",
            conf=settings.ANOMALY_CONFIDENCE_THRESHOLD,
            verbose=False,
        )

        for result in results:
            annotated_frame = result.plot()
            for box in result.boxes:
                if box.id is None:
                    continue

                track_id = int(box.id[0])
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                class_name = str(model.names[class_id])

                current_best = best_records.get(track_id)
                if current_best and confidence <= current_best.confidence:
                    continue

                x1, y1, x2, y2 = map(int, box.xyxy[0])
                frame_height, frame_width, _ = frame.shape
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(frame_width, x2), min(frame_height, y2)
                crop = frame[y1:y2, x1:x2]
                if crop.size == 0:
                    continue

                class_dir = extract_dir / safe_name(class_name)
                class_dir.mkdir(parents=True, exist_ok=True)
                image_path = class_dir / f"{video_name}_{safe_name(class_name)}_id_{track_id}.jpg"
                cv2.imwrite(str(image_path), crop)

                best_records[track_id] = DetectionRecord(
                    class_name=class_name,
                    track_id=track_id,
                    confidence=confidence,
                    timestamp_seconds=timestamp_seconds,
                    image_path=str(image_path),
                )

        if writer is not None:
            writer.write(annotated_frame)
        frame_index += 1

    capture.release()
    if writer is not None:
        writer.release()

    csv_path = annotated_dir / "detections_report.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as file:
        writer_csv = csv.writer(file)
        writer_csv.writerow(
            ["Video Name", "Track ID", "Class Name", "Max Confidence", "Timestamp (s)", "Saved Image Path"]
        )
        for record in sorted(best_records.values(), key=lambda item: item.track_id):
            writer_csv.writerow(
                [
                    video_name,
                    record.track_id,
                    record.class_name,
                    f"{record.confidence:.2f}",
                    f"{record.timestamp_seconds:.2f}",
                    record.image_path,
                ]
            )

    return sorted(best_records.values(), key=lambda item: item.track_id)


def analyze_upload(upload_id: int) -> None:
    db = SessionLocal()
    try:
        upload = db.query(AnomalyUpload).filter(AnomalyUpload.id == upload_id).first()
        if upload is None:
            return

        upload.status = "analysis_running"
        db.commit()

        output_dir = Path(upload.video_path).parent / "analysis"
        detections = run_tracking_analysis(upload.video_path, output_dir)
        gps_points = load_gps_points(upload.gps_log_path)

        db.query(RoadAnomaly).filter(RoadAnomaly.upload_id == upload.id).delete()
        for detection in detections:
            location = interpolate_location(gps_points, upload.started_at, detection.timestamp_seconds)
            latitude = location[0] if location else None
            longitude = location[1] if location else None
            db.add(
                RoadAnomaly(
                    upload_id=upload.id,
                    driver_id=upload.driver_id,
                    class_name=detection.class_name,
                    track_id=detection.track_id,
                    confidence=detection.confidence,
                    timestamp_seconds=detection.timestamp_seconds,
                    image_path=detection.image_path,
                    latitude=latitude,
                    longitude=longitude,
                )
            )

        upload.status = "analysis_complete"
        db.commit()
    except Exception as exc:
        db.rollback()
        upload = db.query(AnomalyUpload).filter(AnomalyUpload.id == upload_id).first()
        if upload is not None:
            upload.status = "analysis_failed"
            db.commit()
        print(f"Road anomaly analysis failed for upload {upload_id}: {exc}", flush=True)
    finally:
        db.close()
