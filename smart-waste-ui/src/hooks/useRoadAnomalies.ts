import { useCallback, useState } from 'react';
import { anomalyApi } from '../api/anomalyApi';
import type { RoadAnomaly } from '../types/bin';

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

    return { roadAnomalies, fetchRoadAnomalies };
}
