from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
<<<<<<< HEAD
from app.services.route_optimizer import RouteOptimizerService
from app.schemas.route import RouteResponse
from app.services.route_optimizer_2nd import RouteOptimizerService2nd
=======
from app.services.greedy_travelling_salesman import GreedyTravellingSalesmanService
from app.services.travelling_salesman_with_segment_shifting import SegmentShiftingService
from app.schemas.route import RouteResponse
from app.core.auth_dependency import get_current_user
from app.models.user import User
>>>>>>> origin/main


router = APIRouter()

@router.get("/optimize", response_model=RouteResponse)
def get_optimized_route(
    start_lat: float = Query(..., description="Truck's starting latitude"),
    start_lng: float = Query(..., description="Truck's starting longitude"),
    threshold: int = Query(75, ge=0, le=100, description="Fill level threshold percentage"),
<<<<<<< HEAD
    db: Session = Depends(get_db)
):
    """
    Generate an optimized collection route based on bin fill levels from a dynamic starting position.
    """
    try:
        route = RouteOptimizerService.optimize_route(db, threshold, start_lat, start_lng)
=======
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Algorithm 2: Nearest Neighbor + 2-opt + Or-Opt. (DEFAULT)
    Generate an optimized collection route based on bin fill levels from a dynamic starting position.
    """
    try:
        route = SegmentShiftingService.optimize_route(db, threshold, start_lat, start_lng)
>>>>>>> origin/main
        return route
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

<<<<<<< HEAD
@router.get("/optimize-2nd", response_model=RouteResponse)
def get_optimized_route_2nd(
    threshold: int = Query(75, ge=0, le=100, description="Fill level threshold percentage"),
    db: Session = Depends(get_db)
):
    try:
        route = RouteOptimizerService2nd.optimize_route(db, threshold)
=======
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
        route = GreedyTravellingSalesmanService.optimize_route(db, threshold, start_lat, start_lng)
>>>>>>> origin/main
        return route
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
