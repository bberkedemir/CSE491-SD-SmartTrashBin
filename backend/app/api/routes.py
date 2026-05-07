from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.services.greedy_travelling_salesman import GreedyTravellingSalesmanService
from app.services.travelling_salesman_with_segment_shifting import SegmentShiftingService
from app.schemas.route import RouteResponse
from app.core.auth_dependency import get_current_user
from app.models.user import User
from app.crud.truck import truck_crud


router = APIRouter()


def _get_max_bins(db: Session, user: User) -> Optional[int]:
    truck = truck_crud.get_truck_for_driver(db, user.id)
    return truck.capacity_bins if truck else None

@router.get("/optimize", response_model=RouteResponse)
def get_optimized_route(
    start_lat: float = Query(..., description="Truck's starting latitude"),
    start_lng: float = Query(..., description="Truck's starting longitude"),
    threshold: int = Query(75, ge=0, le=100, description="Fill level threshold percentage"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Algorithm 2: Nearest Neighbor + 2-opt + Or-Opt. (DEFAULT)
    Generate an optimized collection route based on bin fill levels from a dynamic starting position.
    """
    try:
        max_bins = _get_max_bins(db, current_user)
        route = SegmentShiftingService.optimize_route(db, threshold, start_lat, start_lng, max_bins=max_bins)
        return route
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/optimize-greedy", response_model=RouteResponse)
def get_optimized_route_greedy(
    start_lat: float = Query(..., description="Truck's starting latitude"),
    start_lng: float = Query(..., description="Truck's starting longitude"),
    threshold: int = Query(75, ge=0, le=100, description="Fill level threshold percentage"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Algorithm 1: Nearest Neighbor (Greedy TSP).
    """
    try:
        max_bins = _get_max_bins(db, current_user)
        route = GreedyTravellingSalesmanService.optimize_route(db, threshold, start_lat, start_lng, max_bins=max_bins)
        return route
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
