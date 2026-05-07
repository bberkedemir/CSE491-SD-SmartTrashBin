import type { Truck, TruckCreate, TruckUpdate } from '../types/truck';

const API_BASE = '/api/v1/trucks';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const trucksApi = {
  async getTrucks(): Promise<Truck[]> {
    const res = await fetch(`${API_BASE}/`, { headers: getHeaders() });
    return handleResponse<Truck[]>(res);
  },

  async getTruck(id: number): Promise<Truck> {
    const res = await fetch(`${API_BASE}/${id}`, { headers: getHeaders() });
    return handleResponse<Truck>(res);
  },

  async createTruck(data: TruckCreate): Promise<Truck> {
    const res = await fetch(`${API_BASE}/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<Truck>(res);
  },

  async updateTruck(id: number, data: TruckUpdate): Promise<Truck> {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<Truck>(res);
  },

  async deleteTruck(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Delete failed: ${res.status}`);
    }
  },

  async assignDriver(truckId: number, driverId: number | null): Promise<Truck> {
    const res = await fetch(`${API_BASE}/${truckId}/assign`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ driver_id: driverId }),
    });
    return handleResponse<Truck>(res);
  },
};
