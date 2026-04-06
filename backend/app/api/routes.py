from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.route_optimizer import RouteOptimizerService
from app.schemas.route import RouteResponse
from app.services.route_optimizer_2nd import RouteOptimizerService2nd
from app.core.auth_dependency import get_current_user
from app.models.user import User


router = APIRouter()

@router.get("/optimize", response_model=RouteResponse)
def get_optimized_route(
    start_lat: float = Query(..., description="Truck's starting latitude"),
    start_lng: float = Query(..., description="Truck's starting longitude"),
    threshold: int = Query(75, ge=0, le=100, description="Fill level threshold percentage"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate an optimized collection route based on bin fill levels from a dynamic starting position.
    """
    try:
        route = RouteOptimizerService.optimize_route(db, threshold, start_lat, start_lng)
        return route
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/optimize-2nd", response_model=RouteResponse)
def get_optimized_route_2nd(
    threshold: int = Query(75, ge=0, le=100, description="Fill level threshold percentage"),
    db: Session = Depends(get_db)
):
    try:
        route = RouteOptimizerService2nd.optimize_route(db, threshold)
        return route
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/optimize-2nd", response_model=RouteResponse)
def get_optimized_route_2nd(
    threshold: int = Query(75, ge=0, le=100, description="Fill level threshold percentage"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        route = RouteOptimizerService2nd.optimize_route(db, threshold)
        return route
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
