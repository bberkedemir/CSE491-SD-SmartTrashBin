import type {
    AnomalyImportRequest,
    AnomalyImportResponse,
    RoadAnomaly,
    RoadAnomalyList,
    RoadAnomalyStatus,
} from '../types/bin';

const API_BASE = '/api/v1';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

const getAuthOnlyHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const relativeFilePath = (file: File): string => {
    return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
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

    async fetchLogs(skip = 0, limit = 20): Promise<RoadAnomalyList> {
        const response = await fetch(`${API_BASE}/anomalies/map?skip=${skip}&limit=${limit}`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to fetch anomaly logs');
        }
        return response.json() as Promise<RoadAnomalyList>;
    },

    async updateStatus(anomalyId: number, status: RoadAnomalyStatus): Promise<RoadAnomaly> {
        const response = await fetch(`${API_BASE}/anomalies/${anomalyId}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status }),
        });
        if (!response.ok) {
            throw new Error('Failed to update anomaly status');
        }
        return response.json() as Promise<RoadAnomaly>;
    },

    async delete(anomalyId: number): Promise<void> {
        const response = await fetch(`${API_BASE}/anomalies/${anomalyId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to delete anomaly');
        }
    },

    async importExisting(payload: AnomalyImportRequest): Promise<AnomalyImportResponse> {
        const response = await fetch(`${API_BASE}/anomalies/import-existing`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => null);
            throw new Error(error?.detail || 'Failed to import anomaly outputs');
        }
        return response.json() as Promise<AnomalyImportResponse>;
    },

    async importFolderFiles(files: File[], payload: Omit<AnomalyImportRequest, 'source_path'>): Promise<AnomalyImportResponse> {
        const formData = new FormData();
        files.forEach((file) => {
            formData.append('files', file, relativeFilePath(file));
            formData.append('relative_paths', relativeFilePath(file));
        });
        if (payload.driver_id) {
            formData.append('driver_id', String(payload.driver_id));
        }
        if (payload.session_id) {
            formData.append('session_id', payload.session_id);
        }
        formData.append('copy_images', String(payload.copy_images));

        const response = await fetch(`${API_BASE}/anomalies/import-folder`, {
            method: 'POST',
            headers: getAuthOnlyHeaders(),
            body: formData,
        });
        if (!response.ok) {
            const error = await response.json().catch(() => null);
            throw new Error(error?.detail || 'Failed to import selected folder');
        }
        return response.json() as Promise<AnomalyImportResponse>;
    },
};
