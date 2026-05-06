from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class RouteStopPayload(BaseModel):
    sequence: int
    id: int
    title: str
    lat: float
    lng: float
    fill_level: int
    type: str


class StartSessionRequest(BaseModel):
    route_stops: List[RouteStopPayload]
    route_geometry: List[List[float]]
    current_lat: float
    current_lng: float


class PositionUpdateRequest(BaseModel):
    lat: float
    lng: float
    current_stop_index: int
    collected_ids: List[int]
    skipped_ids: List[int]


class CompleteSessionRequest(BaseModel):
    collected_ids: List[int]
    skipped_ids: List[int]


class ActiveSession(BaseModel):
    driver_id: int
    driver_name: str
    driver_full_name: str
    lat: float
    lng: float
    route_stops: List[RouteStopPayload]
    route_geometry: List[List[float]]
    current_stop_index: int
    collected_ids: List[int]
    skipped_ids: List[int]
    started_at: datetime
    last_update: datetime
    is_completed: bool = False


class SessionsResponse(BaseModel):
    sessions: List[ActiveSession]
    count: int


class WSMessage(BaseModel):
    event: str  # session_started | position_updated | session_completed | full_snapshot
    session: Optional[ActiveSession] = None
    sessions: Optional[List[ActiveSession]] = None
