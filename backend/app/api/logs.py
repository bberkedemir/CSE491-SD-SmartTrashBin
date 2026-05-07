import json
from typing import List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.schemas.log import Log, LogCreate, LogList
from app.crud.log import LogCRUD
from app.models.log import CollectionLog


router = APIRouter()


@router.get("/", response_model=LogList)
def get_logs(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    logs = LogCRUD.get_logs(db, skip, limit)
    total = db.query(CollectionLog).count()
    return LogList(logs=logs, total=total)


class BinEntry(BaseModel):
    id: int
    title: str
    fill_level: int


class RouteCompletedRequest(BaseModel):
    stops_total: int
    collected: int
    skipped: int
    distance_km: float
    estimated_minutes: int
    elapsed_seconds: int
    collected_bins: Optional[List[BinEntry]] = None
    skipped_bins: Optional[List[BinEntry]] = None


@router.post("/route-completed", response_model=Log, status_code=201)
def log_route_completed(
    payload: RouteCompletedRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stats = (
        f"stops={payload.stops_total}|collected={payload.collected}|"
        f"skipped={payload.skipped}|distance_km={payload.distance_km:.2f}|"
        f"est_min={payload.estimated_minutes}|elapsed_sec={payload.elapsed_seconds}"
    )
    bins_json = json.dumps({
        "collected": [b.model_dump() for b in (payload.collected_bins or [])],
        "skipped":   [b.model_dump() for b in (payload.skipped_bins or [])],
    })
    notes = f"{stats}||{bins_json}"
    return LogCRUD.create_log(db, LogCreate(
        action="route_completed",
        bin_id=None,
        notes=notes,
        performed_by=current_user.username,
    ))
