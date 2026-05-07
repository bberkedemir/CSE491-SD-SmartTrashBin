import { useCallback, useState } from 'react';
import { anomalyApi } from '../api/anomalyApi';
import type { RoadAnomaly, RoadAnomalyStatus } from '../types/bin';

export function useRoadAnomalies() {
    const [roadAnomalies, setRoadAnomalies] = useState<RoadAnomaly[]>([]);

    const fetchRoadAnomalies = useCallback(async () => {
        try {
            const data = await anomalyApi.fetchMapAnomalies();
            setRoadAnomalies(data.filter(item => item.latitude !== null && item.longitude !== null));
        } catch (error) {
            console.error('Error fetching road anomalies:', error);
        }
    }, []);

    const deleteRoadAnomaly = useCallback(async (id: number) => {
        await anomalyApi.delete(id);
        setRoadAnomalies((items) => items.filter((item) => item.id !== id));
    }, []);

    const updateRoadAnomalyStatus = useCallback(async (id: number, status: RoadAnomalyStatus) => {
        const updated = await anomalyApi.updateStatus(id, status);
        setRoadAnomalies((items) => items.map((item) => item.id === id ? updated : item));
    }, []);

    return { roadAnomalies, fetchRoadAnomalies, deleteRoadAnomaly, updateRoadAnomalyStatus };
}
