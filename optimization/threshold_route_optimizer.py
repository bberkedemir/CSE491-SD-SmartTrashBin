#!/usr/bin/env python3
"""
Smart Waste Collection - Threshold Processing & Route Optimization
Applies fill-level threshold and generates optimized collection routes
"""

import sqlite3
import math
from datetime import datetime
from typing import List, Dict, Tuple
import json

# Configuration
DB_PATH = "sensor_data.db"
FILL_THRESHOLD = 75  # Percentage threshold for collection
BATTERY_WARNING_THRESHOLD = 20  # Battery warning level (%)

# Always-full bins (high-priority locations)
ALWAYS_FULL_BINS = [
    {"id": "STATIC_001", "name": "Dorm A Entrance", "lat": 40.7580, "lon": 29.9220},
    {"id": "STATIC_002", "name": "Dorm B Entrance", "lat": 40.7585, "lon": 29.9225},
    {"id": "STATIC_003", "name": "Cafeteria Main", "lat": 40.7590, "lon": 29.9230},
    {"id": "STATIC_004", "name": "Cafeteria Side", "lat": 40.7592, "lon": 29.9232},
    {"id": "STATIC_005", "name": "Library Entrance", "lat": 40.7595, "lon": 29.9235},
    {"id": "STATIC_006", "name": "Student Center", "lat": 40.7600, "lon": 29.9240},
]

# Variable bins with sensor data
VARIABLE_BINS = [
    {"id": "VAR_001", "name": "Engineering Building", "lat": 40.7575, "lon": 29.9215},
    {"id": "VAR_002", "name": "Science Building", "lat": 40.7582, "lon": 29.9222},
    {"id": "VAR_003", "name": "Arts Building", "lat": 40.7588, "lon": 29.9228},
    {"id": "VAR_004", "name": "Sports Center", "lat": 40.7593, "lon": 29.9233},
    {"id": "VAR_005", "name": "Parking Lot A", "lat": 40.7598, "lon": 29.9238},
    {"id": "VAR_006", "name": "Parking Lot B", "lat": 40.7603, "lon": 29.9243},
]

# Campus entry point (start/end of route)
ENTRY_POINT = {"id": "START", "name": "Campus Gate", "lat": 40.7570, "lon": 29.9210}


class ThresholdProcessor:
    """Processes sensor data and applies threshold logic"""
    
    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
    
    def get_latest_sensor_data(self) -> Dict[str, Dict]:
        """Retrieve latest sensor reading for each bin"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT bin_id, fill_level, battery_voltage, timestamp
            FROM sensor_data s1
            WHERE timestamp = (
                SELECT MAX(timestamp) 
                FROM sensor_data s2 
                WHERE s2.bin_id = s1.bin_id
            )
        ''')
        
        results = cursor.fetchall()
        conn.close()
        
        sensor_data = {}
        for row in results:
            bin_id, fill_level, battery_voltage, timestamp = row
            sensor_data[bin_id] = {
                'fill_level': fill_level,
                'battery_voltage': battery_voltage,
                'timestamp': timestamp
            }
        
        return sensor_data
    
    def apply_threshold(self, threshold=FILL_THRESHOLD) -> Tuple[List[Dict], List[str]]:
        """
        Apply fill-level threshold to determine which bins to collect
        Returns: (bins_to_collect, low_battery_warnings)
        """
        sensor_data = self.get_latest_sensor_data()
        bins_to_collect = []
        low_battery_bins = []
        
        # Add all always-full bins
        for bin_info in ALWAYS_FULL_BINS:
            bins_to_collect.append({
                'id': bin_info['id'],
                'name': bin_info['name'],
                'lat': bin_info['lat'],
                'lon': bin_info['lon'],
                'fill_level': 100,  # Assumed full
                'type': 'static'
            })
        
        # Process variable bins
        for bin_info in VARIABLE_BINS:
            bin_id = bin_info['id']
            
            if bin_id in sensor_data:
                data = sensor_data[bin_id]
                fill_level = data['fill_level']
                battery_voltage = data['battery_voltage']
                
                # Check battery level (assuming 3.0V = 0%, 4.2V = 100%)
                battery_percent = ((battery_voltage - 3.0) / 1.2) * 100
                if battery_percent < BATTERY_WARNING_THRESHOLD:
                    low_battery_bins.append(bin_id)
                
                # Apply threshold
                if fill_level >= threshold:
                    bins_to_collect.append({
                        'id': bin_id,
                        'name': bin_info['name'],
                        'lat': bin_info['lat'],
                        'lon': bin_info['lon'],
                        'fill_level': fill_level,
                        'type': 'dynamic',
                        'battery_voltage': battery_voltage
                    })
                    print(f"✓ {bin_id} included: {fill_level}% (≥ {threshold}%)")
                else:
                    print(f"✗ {bin_id} skipped: {fill_level}% (< {threshold}%)")
            else:
                print(f"⚠ {bin_id}: No sensor data available (sensor fault?)")
        
        return bins_to_collect, low_battery_bins
    
    def generate_report(self, threshold=FILL_THRESHOLD):
        """Generate threshold processing report"""
        bins_to_collect, low_battery = self.apply_threshold(threshold)
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'threshold_used': threshold,
            'total_bins': len(ALWAYS_FULL_BINS) + len(VARIABLE_BINS),
            'static_bins_included': len(ALWAYS_FULL_BINS),
            'dynamic_bins_included': len([b for b in bins_to_collect if b['type'] == 'dynamic']),
            'dynamic_bins_skipped': len(VARIABLE_BINS) - len([b for b in bins_to_collect if b['type'] == 'dynamic']),
            'bins_to_collect': bins_to_collect,
            'warnings': {
                'low_battery': low_battery
            }
        }
        
        return report


class RouteOptimizer:
    """Optimizes collection route using nearest neighbor algorithm"""
    
    @staticmethod
    def calculate_distance(point1: Dict, point2: Dict) -> float:
        """Calculate haversine distance between two GPS coordinates (in km)"""
        lat1, lon1 = math.radians(point1['lat']), math.radians(point1['lon'])
        lat2, lon2 = math.radians(point2['lat']), math.radians(point2['lon'])
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        # Earth radius in kilometers
        r = 6371
        
        return c * r
    
    @staticmethod
    def nearest_neighbor_tsp(bins: List[Dict], start_point: Dict) -> Tuple[List[Dict], float]:
        """
        Simple nearest neighbor algorithm for TSP
        Returns: (optimized_route, total_distance)
        """
        unvisited = bins.copy()
        route = [start_point]
        current = start_point
        total_distance = 0.0
        
        while unvisited:
            # Find nearest unvisited bin
            nearest = min(unvisited, 
                         key=lambda bin: RouteOptimizer.calculate_distance(current, bin))
            
            distance = RouteOptimizer.calculate_distance(current, nearest)
            total_distance += distance
            
            route.append(nearest)
            unvisited.remove(nearest)
            current = nearest
        
        # Return to start point
        return_distance = RouteOptimizer.calculate_distance(current, start_point)
        total_distance += return_distance
        route.append(start_point)
        
        return route, total_distance
    
    @staticmethod
    def generate_route(bins_to_collect: List[Dict]) -> Dict:
        """Generate optimized route"""
        route, total_distance = RouteOptimizer.nearest_neighbor_tsp(
            bins_to_collect, ENTRY_POINT
        )
        
        # Format route for output
        route_info = {
            'generated_at': datetime.now().isoformat(),
            'total_stops': len(bins_to_collect),
            'total_distance_km': round(total_distance, 2),
            'estimated_time_minutes': round(len(bins_to_collect) * 3 + total_distance * 5, 0),
            'route_sequence': []
        }
        
        for i, stop in enumerate(route):
            route_info['route_sequence'].append({
                'sequence': i,
                'id': stop['id'],
                'name': stop['name'],
                'lat': stop['lat'],
                'lon': stop['lon'],
                'fill_level': stop.get('fill_level', 'N/A'),
                'type': stop.get('type', 'waypoint')
            })
        
        return route_info


def main():
    """Main execution function"""
    print("=" * 60)
    print("SMART WASTE COLLECTION - ROUTE OPTIMIZATION")
    print("=" * 60)
    print()
    
    # Step 1: Process threshold
    print("STEP 1: Applying Fill-Level Threshold")
    print("-" * 60)
    
    processor = ThresholdProcessor()
    report = processor.generate_report(threshold=FILL_THRESHOLD)
    
    print(f"\nThreshold: {report['threshold_used']}%")
    print(f"Static bins (always included): {report['static_bins_included']}")
    print(f"Dynamic bins included: {report['dynamic_bins_included']}")
    print(f"Dynamic bins skipped: {report['dynamic_bins_skipped']}")
    print(f"Total stops: {len(report['bins_to_collect'])}")
    
    if report['warnings']['low_battery']:
        print(f"\n⚠ WARNING: Low battery detected in: {', '.join(report['warnings']['low_battery'])}")
    
    # Step 2: Generate route
    print("\n" + "=" * 60)
    print("STEP 2: Generating Optimized Route")
    print("-" * 60)
    
    optimizer = RouteOptimizer()
    route_info = optimizer.generate_route(report['bins_to_collect'])
    
    print(f"\nRoute generated at: {route_info['generated_at']}")
    print(f"Total stops: {route_info['total_stops']}")
    print(f"Total distance: {route_info['total_distance_km']} km")
    print(f"Estimated time: {route_info['estimated_time_minutes']} minutes")
    
    print("\nRoute Sequence:")
    print("-" * 60)
    for stop in route_info['route_sequence']:
        fill_info = f" [{stop['fill_level']}%]" if stop['fill_level'] != 'N/A' else ""
        print(f"{stop['sequence']:2d}. {stop['name']}{fill_info}")
    
    # Save to file
    output = {
        'threshold_report': report,
        'optimized_route': route_info
    }
    
    with open('route_output.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print("\n" + "=" * 60)
    print("Route saved to: route_output.json")
    print("=" * 60)


if __name__ == "__main__":
    main()