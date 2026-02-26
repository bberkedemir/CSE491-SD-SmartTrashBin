import { useEffect, useRef, useState, useCallback } from 'react';
import { Box } from '@mui/material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

import MapContainer from './components/Map/MapContainer';
import NotificationSnackbar from './components/Notification/NotificationSnackbar';
import Sidebar from './components/Sidebar/Sidebar';
import { useBins } from './hooks/useBins';
import { useRouteOptimization } from './hooks/useRouteOptimization';
import { binApi } from './api/binApi';
import type { AppNotification } from './types/bin';

const App: React.FC = () => {
  const { bins, fetchBins, createBin, deleteBin } = useBins();
  const [isAddMode, setIsAddMode] = useState(false);
  const [notification, setNotification] = useState<AppNotification>({
    open: false,
    message: '',
    severity: 'info',
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + Math.random() * 20, 90));
    }, 200);

    try {
      const msg = await binApi.importBins(file);
      clearInterval(progressInterval);
      setUploadProgress(100);

      setNotification({
        open: true,
        message: msg || 'File imported successfully!',
        severity: 'success',
      });
      fetchBins(); // Refresh map
    } catch (error: any) {
      clearInterval(progressInterval);
      console.error('Upload Error:', error);
      setNotification({
        open: true,
        message: 'Failed to import bins',
        severity: 'error',
      });
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Fetch bins on mount
  useEffect(() => {
    fetchBins();
  }, [fetchBins]);

  return (
    <>
      <Sidebar
        isAddMode={isAddMode}
        onToggleAddMode={() => setIsAddMode(prev => !prev)}
        onUploadFile={handleUploadClick}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        isOptimizing={isOptimizing}
        isRouteActive={isRouteActive}
        onOptimizeRoute={() => optimizeRoute()}
        onClearRoute={clearRoute}
        routeMetrics={routeMetrics}
      />

      <Box sx={{ height: '100vh', width: '100vw', paddingLeft: '60px', boxSizing: 'border-box' }}>
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

      {/* Hidden file input for file selection via Sidebar upload button */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />



      <NotificationSnackbar
        notification={notification}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
      />
    </>
  );
};

export default App;