import { useEffect } from 'react';
import L from 'leaflet';
import { Box } from '@mui/material';
import type { BinPoint, NewBinData, RouteStop } from '../../types/bin';
import { useMapMarkers } from './useMapMarkers';

interface MapContainerProps {
    bins: BinPoint[];
    routeStops: RouteStop[] | null;
    isAddMode: boolean;
    onCreateBin: (data: NewBinData) => Promise<BinPoint>;
    onDeleteBin: (id: number) => Promise<void>;
    onMapReady: (map: L.Map) => void;
    onExitAddMode: () => void;
}

const MapContainer: React.FC<MapContainerProps> = ({
    bins,
    routeStops,
    isAddMode,
    onCreateBin,
    onDeleteBin,
    onMapReady,
    onExitAddMode,
}) => {
    const mapRef = useMapMarkers(bins, routeStops, isAddMode, onCreateBin, onDeleteBin, onExitAddMode);

    // Tell parent when map is ready so route optimization can use it
    useEffect(() => {
        if (mapRef.current) {
            onMapReady(mapRef.current);
        }
    }, [mapRef.current, onMapReady]);

    return <Box id="map" sx={{ height: '100%', width: '100%' }} />;
};

export default MapContainer;