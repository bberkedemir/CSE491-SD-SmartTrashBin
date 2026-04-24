import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Bin, RouteResponse, CollectionLog, LoginCredentials, RegisterCredentials, TokenResponse, User } from '../types';

// Use LAN IP (not localhost) when testing on a physical device via Expo Go
export const API_BASE_URL = 'http://192.168.1.24:8000';

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
  const { data } = await api.get<{ items: Bin[]; total: number }>('/api/v1/bins/', {
    params: { limit: 500 },
  });
  return data.items;
};

export const collectBin = async (binId: number): Promise<Bin> => {
  const { data } = await api.post<Bin>(`/api/v1/bins/${binId}/collect`);
  return data;
};

// Routes
export const getOptimizedRoute = async (
  startLat: number,
  startLng: number,
  threshold = 75
): Promise<RouteResponse> => {
  const { data } = await api.get<RouteResponse>('/api/v1/routes/optimize', {
    params: { start_lat: startLat, start_lng: startLng, threshold },
  });
  return data;
};

// Logs
export const getLogs = async (skip = 0, limit = 50): Promise<CollectionLog[]> => {
  const { data } = await api.get<{ items: CollectionLog[]; total: number }>('/api/v1/logs/', {
    params: { skip, limit },
  });
  return data.items;
};

export default api;
