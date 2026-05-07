const API_BASE = '/api/v1';

export const logsApi = {
    async fetchAll(skip = 0, limit = 50) {
        const response = await fetch(`${API_BASE}/logs/?skip=${skip}&limit=${limit}`, {
            redirect: 'follow',
        });
        if (!response.ok) throw new Error('Failed to fetch logs');
        const data = await response.json();
        return data;
    },

    async create(logData: {action: string; bin_id?: number; notes?: string}) {
        const response = await fetch(`${API_BASE}/logs/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(logData),
        });
        if (!response.ok) throw new Error('Failed to create log');
        return response.json();
    },
};