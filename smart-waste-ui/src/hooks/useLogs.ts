import { useState, useCallback } from 'react';
import { logsApi } from '../api/logsApi';

export function useLogs() {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchLogs = useCallback(async (skip = 0, limit = 50) => {
        setLoading(true);
        try {
            const data = await logsApi.fetchAll(skip, limit);
            setLogs(data.logs);
            setTotal(data.total);
        } finally {
            setLoading(false);
        }
    }, []);

    return { logs, total, loading, fetchLogs };
}
