from __future__ import annotations

import csv
import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.anomaly_upload import AnomalyUpload
from app.models.road_anomaly import RoadAnomaly


REPO_ROOT = Path(__file__).resolve().parents[3]


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
