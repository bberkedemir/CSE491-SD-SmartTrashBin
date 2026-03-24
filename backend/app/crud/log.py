from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from typing import List, Optional, Dict, Any
from app.models.log import CollectionLog
from app.schemas.log import LogBase, LogCreate, Log, LogList


class LogCRUD:
    def get_logs(db, skip=0, limit=50):
        stmt = select(CollectionLog).order_by(desc(CollectionLog.created_at)).offset(skip).limit(limit)
        return db.execute(stmt).scalars().all()
    
    def get_total(db):
        return db.query(CollectionLog).count()
    
    def create_log(db, log_data: LogCreate):
        db_log = CollectionLog(**log_data.model_dump())
        db.add(db_log)
        db.commit()
        db.refresh(db_log)
        return db_log
    
