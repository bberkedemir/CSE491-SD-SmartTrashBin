import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AnomalyCaptureSession,
  AnomalyUploadList,
  AnomalyUploadResponse,
  Bin,
  RoadAnomaly,
  RoadAnomalyList,
  RouteResponse,
  CollectionLog,
  LoginCredentials,
  RegisterCredentials,
  TokenResponse,
  User,
} from '../types';

// Use LAN IP (not localhost) when testing on a physical device via Expo Go
export const API_BASE_URL = 'http://10.93.122.89:8000';

//export const API_BASE_URL = 'https://arise-deprive-disobey.ngrok-free.dev';


const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const login = async (credentials: LoginCredentials): Promise<TokenResponse> => {
  const { data } = await api.post<TokenResponse>('/api/v1/auth/login', credentials);
  return data;
};

export const register = async (credentials: RegisterCredentials): Promise<TokenResponse> => {
  const payload = { ...credentials, client_type: 'mobile' };
  const { data } = await api.post<TokenResponse>('/api/v1/auth/register', payload);
  return data;
};

export const getMe = async (): Promise<User> => {
  const { data } = await api.get<User>('/api/v1/auth/me');
  return data;
};

export const logout = async (token: string): Promise<void> => {
  await api.post('/api/v1/auth/logout', { token });
};

// Bins
export const getBins = async (): Promise<Bin[]> => {
  const { data } = await api.get<{ bins: Bin[]; total: number }>('/api/v1/bins/', {
    params: { limit: 500 },
  });
  return data.bins;
};

export const collectBin = async (binId: number): Promise<Bin> => {
  const { data } = await api.post<Bin>(`/api/v1/bins/${binId}/collect`);
  return data;
};

// Routes
export const getOptimizedRoute = async (
  startLat: number,
  startLng: number,
  threshold = 30
): Promise<RouteResponse> => {
  const { data } = await api.get<RouteResponse>('/api/v1/routes/optimize', {
    params: { start_lat: startLat, start_lng: startLng, threshold },
  });
  return data;
};

// Logs
export const getLogs = async (skip = 0, limit = 50): Promise<CollectionLog[]> => {
  const { data } = await api.get<{ logs: CollectionLog[]; total: number }>('/api/v1/logs/', {
    params: { skip, limit },
  });
  return data.logs;
};

export interface RouteBinEntry {
  id: number;
  title: string;
  fill_level: number;
}

export interface RouteCompletedPayload {
  stops_total: number;
  collected: number;
  skipped: number;
  distance_km: number;
  estimated_minutes: number;
  elapsed_seconds: number;
  collected_bins?: RouteBinEntry[];
  skipped_bins?: RouteBinEntry[];
}

export const logRouteCompleted = async (payload: RouteCompletedPayload): Promise<void> => {
  await api.post('/api/v1/logs/route-completed', payload);
};

// Road anomaly uploads
const ANOMALY_UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;

export const uploadAnomalySession = async (
  session: AnomalyCaptureSession,
  onProgress?: (progress: number) => void
): Promise<AnomalyUploadResponse> => {
  const formData = new FormData();
  formData.append('session_id', session.sessionId);
  formData.append('started_at', session.startedAt);
  formData.append('ended_at', session.endedAt);
  formData.append('point_count', String(session.pointCount));
  formData.append('duration_seconds', String(session.durationSeconds));
  formData.append('video', {
    uri: session.videoUri,
    name: `${session.sessionId}.mp4`,
    type: 'video/mp4',
  } as any);
  formData.append('gps_log', {
    uri: session.gpsLogUri,
    name: `${session.sessionId}-gps.json`,
    type: 'application/json',
  } as any);

  const { data } = await api.post<AnomalyUploadResponse>(
    '/api/v1/anomalies/uploads',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: ANOMALY_UPLOAD_TIMEOUT_MS,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      onUploadProgress: (event) => {
        if (!event.total) return;
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      },
    }
  );
  return data;
};

export const getAnomalyUploads = async (skip = 0, limit = 50): Promise<AnomalyUploadResponse[]> => {
  const { data } = await api.get<AnomalyUploadList>('/api/v1/anomalies/uploads', {
    params: { skip, limit },
  });
  return data.uploads;
};

export const getRoadAnomalies = async (skip = 0, limit = 500): Promise<RoadAnomaly[]> => {
  const { data } = await api.get<RoadAnomalyList>('/api/v1/anomalies/map', {
    params: { skip, limit },
  });
  return data.anomalies;
}
// Tracking
export interface TrackingStartPayload {
  route_stops: RouteResponse['route_sequence'];
  route_geometry: RouteResponse['route_geometry'];
  current_lat: number;
  current_lng: number;
}


export const startTrackingSession = async (payload: TrackingStartPayload): Promise<void> => {
  await api.post('/api/v1/tracking/start', payload);
};

export interface TrackingPositionPayload {
  lat: number;
  lng: number;
  current_stop_index: number;
  collected_ids: number[];
  skipped_ids: number[];
}

export const updateTrackingPosition = (payload: TrackingPositionPayload): Promise<void> => {
  return api.put('/api/v1/tracking/position', payload).then(() => {});
};

export interface TrackingCompletePayload {
  collected_ids: number[];
  skipped_ids: number[];
}

export const completeTrackingSession = async (payload: TrackingCompletePayload): Promise<void> => {
  await api.post('/api/v1/tracking/complete', payload);
};

export interface ActiveSessionSummary {
  driver_id: number;
  is_completed: boolean;
}

export const getActiveSessions = async (): Promise<ActiveSessionSummary[]> => {
  const { data } = await api.get<{ sessions: ActiveSessionSummary[]; count: number }>('/api/v1/tracking/sessions');
  return data.sessions;
};

export default api;
