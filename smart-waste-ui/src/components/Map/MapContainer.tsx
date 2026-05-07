import { useEffect } from 'react';
import L from 'leaflet';
import { Box } from '@mui/material';
import type { BinPoint, NewBinData, RouteStop, DriverSession, RoadAnomaly } from '../../types/bin';
import { useMapMarkers } from './useMapMarkers';

interface MapContainerProps {
    bins: BinPoint[];
    roadAnomalies: RoadAnomaly[];
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
    threshold?: number;
}

const MapContainer: React.FC<MapContainerProps> = ({
    bins,
    roadAnomalies,
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
    threshold = 30,
}) => {
    const mapRef = useMapMarkers(bins, roadAnomalies, routeStops, isAddMode, truckPosition, onTruckMove, onCreateBin, onDeleteBin, onCollectBin, onThrowTrash, onExitAddMode, driverSessions, getDriverColor, threshold);

    // Tell parent when map is ready so route optimization can use it
    useEffect(() => {
        if (mapRef.current) {
            onMapReady(mapRef.current);
        }
    }, [mapRef.current, onMapReady]);

    return <Box id="map" sx={{ height: '100%', width: '100%' }} />;
};

export default MapContainer;
