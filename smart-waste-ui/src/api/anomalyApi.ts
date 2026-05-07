import type { RoadAnomaly, RoadAnomalyList } from '../types/bin';

const API_BASE = '/api/v1';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export const anomalyApi = {
    async fetchMapAnomalies(): Promise<RoadAnomaly[]> {
        const response = await fetch(`${API_BASE}/anomalies/map`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to fetch road anomalies');
        }
        const data = await response.json() as RoadAnomalyList;
        return data.anomalies;
    },
};
