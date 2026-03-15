import type { BinPoint, NewBinData, RouteResponse } from '../types/bin';

const API_BASE = '/api/v1';

export const binApi = {
    async fetchAll(): Promise<BinPoint[]> {
        const response = await fetch(`${API_BASE}/bins`);
        if (!response.ok) throw new Error('Failed to fetch bins');
        const data = await response.json();
        return data.bins;
    },

    async create(binData: NewBinData): Promise<BinPoint> {
        const response = await fetch(`${API_BASE}/bins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(binData),
        });
        if (!response.ok) throw new Error('Failed to create bin');
        return response.json();
    },

    async delete(binId: number): Promise<void> {
        const response = await fetch(`${API_BASE}/bins/${binId}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete bin');
    },

    async collect(binId: number): Promise<BinPoint> {
        const response = await fetch(`${API_BASE}/bins/${binId}/collect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to simulate collecting bin');
        return response.json();
    },

    async throwTrash(binId: number): Promise<BinPoint> {
        const response = await fetch(`${API_BASE}/bins/${binId}/throw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to simulate throwing trash');
        return response.json();
    },

    async simulateTime(): Promise<string> {
        const response = await fetch(`${API_BASE}/bins/simulate-time`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to simulate time passing');
        const data = await response.json();
        return data.message;
    },

    async exportData(format: 'json' | 'csv'): Promise<void> {
        const response = await fetch(`${API_BASE}/bins/export?format=${format}`);
        if (!response.ok) throw new Error(`Failed to export data as ${format}`);

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `bins_export.${format}`;

        document.body.appendChild(a);
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    },

    upload(
        file: File,
        onProgress: (percent: number) => void
    ): Promise<{ status: number; body: any }> {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);

            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    onProgress((e.loaded / e.total) * 100);
                }
            });

            xhr.addEventListener('load', () => {
                try {
                    const body = JSON.parse(xhr.responseText);
                    resolve({ status: xhr.status, body });
                } catch {
                    reject(new Error('Invalid response from server'));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Network error during upload'));
            });

            xhr.open('POST', `${API_BASE}/bins/upload`);
            xhr.send(formData);
        });
    },

    async optimizeRoute(threshold: number = 30, startLat: number, startLng: number): Promise<RouteResponse> {
        const response = await fetch(`${API_BASE}/routes/optimize?threshold=${threshold}&start_lat=${startLat}&start_lng=${startLng}`);
        if (!response.ok) throw new Error('Failed to optimize route');
        return response.json();
    },

    importBins(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);

            const xhr = new XMLHttpRequest();

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const body = JSON.parse(xhr.responseText);
                        resolve(body.message || 'Import successful');
                    } catch {
                        resolve('Import successful');
                    }
                } else {
                    reject(new Error('Server returned an error'));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Network error during upload'));
            });

            xhr.open('POST', `${API_BASE}/bins/upload`);
            xhr.send(formData);
        });
    },
};