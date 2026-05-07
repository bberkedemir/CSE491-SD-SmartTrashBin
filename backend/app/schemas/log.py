from pydantic import BaseModel
from datetime import datetime

class LogBase(BaseModel):
    action: str
    bin_id: int | None = None
    fill_before: int | None = None
    fill_after: int | None = None
    notes: str | None = None
    performed_by: str | None = None

class LogCreate(LogBase):
    pass

class Log(LogBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class LogList(BaseModel):
    logs: list[Log]
    total: int