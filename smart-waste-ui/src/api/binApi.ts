import type { BinPoint, NewBinData, RouteResponse } from '../types/bin';

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
        const headers = getAuthHeaders();
        console.log("DEBUG: Fetching bins with headers:", { 
            ...headers, 
            Authorization: headers.Authorization ? "Bearer [HIDDEN]" : "MISSING" 
        });
        
        const response = await fetch(`${API_BASE}/bins/`, {
            headers: headers
        });
        
        console.log("DEBUG: Fetch bins response status:", response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error("DEBUG: Fetch bins error body:", errorText);
            throw new Error(`Failed to fetch bins: ${response.status} ${errorText}`);
        }
        const data = await response.json();
        return data.bins;
    },

    async create(binData: NewBinData): Promise<BinPoint> {
        console.log("DEBUG: Creating bin with data:", binData);
        const response = await fetch(`${API_BASE}/bins/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(binData),
        });
        
        console.log("DEBUG: Create bin response status:", response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error("DEBUG: Create bin error body:", errorText);
            throw new Error(`Failed to create bin: ${response.status} ${errorText}`);
        }
        return response.json();
    },

    async delete(binId: number): Promise<void> {
        const response = await fetch(`${API_BASE}/bins/${binId}/`, {
            method: 'DELETE',
            headers: getAuthHeaders()
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
            const token = localStorage.getItem('token');
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            xhr.send(formData);
        });
    },

    async optimizeRoute(threshold: number = 30): Promise<RouteResponse> {
        const response = await fetch(`${API_BASE}/routes/optimize?threshold=${threshold}`, {
            headers: getAuthHeaders()
        });
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
            const token = localStorage.getItem('token');
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            xhr.send(formData);
        });
    },
};