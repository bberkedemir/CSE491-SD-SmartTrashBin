from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.route_optimizer import RouteOptimizerService
from app.schemas.route import RouteResponse

router = APIRouter()

@router.get("/optimize", response_model=RouteResponse)
def get_optimized_route(
    threshold: int = Query(75, ge=0, le=100, description="Fill level threshold percentage"),
    db: Session = Depends(get_db)
):
    """
    Generate an optimized collection route based on bin fill levels.
    """
    try:
        route = RouteOptimizerService.optimize_route(db, threshold)
        return route
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
