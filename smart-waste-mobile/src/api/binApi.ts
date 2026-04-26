import type { BinPoint, RouteResponse } from '../types';

const API_BASE = '/api/v1';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export const binApi = {
    async fetchAll(): Promise<BinPoint[]> {
        const response = await fetch(`${API_BASE}/bins/`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch bins');
        const data = await response.json();
        return data.bins;
    },

    async collect(binId: number): Promise<BinPoint> {
        const response = await fetch(`${API_BASE}/bins/${binId}/collect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to collect bin');
        return response.json();
    },

    async simulateTime(): Promise<string> {
        const response = await fetch(`${API_BASE}/bins/simulate-time`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to simulate time');
        const data = await response.json();
        return data.message;
    },

    async optimizeRoute(threshold: number = 30, startLat: number, startLng: number): Promise<RouteResponse> {
        const response = await fetch(
            `${API_BASE}/routes/optimize?threshold=${threshold}&start_lat=${startLat}&start_lng=${startLng}`,
            { headers: getAuthHeaders() }
        );
        if (!response.ok) throw new Error('Failed to optimize route');
        return response.json();
    },
};
