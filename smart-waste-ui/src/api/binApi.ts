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

    async optimizeRoute(threshold: number = 30): Promise<RouteResponse> {
        const response = await fetch(`${API_BASE}/routes/optimize?threshold=${threshold}`);
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