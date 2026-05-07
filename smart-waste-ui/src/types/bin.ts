export interface BinPoint {
    id: number;
    lat: number;
    lng: number;
    title: string;
    fill: number;
}

export type NewBinData = Omit<BinPoint, 'id'>;

export interface RouteStop {
    sequence: number;
    id: number;
    title: string;
    lat: number;
    lng: number;
    fill_level: number;
    type: string;
}

export interface RouteMetrics {
    generatedAt: string;
    totalStops: number;
    totalDistanceKm: number;
    estimatedTimeMinutes: number;
    stops: RouteStop[];
}

export interface RouteResponse {
    generated_at: string;
    total_stops: number;
    total_distance_km: number;
    estimated_time_minutes: number;
    route_sequence: RouteStop[];
    route_geometry: number[][];
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
    status: RoadAnomalyStatus;
    image_url: string | null;
    latitude: number | null;
    longitude: number | null;
    driver_username: string | null;
    driver_full_name: string | null;
    driver_email: string | null;
    created_at: string | null;
}

export interface RoadAnomalyList {
    anomalies: RoadAnomaly[];
    total: number;
}

export type RoadAnomalyStatus = 'default' | 'needs_repair' | 'repaired';

export interface AnomalyImportRequest {
    source_path: string;
    driver_id?: number | null;
    session_id?: string | null;
    copy_images: boolean;
}

export interface AnomalyImportItem {
    upload: {
        id: number;
        session_id: string;
        status: string;
        video_path: string;
        gps_log_path: string;
        point_count: number;
        duration_seconds: number;
        started_at: string | null;
        ended_at: string | null;
        created_at: string | null;
        message: string;
    };
    imported_count: number;
    skipped_count: number;
    source_report_path: string;
}

export interface AnomalyImportResponse {
    imports: AnomalyImportItem[];
    total_imported: number;
    total_skipped: number;
    message: string;
}

export interface AppNotification {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
}

export interface DriverRouteStop {
    sequence: number;
    id: number;
    title: string;
    lat: number;
    lng: number;
    fill_level: number;
    type: string;
}

export interface DriverSession {
    driver_id: number;
    driver_name: string;
    driver_full_name: string;
    lat: number;
    lng: number;
    route_stops: DriverRouteStop[];
    route_geometry: number[][];
    current_stop_index: number;
    collected_ids: number[];
    skipped_ids: number[];
    started_at: string;
    last_update: string;
    is_completed: boolean;
}

export interface WSTrackingMessage {
    event: 'session_started' | 'position_updated' | 'session_completed' | 'full_snapshot';
    session?: DriverSession;
    sessions?: DriverSession[];
}
