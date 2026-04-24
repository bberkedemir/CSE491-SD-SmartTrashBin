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
  bin_id: number;
  title: string;
  lat: number;
  lng: number;
  fill: number;
  order: number;
}

export interface RouteResponse {
  stops: RouteStop[];
  total_distance_m: number;
  total_duration_s: number;
  geometry: [number, number][];
  algorithm: string;
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
