import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Bin, RouteResponse, CollectionLog, LoginCredentials, RegisterCredentials, TokenResponse, User } from '../types';

// Use LAN IP (not localhost) when testing on a physical device via Expo Go
export const API_BASE_URL = 'http://10.93.122.89:8000';

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

export const updateTrackingPosition = (payload: TrackingPositionPayload): void => {
  // Fire-and-forget — must not block the GPS callback
  api.put('/api/v1/tracking/position', payload).catch(() => {});
};

export interface TrackingCompletePayload {
  collected_ids: number[];
  skipped_ids: number[];
}

export const completeTrackingSession = async (payload: TrackingCompletePayload): Promise<void> => {
  await api.post('/api/v1/tracking/complete', payload);
};

export default api;
