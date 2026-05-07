import math
import requests
from typing import List, Dict, Tuple, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.bin import Bin
from app.schemas.route import RouteResponse, RouteStop

# Constants
# Campus Gate (Start/End point)
ENTRY_POINT = {"id": -1, "title": "Garbage Truck Depot", "lat": 36.892539, "lng":  30.663895, "fill": 0}
OSRM_BASE_URL = "http://router.project-osrm.org"

class GreedyTravellingSalesmanService:
    @staticmethod
    def get_osrm_matrix(locations: List[Dict]) -> List[List[float]]:
        """
        Fetch distance matrix from OSRM API.
        locations: List of dicts with 'lat' and 'lng'.
        Returns: 2D list of distances in meters.
        """
        coordinates = [f"{loc['lng']},{loc['lat']}" for loc in locations]
        coordinates_str = ";".join(coordinates)
        
        url = f"{OSRM_BASE_URL}/table/v1/driving/{coordinates_str}?annotations=distance"
        
        try:
            response = requests.get(url)
            response.raise_for_status()
            data = response.json()
            
            if data['code'] != 'Ok':
                raise Exception(f"OSRM API Error: {data['code']}")
                
            return data['distances']
        except Exception as e:
            print(f"Error fetching OSRM matrix: {e}")
            raise e

    @staticmethod
    def get_osrm_route(ordered_locations: List[Dict]) -> List[List[float]]:
        """
        Fetch the full route geometry from OSRM for the ordered list of locations.
        Returns: List of [lat, lng] coordinates for the polyline.
        """
        coordinates = [f"{loc['lng']},{loc['lat']}" for loc in ordered_locations]
        coordinates_str = ";".join(coordinates)
        
        url = f"{OSRM_BASE_URL}/route/v1/driving/{coordinates_str}?overview=full&geometries=geojson"
        
        try:
            response = requests.get(url)
            response.raise_for_status()
            data = response.json()
            
            if data['code'] != 'Ok':
                print(f"OSRM Route API Error: {data['code']}")
                return []
                
            if not data.get('routes'):
                print("OSRM returned no routes")
                return []

            geometry = data['routes'][0]['geometry']['coordinates']
            lat_lon_geometry = [[coord[1], coord[0]] for coord in geometry]
            
            return lat_lon_geometry
            
        except Exception as e:
            print(f"Error fetching OSRM route geometry: {e}")
            return []

    @staticmethod
    def nearest_neighbor_tsp(distance_matrix: List[List[float]], start_index: int) -> Tuple[List[int], float]:
        """
        TSP using pre-calculated distance matrix.
        Returns: (list of indices in order, total_distance in meters)
        """
        num_points = len(distance_matrix)
        unvisited = set(range(num_points))
        unvisited.remove(start_index)
        
        route_indices = [start_index]
        current_index = start_index
        total_distance = 0.0
        
        while unvisited:
            nearest_index = min(unvisited, 
                               key=lambda idx: distance_matrix[current_index][idx])
            
            distance = distance_matrix[current_index][nearest_index]
            total_distance += distance
            
            route_indices.append(nearest_index)
            unvisited.remove(nearest_index)
            current_index = nearest_index
            
        # DO NOT return to start to make it an open-ended route ending at the last bin
        
        return route_indices, total_distance

    @staticmethod
    def optimize_route(db: Session, threshold: int = 75, start_lat: float = ENTRY_POINT['lat'], start_lng: float = ENTRY_POINT['lng'], max_bins: Optional[int] = None) -> RouteResponse:
        """
        Fetch bins above threshold and generate optimized route using OSRM
        """
        bins_query = db.query(Bin).filter(Bin.fill >= threshold).all()
        
        bins_data = []
        for b in bins_query:
            bins_data.append({
                "id": b.id,
                "title": b.title,
                "lat": b.lat,
                "lng": b.lng,
                "fill": b.fill
            })
            
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
                route_geometry=[]
            )

        dynamic_start = {"id": -1, "title": "Garbage Truck", "lat": start_lat, "lng": start_lng, "fill": 0}
        all_locations = [dynamic_start] + bins_data
        
        try:
            distance_matrix = GreedyTravellingSalesmanService.get_osrm_matrix(all_locations)
        except Exception as e:
            raise Exception(f"Failed to calculate route: {str(e)}")

        route_indices, total_distance_meters = GreedyTravellingSalesmanService.nearest_neighbor_tsp(
            distance_matrix, start_index=0
        )
        
        ordered_locations = [all_locations[i] for i in route_indices]
        route_geometry = GreedyTravellingSalesmanService.get_osrm_route(ordered_locations)
        
        route_sequence = []
        for i, location_idx in enumerate(route_indices):
            location = all_locations[location_idx]
            
            stop_type = "waypoint"
            if location['id'] == -1:
                stop_type = "start" if i == 0 else "end"
            else:
                stop_type = "pickup"
                
            route_sequence.append(RouteStop(
                sequence=i,
                id=location['id'],
                title=location['title'],
                lat=location['lat'],
                lng=location['lng'],
                fill_level=location['fill'],
                type=stop_type
            ))
            
        total_distance_km = total_distance_meters / 1000.0
        travel_time_minutes = total_distance_meters / 500
        service_time_minutes = len(bins_data) * 3
        estimated_time = travel_time_minutes + service_time_minutes
        
        return RouteResponse(
            generated_at=datetime.now(),
            total_stops=len(bins_data),
            total_distance_km=round(total_distance_km, 2),
            estimated_time_minutes=round(estimated_time, 0),
            route_sequence=route_sequence,
            route_geometry=route_geometry
        )
