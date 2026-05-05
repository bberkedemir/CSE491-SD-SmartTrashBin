import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AnomalyCaptureSession,
  AnomalyUploadList,
  AnomalyUploadResponse,
  Bin,
  RouteResponse,
  CollectionLog,
  LoginCredentials,
  RegisterCredentials,
  TokenResponse,
  User,
} from '../types';

// Use LAN IP (not localhost) when testing on a physical device via Expo Go
export const API_BASE_URL = 'http://192.168.1.102:8000';

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
  const { data } = await api.post<TokenResponse>('/api/v1/auth/register', credentials);
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

export interface RouteCompletedPayload {
  stops_total: number;
  collected: number;
  skipped: number;
  distance_km: number;
  estimated_minutes: number;
  elapsed_seconds: number;
}

export const logRouteCompleted = async (payload: RouteCompletedPayload): Promise<void> => {
  await api.post('/api/v1/logs/route-completed', payload);
};

// Road anomaly uploads
export const uploadAnomalySession = async (
  session: AnomalyCaptureSession
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
      timeout: 120000,
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

export default api;
