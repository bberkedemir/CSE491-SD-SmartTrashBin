import math
import random
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.bin import Bin
from app.schemas.route import RouteResponse, RouteStop
from app.services.greedy_travelling_salesman import GreedyTravellingSalesmanService, ENTRY_POINT


class SimulatedAnnealingService(GreedyTravellingSalesmanService):

    @staticmethod
    def simulated_annealing(
        route_matrix: List[List[float]],
        route_indices: List[int],
        initial_temp: float = 1000.0,
        cooling_rate: float = 0.995,
        min_temp: float = 0.01,
        seed: Optional[int] = None,
    ) -> Tuple[List[int], float]:
        rng = random.Random(seed)

        def route_cost(route: List[int]) -> float:
            return sum(
                route_matrix[route[k]][route[k + 1]] for k in range(len(route) - 1)
            )

        current = route_indices[:]
        current_cost = route_cost(current)

        best = current[:]
        best_cost = current_cost

        inner_start = 1
        inner_end = len(current) - 2  

        if inner_end <= inner_start:
            return current, current_cost

        T = initial_temp

        while T > min_temp:
            i = rng.randint(inner_start, inner_end)
            j = rng.randint(inner_start, inner_end)
            if i == j:
                T *= cooling_rate
                continue

            neighbor = current[:]
            neighbor[i], neighbor[j] = neighbor[j], neighbor[i]
            neighbor_cost = route_cost(neighbor)

            delta = neighbor_cost - current_cost

            if delta < 0 or rng.random() < math.exp(-delta / T):
                current = neighbor
                current_cost = neighbor_cost

                if current_cost < best_cost:
                    best = current[:]
                    best_cost = current_cost

            T *= cooling_rate

        return best, best_cost

    @staticmethod
    def optimize_route(
        db: Session,
        threshold: int = 75,
        seed: Optional[int] = 42,
    ) -> RouteResponse:
        bins_query = db.query(Bin).filter(Bin.fill >= threshold).all()
        bins_data = [
            {"id": b.id, "title": b.title, "lat": b.lat, "lng": b.lng, "fill": b.fill}
            for b in bins_query
        ]

        if not bins_data:
            return RouteResponse(
                generated_at=datetime.now(),
                total_stops=0,
                total_distance_km=0.0,
                estimated_time_minutes=0.0,
                route_sequence=[],
                route_geometry=[],
            )

        all_locations = [ENTRY_POINT] + bins_data

        try:
            distance_matrix = GreedyTravellingSalesmanService.get_osrm_matrix(all_locations)
        except Exception as e:
            raise Exception(f"Failed to calculate route: {str(e)}")

        nn_route, _ = GreedyTravellingSalesmanService.nearest_neighbor_tsp(
            distance_matrix, start_index=0
        )
        best_route_indices, total_distance_meters = (
            SimulatedAnnealingService.simulated_annealing(
                distance_matrix,
                nn_route,
                initial_temp=1000.0,
                cooling_rate=0.995,
                min_temp=0.01,
                seed=seed,
            )
        )

        ordered_locations = [all_locations[i] for i in best_route_indices]
        route_geometry = GreedyTravellingSalesmanService.get_osrm_route(ordered_locations)

        route_sequence = []
        for i, location_idx in enumerate(best_route_indices):
            location = all_locations[location_idx]
            stop_type = "waypoint"
            if location["id"] == -1:
                stop_type = "start" if i == 0 else "end"
            else:
                stop_type = "pickup"

            route_sequence.append(
                RouteStop(
                    sequence=i,
                    id=location["id"],
                    title=location["title"],
                    lat=location["lat"],
                    lng=location["lng"],
                    fill_level=location["fill"],
                    type=stop_type,
                )
            )

        total_distance_km = total_distance_meters / 1000.0
        estimated_time = (total_distance_meters / 500) + (len(bins_data) * 3)

        return RouteResponse(
            generated_at=datetime.now(),
            total_stops=len(bins_data),
            total_distance_km=round(total_distance_km, 2),
            estimated_time_minutes=round(estimated_time, 0),
            route_sequence=route_sequence,
            route_geometry=route_geometry,
        )
