export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: 'admin' | 'truck_driver';
  is_active: boolean;
  created_at: string;
}

export interface Bin {
  id: number;
  lat: number;
  lng: number;
  title: string;
  fill: number;
  created_at: string;
  updated_at: string;
}

export interface RouteStop {
  sequence: number;
  id: number;           // -1 for start/end waypoints
  title: string;
  lat: number;
  lng: number;
  fill_level: number;
  type: 'pickup' | 'start' | 'end' | 'waypoint';
}

export interface RouteResponse {
  generated_at: string;
  total_stops: number;
  total_distance_km: number;
  estimated_time_minutes: number;
  route_sequence: RouteStop[];
  route_geometry: [number, number][]; // [lat, lng] pairs
}

export interface CollectionLog {
  id: number;
  bin_id: number;
  action: string;
  fill_before: number;
  fill_after: number;
  notes: string | null;
  created_at: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  full_name: string;
  password: string;
}

export interface TokenResponse {
  user: User;
  token: string;
  token_type: string;
}
