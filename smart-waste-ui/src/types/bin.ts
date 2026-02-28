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

export interface AppNotification {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
}