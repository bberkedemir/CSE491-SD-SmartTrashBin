from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class RouteStop(BaseModel):
    sequence: int
    id: int
    title: str
    lat: float
    lng: float
    fill_level: int
    type: str  # 'pickup', 'start', 'end'

class RouteResponse(BaseModel):
    generated_at: datetime
    total_stops: int
    total_distance_km: float
    estimated_time_minutes: float
    route_sequence: List[RouteStop]
    route_geometry: List[List[float]] = []
    route_geometry: List[List[float]] = []
