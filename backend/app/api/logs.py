from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
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