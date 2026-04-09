import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Button, LinearProgress, Menu, MenuItem } from '@mui/material';
import MapContainer from '../../components/Map/MapContainer';
import NotificationSnackbar from '../../components/Notification/NotificationSnackbar';
import { useBins } from '../../hooks/useBins';
import { useRouteOptimization } from '../../hooks/useRouteOptimization';
import { calculateDistanceMeters } from '../../utils/geoUtils';
import { binApi } from '../../api/binApi';
import type { AppNotification } from '../../types/bin';
import AlgorithmComparisonModal from '../../components/Map/AlgorithmComparisonModal';

const RoutingPage: React.FC = () => {
  const { bins, fetchBins, createBin, deleteBin, collectBin, throwTrash, simulateTime, exportData } = useBins();
  const [isAddMode, setIsAddMode] = useState(false);
  // Default truck position set to roughly Campus Gate
  const [truckPosition, setTruckPosition] = useState<[number, number]>([36.892539, 30.663895]);
  const [lastUpdatePosition, setLastUpdatePosition] = useState<[number, number] | null>(null);
  const [notification, setNotification] = useState<AppNotification>({
    open: false,
    message: '',
    severity: 'info',
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Menu State
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);
  const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const [optimizeAnchorEl, setOptimizeAnchorEl] = useState<null | HTMLElement>(null);
  const openOptimizeMenu = Boolean(optimizeAnchorEl);
  const handleOptimizeMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setOptimizeAnchorEl(event.currentTarget);
  };
  const handleOptimizeMenuClose = () => {
    setOptimizeAnchorEl(null);
  };

  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  const handleExitAddMode = useCallback(() => {
    setIsAddMode(false);
  }, []);

  const mapRef = useRef<L.Map | null>(null);

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
  }, []);

  const { routeStops, routeMetrics, isOptimizing, isRouteActive, optimizeRoute, clearRoute, updateTruckPositionOnRoute } = useRouteOptimization(
    mapRef,
    setNotification
  );

  // Role-based rendering
  const userStr = localStorage.getItem('user');
  const isAdmin = userStr ? JSON.parse(userStr)?.role === 'admin' : false;

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

  // Effect: Recalculate route if truck moves more than 10 meters locally
  useEffect(() => {
    if (!isRouteActive || !lastUpdatePosition || isOptimizing) return;

    const [lastLat, lastLng] = lastUpdatePosition;
    const [currLat, currLng] = truckPosition;

    const distance = calculateDistanceMeters(lastLat, lastLng, currLat, currLng);

    // If moved more than 10 meters, redraw locally!
    if (distance > 10) {
      updateTruckPositionOnRoute(currLat, currLng);
      setLastUpdatePosition([currLat, currLng]);
    }
  }, [truckPosition, isRouteActive, lastUpdatePosition, isOptimizing, updateTruckPositionOnRoute]);

  const getFillColor = (fillLevel: number) => {
    if (fillLevel >= 80) return '#ff4757';
    if (fillLevel >= 50) return '#ffa502';
    return '#2ed573';
  };

  return (
    <>
      <Box sx={{ height: '100vh', width: '100%' }}>
        <Box style={{ position: 'absolute', top: 20, right: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Button
            variant="contained"
            onClick={simulateTime}
            sx={{
              bgcolor: "#283930",
              color: "#F5F7F3",
              fontWeight: 600,
              textTransform: "none",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(40, 57, 48, 0.4)",
              '&:hover': {
                bgcolor: "#1d2a23",
              }
            }}
          >
            Simulate 12 Hours
          </Button>
        </Box>
        <MapContainer
          bins={bins}
          routeStops={routeStops}
          isAddMode={isAddMode}
          truckPosition={truckPosition}
          onTruckMove={(lat, lng) => setTruckPosition([lat, lng])}
          onCreateBin={createBin}
          onDeleteBin={deleteBin}
          onCollectBin={collectBin}
          onThrowTrash={throwTrash}
          onMapReady={handleMapReady}
          onExitAddMode={handleExitAddMode}
        />
      </Box>

      {/* Hidden file input + Upload File Button + Add Marker — Admin only */}
      {isAdmin && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="file-upload-input"
          />

          {/* Consolidated Data Options Button */}
          <Button
            variant="contained"
            onClick={handleMenuClick}
            disabled={isUploading}
            sx={{
              position: 'absolute',
              bottom: 70,
              right: 20,
              width: "140px",
              height: "44px",
              zIndex: 1000,
              bgcolor: "#E1DACD",
              color: "#283930",
              fontWeight: 600,
              fontSize: "14px",
              borderRadius: "8px",
              textTransform: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              transition: "all 0.3s ease",
              '&:hover': {
                bgcolor: "#d1c9bb",
                transform: "translateY(-2px)",
                boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
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
            {isUploading ? `Uploading ${Math.round(uploadProgress)}%` : "Manage Data"}
          </Button>

          {/* Data Options Dropdown Menu */}
          <Menu
            anchorEl={anchorEl}
            open={openMenu}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            sx={{ zIndex: 1001 }}
          >
            <MenuItem onClick={() => { handleMenuClose(); setTimeout(() => exportData('json'), 0); }}>
              <span style={{ marginRight: '8px' }}>📥</span> Export JSON
            </MenuItem>
            <MenuItem onClick={() => { handleMenuClose(); setTimeout(() => exportData('csv'), 0); }}>
              <span style={{ marginRight: '8px' }}>📥</span> Export CSV
            </MenuItem>
            <MenuItem onClick={() => { handleMenuClose(); setTimeout(() => fileInputRef.current?.click(), 0); }}>
              <span style={{ marginRight: '8px' }}>📤</span> Import File...
            </MenuItem>
          </Menu>

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
              bgcolor: isAddMode ? "#ff4757" : "#CCDCC9",
              color: isAddMode ? "#ffffff" : "#283930",
              fontWeight: 600,
              fontSize: "14px",
              borderRadius: "8px",
              textTransform: "none",
              boxShadow: isAddMode
                ? "0 4px 12px rgba(255, 71, 87, 0.4)"
                : "0 4px 12px rgba(0,0,0,0.1)",
              transition: "all 0.3s ease",
              '&:hover': {
                bgcolor: isAddMode ? "#ff3838" : "#b9cebd",
                transform: "translateY(-2px)",
                boxShadow: isAddMode
                  ? "0 6px 16px rgba(255, 71, 87, 0.5)"
                  : "0 6px 16px rgba(0,0,0,0.15)",
              },
              '&:active': {
                transform: "translateY(0px)",
              }
            }}
            onClick={() => setIsAddMode(!isAddMode)}
          >
            {isAddMode ? "✕ Cancel" : "+ Add Marker"}
          </Button>
        </>
      )}

      {/* Optimize Route Split Button */}
      <Box sx={{
        position: 'absolute',
        bottom: 20,
        right: 170,
        zIndex: 1000,
        display: 'flex'
      }}>
        <Button
          sx={{
            width: "140px",
            height: "44px",
            bgcolor: "#E1DACD",
            color: "#283930",
            fontWeight: 600,
            fontSize: "14px",
            borderTopLeftRadius: "8px",
            borderBottomLeftRadius: "8px",
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
            textTransform: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            transition: "all 0.3s ease",
            '&:hover': {
              bgcolor: "#d1c9bb",
              boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
            },
            '&:disabled': { bgcolor: "#b3b3b3", color: "#f0f0f0", boxShadow: "none" }
          }}
          onClick={async () => {
            if (isRouteActive) {
                clearRoute();
            } else {
                const success = await optimizeRoute(30, truckPosition[0], truckPosition[1], 'default');
                if (success) {
                    setLastUpdatePosition(truckPosition);
                }
            }
          }}
          disabled={isOptimizing}
        >
          {isOptimizing ? "Optimizing..." : isRouteActive ? "✕ Clear Route" : "Optimize Route"}
        </Button>
        <Button
          size="small"
          aria-controls={openOptimizeMenu ? 'split-button-menu' : undefined}
          aria-expanded={openOptimizeMenu ? 'true' : undefined}
          aria-label="select optimization algorithm"
          aria-haspopup="menu"
          onClick={handleOptimizeMenuClick}
          disabled={isOptimizing || isRouteActive}
          sx={{
            minWidth: "30px",
            height: "44px",
            bgcolor: "#E1DACD",
            color: "#283930",
            borderTopRightRadius: "8px",
            borderBottomRightRadius: "8px",
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            borderLeft: "1px solid rgba(40, 57, 48, 0.2)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            '&:hover': {
              bgcolor: "#d1c9bb",
            },
            '&:disabled': { bgcolor: "#9e9e9e", color: "#f0f0f0", boxShadow: "none" }
          }}
        >
          ▼
        </Button>
      </Box>

      {/* Optimize Menu */}
      <Menu
        id="split-button-menu"
        anchorEl={optimizeAnchorEl}
        open={openOptimizeMenu}
        onClose={handleOptimizeMenuClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        sx={{ zIndex: 1001 }}
      >
        <MenuItem onClick={() => { 
          handleOptimizeMenuClose(); 
          setTimeout(async () => {
            const success = await optimizeRoute(30, truckPosition[0], truckPosition[1], 'default');
            if (success) setLastUpdatePosition(truckPosition);
          }, 0);
        }}>
          NN + 2-opt + Or-Opt (Best)
        </MenuItem>
        <MenuItem onClick={() => { 
          handleOptimizeMenuClose(); 
          setTimeout(async () => {
            const success = await optimizeRoute(30, truckPosition[0], truckPosition[1], 'greedy');
            if (success) setLastUpdatePosition(truckPosition);
          }, 0);
        }}>
          Greedy Nearest Neighbor
        </MenuItem>
        <MenuItem onClick={() => { 
          handleOptimizeMenuClose(); 
          setTimeout(() => setIsCompareModalOpen(true), 0); 
        }}>
          Compare Algorithms
        </MenuItem>
      </Menu>

      <AlgorithmComparisonModal
        open={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        threshold={30}
        startLat={truckPosition[0]}
        startLng={truckPosition[1]}
      />

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