import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Button } from '@mui/material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

import MapContainer from './components/Map/MapContainer';
import FileUpload from './components/Upload/FileUpload';
import NotificationSnackbar from './components/Notification/NotificationSnackbar';
import RouteMetricsPanel from './components/Map/RouteMetricsPanel';
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
  const [showMetrics, setShowMetrics] = useState(false);

  const handleExitAddMode = useCallback(() => {
    setIsAddMode(false);
  }, []);

  // Shared map ref — filled by MapContainer, used by useRouteOptimization
  const mapRef = useRef<L.Map | null>(null);

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
  }, []);

  const { routeStops, routeMetrics, isOptimizing, isRouteActive, optimizeRoute, clearRoute } = useRouteOptimization(
    mapRef,
    setNotification
  );

  // Auto-show when route is generated
  useEffect(() => {
    if (routeMetrics) {
      setShowMetrics(true);
    }
  }, [routeMetrics]);

  const handleRouteButtonClick = () => {
    if (isRouteActive) {
      clearRoute();           // route exists → clear it
      setShowMetrics(false);
    } else {
      optimizeRoute();        // no route → generate one
    }
  };

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
          onExitAddMode={handleExitAddMode}
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
          bgcolor: isRouteActive ? '#e74c3c' : '#9b59b6',
          color: '#ffffff',
          fontWeight: 600,
          fontSize: '14px',
          borderRadius: '8px',
          textTransform: 'none',
          boxShadow: isRouteActive
            ? '0 4px 12px rgba(231, 76, 60, 0.4)'
            : '0 4px 12px rgba(155, 89, 182, 0.4)',
          transition: 'all 0.3s ease',
          '&:hover': {
            bgcolor: isRouteActive ? '#c0392b' : '#8e44ad',
            transform: 'translateY(-2px)',
            boxShadow: isRouteActive
              ? '0 6px 16px rgba(231, 76, 60, 0.5)'
              : '0 6px 16px rgba(155, 89, 182, 0.5)',
          },
          '&:active': { transform: 'translateY(0px)' },
          '&:disabled': {
            bgcolor: '#b3b3b3',
            color: '#f0f0f0',
            boxShadow: 'none',
          },
        }}
        onClick={handleRouteButtonClick}
        disabled={isOptimizing}
      >
        {isOptimizing
          ? 'Optimizing...'
          : isRouteActive
            ? '✕ Clear Route'
            : '⚡ Optimize Route'
        }
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

      {showMetrics && routeMetrics && (
        <RouteMetricsPanel
          metrics={routeMetrics}
          onClose={() => setShowMetrics(false)}
        />
      )}
    </>
  );
};

export default App;