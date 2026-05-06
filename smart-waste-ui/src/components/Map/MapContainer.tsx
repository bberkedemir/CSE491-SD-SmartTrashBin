import { useEffect } from 'react';
import L from 'leaflet';
import { Box } from '@mui/material';
import type { BinPoint, NewBinData, RouteStop, DriverSession } from '../../types/bin';
import { useMapMarkers } from './useMapMarkers';

interface MapContainerProps {
    bins: BinPoint[];
    routeStops: RouteStop[] | null;
    isAddMode: boolean;
    truckPosition: [number, number];
    onTruckMove: (lat: number, lng: number) => void;
    onCreateBin: (data: NewBinData) => Promise<BinPoint>;
    onDeleteBin: (id: number) => Promise<void>;
    onCollectBin: (id: number) => Promise<void>;
    onThrowTrash: (id: number) => Promise<void>;
    onMapReady: (map: L.Map) => void;
    onExitAddMode: () => void;
    driverSessions?: DriverSession[];
    getDriverColor?: (driverId: number) => string;
}

const MapContainer: React.FC<MapContainerProps> = ({
    bins,
    routeStops,
    isAddMode,
    truckPosition,
    onTruckMove,
    onCreateBin,
    onDeleteBin,
    onCollectBin,
    onThrowTrash,
    onMapReady,
    onExitAddMode,
    driverSessions,
    getDriverColor,
}) => {
    const mapRef = useMapMarkers(bins, routeStops, isAddMode, truckPosition, onTruckMove, onCreateBin, onDeleteBin, onCollectBin, onThrowTrash, onExitAddMode, driverSessions, getDriverColor);

    // Tell parent when map is ready so route optimization can use it
    useEffect(() => {
        if (mapRef.current) {
            onMapReady(mapRef.current);
        }
    }, [mapRef.current, onMapReady]);

    return <Box id="map" sx={{ height: '100%', width: '100%' }} />;
};

export default MapContainer;