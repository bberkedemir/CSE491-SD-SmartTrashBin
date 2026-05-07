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
  bin_id: number | null;
  action: string;
  fill_before: number | null;
  fill_after: number | null;
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
  client_type?: string;
}

export interface TokenResponse {
  user: User;
  token: string;
  token_type: string;
}

export interface GpsSample {
  timestamp: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
}

export type AnomalySessionStatus =
  | 'recorded'
  | 'uploading'
  | 'analysis_pending'
  | 'analysis_running'
  | 'analysis_complete'
  | 'analysis_failed'
  | 'upload_failed';

export interface AnomalyCaptureSession {
  sessionId: string;
  videoUri: string;
  gpsLogUri: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  pointCount: number;
  status: AnomalySessionStatus;
  uploadId?: number;
  uploadedAt?: string;
  uploadProgress?: number;
  errorMessage?: string;
}

export interface AnomalyUploadResponse {
  id: number;
  session_id: string;
  status: AnomalySessionStatus;
  video_path: string;
  gps_log_path: string;
  point_count: number;
  duration_seconds: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string | null;
  message: string;
}

export interface AnomalyUploadList {
  uploads: AnomalyUploadResponse[];
  total: number;
}

export interface RoadAnomaly {
  id: number;
  upload_id: number;
  driver_id: number | null;
  class_name: string;
  track_id: number;
  confidence: number;
  timestamp_seconds: number;
  image_path: string;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string | null;
}

export interface RoadAnomalyList {
  anomalies: RoadAnomaly[];
  total: number;
}
