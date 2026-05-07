import math
from typing import List, Dict, Tuple, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.bin import Bin
from app.schemas.route import RouteResponse, RouteStop
from app.services.greedy_travelling_salesman import GreedyTravellingSalesmanService, ENTRY_POINT


class SegmentShiftingService:

    @staticmethod
    def two_opt(route_matrix: List[List[float]], route_indices: List[int]) -> Tuple[List[int], float]:
        best_route = route_indices[:]
        improved = True
        
        while improved:
            improved = False
            for i in range(1, len(best_route) - 2):
                for j in range(i + 1, len(best_route) - 1):
                    if j - i == 1: 
                        continue
                    
                    n1, n2 = best_route[i-1], best_route[i]
                    n3, n4 = best_route[j], best_route[j+1]
                    
                    old_dist = route_matrix[n1][n2] + route_matrix[n3][n4]
                    new_dist = route_matrix[n1][n3] + route_matrix[n2][n4]
                    
                    if new_dist < old_dist:
                        best_route[i:j+1] = best_route[i:j+1][::-1]
                        improved = True
        
        total_dist = 0.0
        for k in range(len(best_route) - 1):
            total_dist += route_matrix[best_route[k]][best_route[k+1]]
            
        return best_route, total_dist

    @staticmethod
    def or_opt(
        route_matrix: List[List[float]],
        route_indices: List[int],
        segment_sizes: Tuple[int, ...] = (1, 2, 3),
    ) -> Tuple[List[int], float]:
        best = route_indices[:]
        improved = True

        while improved:
            improved = False
            inner = best[1:-1]
            n = len(inner)

            for seg_len in segment_sizes:
                if seg_len >= n:
                    continue
                for i in range(n - seg_len + 1):
                    segment = inner[i: i + seg_len]
                    remaining = inner[:i] + inner[i + seg_len:]

                    for j in range(len(remaining) + 1):
                        if j == i:
                            continue
                        new_inner = remaining[:j] + segment + remaining[j:]
                        new_route = [best[0]] + new_inner + [best[-1]]

                        old_cost = SegmentShiftingService._route_cost(
                            route_matrix, best
                        )
                        new_cost = SegmentShiftingService._route_cost(
                            route_matrix, new_route
                        )

                        if new_cost < old_cost - 1e-6:
                            best = new_route
                            improved = True
                            break
                    if improved:
                        break
                if improved:
                    break

        total_dist = SegmentShiftingService._route_cost(route_matrix, best)
        return best, total_dist

    @staticmethod
    def _route_cost(route_matrix: List[List[float]], route: List[int]) -> float:
        return sum(
            route_matrix[route[k]][route[k + 1]] for k in range(len(route) - 1)
        )

    @staticmethod
    def optimize_route(db: Session, threshold: int = 75, start_lat: float = ENTRY_POINT['lat'], start_lng: float = ENTRY_POINT['lng'], max_bins: Optional[int] = None) -> RouteResponse:
        bins_query = db.query(Bin).filter(Bin.fill >= threshold).all()
        bins_data = [
            {"id": b.id, "title": b.title, "lat": b.lat, "lng": b.lng, "fill": b.fill}
            for b in bins_query
        ]

        bins_data.sort(key=lambda b: b["fill"], reverse=True)
        if max_bins is not None:
            bins_data = bins_data[:max_bins]

        if not bins_data:
            return RouteResponse(
                generated_at=datetime.now(),
                total_stops=0,
                total_distance_km=0.0,
                estimated_time_minutes=0.0,
                route_sequence=[],
                route_geometry=[],
            )

        dynamic_start = {"id": -1, "title": "Garbage Truck", "lat": start_lat, "lng": start_lng, "fill": 0}
        all_locations = [dynamic_start] + bins_data

        try:
            distance_matrix = GreedyTravellingSalesmanService.get_osrm_matrix(all_locations)
        except Exception as e:
            raise Exception(f"Failed to calculate route: {str(e)}")

        # Step 1: Nearest Neighbor
        nn_route, _ = GreedyTravellingSalesmanService.nearest_neighbor_tsp(
            distance_matrix, start_index=0
        )

        # Step 2: 2-opt
        after_2opt, _ = SegmentShiftingService.two_opt(distance_matrix, nn_route)

        # Step 3: Or-Opt (segment sizes 1, 2, 3)
        best_route_indices, total_distance_meters = SegmentShiftingService.or_opt(
            distance_matrix, after_2opt, segment_sizes=(1, 2, 3)
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
