from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.log import Log, LogBase, LogCreate, LogList
from app.crud.log import LogCRUD
from app.models.log import CollectionLog


router = APIRouter()

@router.get("/", response_model=LogList)
def get_logs(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get all logs"""
    logs = LogCRUD.get_logs(db, skip, limit)
    total = db.query(CollectionLog).count()
    return LogList(logs=logs, total=total)


class RouteCompletedRequest(BaseModel):
    stops_total: int
    collected: int
    skipped: int
    distance_km: float
    estimated_minutes: int
    elapsed_seconds: int


@router.post("/route-completed", response_model=Log, status_code=201)
def log_route_completed(payload: RouteCompletedRequest, db: Session = Depends(get_db)):
    """Log a completed route trip as a single aggregated entry."""
    notes = (
        f"stops={payload.stops_total}|collected={payload.collected}|"
        f"skipped={payload.skipped}|distance_km={payload.distance_km:.2f}|"
        f"est_min={payload.estimated_minutes}|elapsed_sec={payload.elapsed_seconds}"
    )
    return LogCRUD.create_log(db, LogCreate(
        action="route_completed",
        bin_id=None,
        notes=notes,
    ))