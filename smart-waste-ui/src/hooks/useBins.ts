import { useState, useCallback } from 'react';
import type { BinPoint, NewBinData } from '../types/bin';
import { binApi } from '../api/binApi';

export function useBins() {
    const [bins, setBins] = useState<BinPoint[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchBins = useCallback(async () => {
        setLoading(true);
        try {
            const data = await binApi.fetchAll();
            setBins(data);
        } catch (error) {
            console.error('Error fetching bins:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const createBin = useCallback(async (binData: NewBinData): Promise<BinPoint> => {
        const newBin = await binApi.create(binData);
        setBins(prev => [...prev, newBin]);
        return newBin;
    }, []);

    const deleteBin = useCallback(async (binId: number) => {
        await binApi.delete(binId);
        setBins(prev => prev.filter(bin => bin.id !== binId));
    }, []);

    return { bins, loading, fetchBins, createBin, deleteBin };
}