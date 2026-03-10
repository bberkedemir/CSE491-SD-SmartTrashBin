from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.greedy_travelling_salesman import GreedyTravellingSalesmanService
from app.schemas.route import RouteResponse
from app.services.travelling_salesman_with_edge_untangling import EdgeUntanglingService
from app.services.travelling_salesman_with_segment_shifting import SegmentShiftingService
from app.services.simulated_annealing_metaheuristic import SimulatedAnnealingService
from app.services.vrp_savings_route_merger import VRPSavingsRouteMergerService


router = APIRouter()

@router.get("/optimize", response_model=RouteResponse)
def get_optimized_route(
    threshold: int = Query(75, ge=0, le=100, description="Fill level threshold percentage"),
    db: Session = Depends(get_db)
):
    """
    Algorithm 1 — Nearest Neighbor (Greedy TSP).
    Generate an optimized collection route based on bin fill levels.
    """
    try:
        route = GreedyTravellingSalesmanService.optimize_route(db, threshold)
        return route
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/optimize-2nd", response_model=RouteResponse)
def get_optimized_route_2nd(
    threshold: int = Query(75, ge=0, le=100, description="Fill level threshold percentage"),
    db: Session = Depends(get_db)
):
    """
    Algorithm 2 — Nearest Neighbor + 2-opt.
    """
    try:
        route = EdgeUntanglingService.optimize_route(db, threshold)
        return route
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/optimize-3rd", response_model=RouteResponse)
def get_optimized_route_3rd(
    threshold: int = Query(75, ge=0, le=100, description="Fill level threshold percentage"),
    db: Session = Depends(get_db)
):
    """
    Algorithm 3 — Nearest Neighbor + 2-opt + Or-Opt.
    Or-Opt, segmentleri (1-2-3 node) farklı konumlara taşıyarak 2-opt'tan daha ince iyileştirme sağlar.
    """
    try:
        route = SegmentShiftingService.optimize_route(db, threshold)
        return route
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/optimize-4th", response_model=RouteResponse)
def get_optimized_route_4th(
    threshold: int = Query(75, ge=0, le=100, description="Fill level threshold percentage"),
    seed: int = Query(42, description="Rastgelelik tohumu (tekrarlanabilir sonuç). None için -1 girin."),
    db: Session = Depends(get_db)
):
    """
    Algorithm 4 — Simulated Annealing (Tavlama Benzetimi).
    Stokastik arama; yerel minimumlardan kaçabilir.
    seed=42 (varsayılan) → tekrarlanabilir. seed=-1 → tamamen rastgele.
    """
    try:
        actual_seed = None if seed == -1 else seed
        route = SimulatedAnnealingService.optimize_route(db, threshold, seed=actual_seed)
        return route
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/optimize-5th", response_model=RouteResponse)
def get_optimized_route_5th(
    threshold: int = Query(75, ge=0, le=100, description="Fill level threshold percentage"),
    db: Session = Depends(get_db)
):
    """
    Algorithm 5 — Clarke-Wright Savings (Tasarruf Algoritması).
    NN ile hiçbir ilgisi yok. Her kutu için ayrı bir rota varsayar,
    sonra matematiksel tasarruf (S = D[depot,i]+D[depot,j]-D[i,j])
    sıralamasıyla bu rotaları birleştirir.
    """
    try:
        route = VRPSavingsRouteMergerService.optimize_route(db, threshold)
        return route
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
