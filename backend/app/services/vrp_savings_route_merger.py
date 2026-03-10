from typing import List, Dict, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.bin import Bin
from app.schemas.route import RouteResponse, RouteStop
from app.services.greedy_travelling_salesman import GreedyTravellingSalesmanService, ENTRY_POINT


class VRPSavingsRouteMergerService(GreedyTravellingSalesmanService):

    @staticmethod
    def clarke_wright_savings(
        distance_matrix: List[List[float]],
        depot_index: int = 0,
    ) -> Tuple[List[int], float]:
        n = len(distance_matrix)
        bins = [i for i in range(n) if i != depot_index]

        if not bins:
            return [depot_index, depot_index], 0.0

        if len(bins) == 1:
            b = bins[0]
            cost = distance_matrix[depot_index][b] + distance_matrix[b][depot_index]
            return [depot_index, b, depot_index], cost

        savings: List[Tuple[float, int, int]] = []
        for idx_a in range(len(bins)):
            for idx_b in range(idx_a + 1, len(bins)):
                i, j = bins[idx_a], bins[idx_b]
                s = (
                    distance_matrix[depot_index][i]
                    + distance_matrix[depot_index][j]
                    - distance_matrix[i][j]
                )
                savings.append((s, i, j))

        savings.sort(key=lambda x: x[0], reverse=True)

        routes: Dict[int, List[int]] = {b: [b] for b in bins}
        node_to_route: Dict[int, int] = {b: b for b in bins}
        for saving_val, i, j in savings:
            ri_id = node_to_route.get(i)
            rj_id = node_to_route.get(j)

            if ri_id is None or rj_id is None:
                continue
            if ri_id == rj_id:
                continue

            route_i = routes[ri_id]
            route_j = routes[rj_id]

            i_at_end   = (route_i[-1] == i)
            i_at_start = (route_i[0]  == i)
            j_at_start = (route_j[0]  == j)
            j_at_end   = (route_j[-1] == j)

            merged: List[int] = []

            if i_at_end and j_at_start:
                merged = route_i + route_j
            elif i_at_start and j_at_end:
                merged = route_j + route_i
            elif i_at_end and j_at_end:
                merged = route_i + route_j[::-1]
            elif i_at_start and j_at_start:
                merged = route_i[::-1] + route_j
            else:
                continue

            routes[ri_id] = merged
            del routes[rj_id]
            for node in route_j:
                node_to_route[node] = ri_id

        final_inner: List[int] = []
        for route in routes.values():
            final_inner.extend(route)

        full_route = [depot_index] + final_inner + [depot_index]

        total_dist = sum(
            distance_matrix[full_route[k]][full_route[k + 1]]
            for k in range(len(full_route) - 1)
        )

        return full_route, total_dist

    @staticmethod
    def optimize_route(db: Session, threshold: int = 75) -> RouteResponse:
        bins_query = db.query(Bin).filter(Bin.fill >= threshold).all()
        bins_data = [
            {
                "id": b.id,
                "title": b.title,
                "lat": b.lat,
                "lng": b.lng,
                "fill": b.fill,
            }
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

        best_route_indices, total_distance_meters = (
            VRPSavingsRouteMergerService.clarke_wright_savings(
                distance_matrix, depot_index=0
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
