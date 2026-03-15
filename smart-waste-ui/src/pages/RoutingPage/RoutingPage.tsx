import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Button, LinearProgress } from '@mui/material';
import MapContainer from '../../components/Map/MapContainer';
import NotificationSnackbar from '../../components/Notification/NotificationSnackbar';
import { useBins } from '../../hooks/useBins';
import { useRouteOptimization } from '../../hooks/useRouteOptimization';
import { binApi } from '../../api/binApi';
import type { AppNotification } from '../../types/bin';

const RoutingPage: React.FC = () => {
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

  const mapRef = useRef<L.Map | null>(null);

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
  }, []);

  const { routeStops, routeMetrics, isOptimizing, isRouteActive, optimizeRoute, clearRoute } = useRouteOptimization(
    mapRef,
    setNotification
  );

  const [showMetrics, setShowMetrics] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

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
      fetchBins();
    } catch (error: unknown) {
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

  useEffect(() => {
    fetchBins();
  }, [fetchBins]);

  const getFillColor = (fillLevel: number) => {
    if (fillLevel >= 80) return '#ff4757';
    if (fillLevel >= 50) return '#ffa502';
    return '#2ed573';
  };

  return (
    <>
      <Box sx={{ height: '100vh', width: '100%' }}>
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

      {/* Floating Buttons */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        id="file-upload-input"
      />

      {/* Upload File Button */}
      <Button
        variant="contained"
        component="label"
        htmlFor="file-upload-input"
        disabled={isUploading}
        sx={{
          position: 'absolute',
          bottom: 70,
          right: 20,
          width: "140px",
          height: "44px",
          zIndex: 1000,
          bgcolor: "#007bff",
          color: "#ffffff",
          fontWeight: 600,
          fontSize: "14px",
          borderRadius: "8px",
          textTransform: "none",
          boxShadow: "0 4px 12px rgba(0, 123, 255, 0.3)",
          transition: "all 0.3s ease",
          '&:hover': {
            bgcolor: "#0056b3",
            transform: "translateY(-2px)",
            boxShadow: "0 6px 16px rgba(0, 123, 255, 0.4)",
          },
          '&:active': {
            transform: "translateY(0px)",
          },
          '&:disabled': {
            bgcolor: "#6c757d",
            color: "#ffffff",
            boxShadow: "none",
          }
        }}
      >
        {isUploading ? `Uploading ${Math.round(uploadProgress)}%` : "Upload File"}
      </Button>

      {/* Progress Bar */}
      {isUploading && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 120,
            right: 20,
            left: 20,
            zIndex: 999,
          }}
        >
          <LinearProgress
            variant="determinate"
            value={uploadProgress}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#007bff',
                borderRadius: 3,
              }
            }}
          />
        </Box>
      )}

      {/* Add Marker Button */}
      <Button
        sx={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          width: "140px",
          height: "44px",
          zIndex: 1000,
          bgcolor: isAddMode ? "#ff4757" : "#23a200",
          color: "#ffffff",
          fontWeight: 600,
          fontSize: "14px",
          borderRadius: "8px",
          textTransform: "none",
          boxShadow: isAddMode
            ? "0 4px 12px rgba(255, 71, 87, 0.4)"
            : "0 4px 12px rgba(35, 162, 0, 0.4)",
          transition: "all 0.3s ease",
          '&:hover': {
            bgcolor: isAddMode ? "#ff3838" : "#1f8f00",
            transform: "translateY(-2px)",
            boxShadow: isAddMode
              ? "0 6px 16px rgba(255, 71, 87, 0.5)"
              : "0 6px 16px rgba(35, 162, 0, 0.5)",
          },
          '&:active': {
            transform: "translateY(0px)",
          }
        }}
        onClick={() => setIsAddMode(!isAddMode)}
      >
        {isAddMode ? "✕ Cancel" : "+ Add Marker"}
      </Button>

      {/* Optimize Route Button */}
      <Button
        sx={{
          position: 'absolute',
          bottom: 20,
          right: 170,
          width: "160px",
          height: "44px",
          zIndex: 1000,
          bgcolor: "#9b59b6",
          color: "#ffffff",
          fontWeight: 600,
          fontSize: "14px",
          borderRadius: "8px",
          textTransform: "none",
          boxShadow: "0 4px 12px rgba(155, 89, 182, 0.4)",
          transition: "all 0.3s ease",
          '&:hover': {
            bgcolor: "#8e44ad",
            transform: "translateY(-2px)",
            boxShadow: "0 6px 16px rgba(155, 89, 182, 0.5)",
          },
          '&:active': {
            transform: "translateY(0px)",
          },
          '&:disabled': {
            bgcolor: "#b3b3b3",
            color: "#f0f0f0",
            boxShadow: "none"
          }
        }}
        onClick={() => isRouteActive ? clearRoute() : optimizeRoute()}
        disabled={isOptimizing}
      >
        {isOptimizing ? "Optimizing..." : isRouteActive ? "✕ Clear Route" : "Optimize Route"}
      </Button>

      <NotificationSnackbar
        notification={notification}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
      />

      {/* Metrics Panel (Visible only when active route) */}
      {isRouteActive && routeMetrics && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 20,
            left: 80,
            zIndex: 1000,
          }}
        >
          <Button
            variant="contained"
            onClick={() => setShowMetrics(!showMetrics)}
            sx={{
              width: "90px",
              height: "44px",
              zIndex: 1000,
              bgcolor: showMetrics ? "#ff4757" : "#23a200",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "14px",
              borderRadius: "8px",
              textTransform: "none",
              boxShadow: showMetrics
                ? "0 4px 12px rgba(255, 71, 87, 0.4)"
                : "0 4px 12px rgba(35, 162, 0, 0.4)",
              transition: "all 0.3s ease",
              '&:hover': {
                bgcolor: showMetrics ? "#ff3838" : "#1f8f00",
                transform: "translateY(-2px)",
                boxShadow: showMetrics
                  ? "0 6px 16px rgba(255, 71, 87, 0.5)"
                  : "0 6px 16px rgba(35, 162, 0, 0.5)",
              },
              '&:active': {
                transform: "translateY(0px)",
              }
            }}
          >
            {showMetrics ? "Hide" : "Show"}
          </Button>

          {showMetrics && (
            <Box
              sx={{
                position: 'absolute',
                bottom: '54px',
                left: 0,
                width: '280px',
                bgcolor: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                p: 2,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 2 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Box sx={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>
                    {routeMetrics.totalDistanceKm.toFixed(1)}
                  </Box>
                  <Box sx={{ fontSize: '12px', color: '#666' }}>km</Box>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Box sx={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>
                    {Math.round(routeMetrics.estimatedTimeMinutes)}
                  </Box>
                  <Box sx={{ fontSize: '12px', color: '#666' }}>min</Box>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Box sx={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>
                    {routeMetrics.totalStops}
                  </Box>
                  <Box sx={{ fontSize: '12px', color: '#666' }}>stops</Box>
                </Box>
              </Box>

              <Box sx={{ maxHeight: '200px', overflowY: 'auto' }}>
                {routeMetrics.stops.map((stop, i) => (
                  <Box
                    key={stop.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 0.5,
                      px: 1,
                      borderRadius: '4px',
                      '&:hover': { bgcolor: '#f5f5f5' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          bgcolor: getFillColor(stop.fill_level),
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}
                      >
                        {i + 1}
                      </Box>
                      <Box sx={{ fontSize: '13px', color: '#333' }}>{stop.title}</Box>
                    </Box>
                    <Box sx={{ fontSize: '13px', color: '#666' }}>{stop.fill_level}%</Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </>
  );
};

export default RoutingPage;
