import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Button } from '@mui/material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

import MapContainer from './components/Map/MapContainer';
import FileUpload from './components/Upload/FileUpload';
import NotificationSnackbar from './components/Notification/NotificationSnackbar';
import { useBins } from './hooks/useBins';
import { useRouteOptimization } from './hooks/useRouteOptimization';
import type { AppNotification } from './types/bin';

const App: React.FC = () => {
  const { bins, fetchBins, createBin, deleteBin } = useBins();
  const [isAddMode, setIsAddMode] = useState(false);
  const [notification, setNotification] = useState<AppNotification>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Shared map ref — filled by MapContainer, used by useRouteOptimization
  const mapRef = useRef<L.Map | null>(null);

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
  }, []);

  const { routeStops, isOptimizing, optimizeRoute } = useRouteOptimization(
    mapRef,
    setNotification
  );

  // Fetch bins on mount
  useEffect(() => {
    fetchBins();
  }, [fetchBins]);

  return (
    <>
      <Box sx={{ height: '100vh', width: '100vw' }}>
        <MapContainer
          bins={bins}
          routeStops={routeStops}
          isAddMode={isAddMode}
          onCreateBin={createBin}
          onDeleteBin={deleteBin}
          onMapReady={handleMapReady}
        />
      </Box>

      <FileUpload
        onUploadComplete={fetchBins}
        onNotification={setNotification}
      />

      {/* Optimize Route Button */}
      <Button
        sx={{
          position: 'absolute',
          bottom: 20,
          right: 170,
          width: '160px',
          height: '44px',
          zIndex: 1000,
          bgcolor: '#9b59b6',
          color: '#ffffff',
          fontWeight: 600,
          fontSize: '14px',
          borderRadius: '8px',
          textTransform: 'none',
          boxShadow: '0 4px 12px rgba(155, 89, 182, 0.4)',
          transition: 'all 0.3s ease',
          '&:hover': {
            bgcolor: '#8e44ad',
            transform: 'translateY(-2px)',
            boxShadow: '0 6px 16px rgba(155, 89, 182, 0.5)',
          },
          '&:active': { transform: 'translateY(0px)' },
          '&:disabled': {
            bgcolor: '#b3b3b3',
            color: '#f0f0f0',
            boxShadow: 'none',
          },
        }}
        onClick={() => optimizeRoute()}
        disabled={isOptimizing}
      >
        {isOptimizing ? 'Optimizing...' : '⚡ Optimize Route'}
      </Button>

      {/* Add Marker Toggle */}
      <Button
        sx={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          width: '140px',
          height: '44px',
          zIndex: 1000,
          bgcolor: isAddMode ? '#ff4757' : '#23a200',
          color: '#ffffff',
          fontWeight: 600,
          fontSize: '14px',
          borderRadius: '8px',
          textTransform: 'none',
          boxShadow: isAddMode
            ? '0 4px 12px rgba(255, 71, 87, 0.4)'
            : '0 4px 12px rgba(35, 162, 0, 0.4)',
          transition: 'all 0.3s ease',
          '&:hover': {
            bgcolor: isAddMode ? '#ff3838' : '#1f8f00',
            transform: 'translateY(-2px)',
            boxShadow: isAddMode
              ? '0 6px 16px rgba(255, 71, 87, 0.5)'
              : '0 6px 16px rgba(35, 162, 0, 0.5)',
          },
          '&:active': { transform: 'translateY(0px)' },
        }}
        onClick={() => setIsAddMode(prev => !prev)}
      >
        {isAddMode ? '✕ Cancel' : '+ Add Marker'}
      </Button>

      <NotificationSnackbar
        notification={notification}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
      />
    </>
  );
};

export default App;