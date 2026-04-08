import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import 'leaflet-polylinedecorator';

import { Box, Button, LinearProgress, Snackbar, Alert } from "@mui/material";
import trashBin from "./assets/binRed.png";
import './App.css';

interface BinPoint {
  id: number;
  lat: number;
  lng: number;
  title: string;
  fill: number;
}

interface RouteStop {
  sequence: number;
  id: number;
  title: string;
  lat: number;
  lng: number;
  fill_level: number;
  type: string;
}

interface RouteResponse {
  generated_at: string;
  total_stops: number;
  total_distance_km: number;
  estimated_time_minutes: number;
  route_sequence: RouteStop[];
  route_geometry: number[][];
}

// Algorithm definitions
const ALGORITHMS = [
  { key: 'greedy', name: 'Greedy Nearest Neighbor', endpoint: '/api/v1/routes/optimize', color: '#3388ff' },
  { key: '2opt', name: 'NN + 2-opt', endpoint: '/api/v1/routes/optimize-2nd', color: '#ff6b35' },
  { key: 'oropt', name: 'NN + 2-opt + Or-Opt', endpoint: '/api/v1/routes/optimize-3rd', color: '#2ecc71' },
  { key: 'sa', name: 'Simulated Annealing', endpoint: '/api/v1/routes/optimize-4th', color: '#e74c3c' },
  { key: 'cw', name: 'Clarke-Wright Savings', endpoint: '/api/v1/routes/optimize-5th', color: '#9b59b6' },
];

interface CompareResult {
  algorithm: typeof ALGORITHMS[0];
  data: RouteResponse | null;
  executionTimeMs: number;
  error?: string;
}

const App: React.FC = () => {
  const mapRef = useRef<L.Map | null>(null);

  const greenIcon = L.icon({
    iconUrl: trashBin,
    shadowUrl: trashBin,
    iconSize: [40, 40],
    shadowSize: [0, 0],
    iconAnchor: [20, 40],
    shadowAnchor: [0, 0],
    popupAnchor: [-3, -76]
  });

  const numberedIcon = (number: any) => L.divIcon({
    className: "custom-number-icon",
    html: `<div class="marker-number">${number}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  const depotIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });



  const [points, setPoints] = useState<BinPoint[]>([]);
  const [routePolyline, setRoutePolyline] = useState<L.Polyline | null>(null);
  const [routeDecorator, setRouteDecorator] = useState<any | null>(null);
  const [routeStops, setRouteStops] = useState<RouteStop[] | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Algorithm comparison state
  const [showAlgoDropdown, setShowAlgoDropdown] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareResults, setCompareResults] = useState<CompareResult[]>([]);
  const [compareProgress, setCompareProgress] = useState('');
  const [isComparing, setIsComparing] = useState(false);
  const [activeRouteColor, setActiveRouteColor] = useState('#3388ff');

  // API functions
  const fetchBins = async () => {
    try {
      const response = await fetch('/api/v1/bins');
      if (!response.ok) throw new Error('Failed to fetch bins');
      const data = await response.json();
      setPoints(data.bins);
    } catch (error) {
      console.error('Error fetching bins:', error);
    }
  };

  const createBin = async (binData: Omit<BinPoint, 'id'>) => {
    try {
      const response = await fetch('/api/v1/bins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(binData),
      });
      if (!response.ok) throw new Error('Failed to create bin');
      const newBin = await response.json();
      setPoints(prev => [...prev, newBin]);
      return newBin;
    } catch (error) {
      console.error('Error creating bin:', error);
      throw error;
    }
  };

  const deleteBin = async (binId: number) => {
    try {
      const response = await fetch(`/api/v1/bins/${binId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete bin');
      setPoints(prev => prev.filter(bin => bin.id !== binId));
    } catch (error) {
      console.error('Error deleting bin:', error);
      throw error;
    }
  };

  // Clear route from map
  const clearRouteFromMap = useCallback(() => {
    if (routePolyline) {
      routePolyline.remove();
      setRoutePolyline(null);
    }
    if (routeDecorator) {
      routeDecorator.remove();
      setRouteDecorator(null);
    }
    if (routeStops) {
      setRouteStops(null);
    }
  }, [routePolyline, routeDecorator, routeStops]);

  // Draw route on map with specific color
  const drawRouteOnMap = useCallback((data: RouteResponse, color: string) => {
    // Clear previous
    clearRouteFromMap();

    let latlngs: L.LatLngExpression[] = [];

    if (data.route_geometry && data.route_geometry.length > 0) {
      latlngs = data.route_geometry as L.LatLngExpression[];
    } else if (data.route_sequence && data.route_sequence.length > 0) {
      latlngs = data.route_sequence.map((stop: RouteStop) => [stop.lat, stop.lng]);
    }

    if (latlngs.length > 0 && mapRef.current) {
      const polyline = L.polyline(latlngs, {
        color: color,
        weight: 5,
        opacity: 0.8,
        lineJoin: 'round'
      }).addTo(mapRef.current);

      const decorator = (L as any).polylineDecorator(polyline, {
        patterns: [
          {
            offset: '5%',
            repeat: '300px',
            symbol: (L as any).Symbol.arrowHead({
              pixelSize: 15,
              polygon: false,
              pathOptions: { stroke: true, color: color, weight: 3 }
            })
          }
        ]
      }).addTo(mapRef.current);
      setRouteDecorator(decorator);

      mapRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });
      setRoutePolyline(polyline);
      setRouteStops(data.route_sequence);
      setActiveRouteColor(color);
    }
  }, [clearRouteFromMap]);

  // Optimize route with specific algorithm
  const optimizeWithAlgorithm = async (algo: typeof ALGORITHMS[0]) => {
    setIsOptimizing(true);
    setShowAlgoDropdown(false);
    clearRouteFromMap();

    try {
      const response = await fetch(`${algo.endpoint}?threshold=30`);
      if (!response.ok) throw new Error('Failed to optimize route');

      const data: RouteResponse = await response.json();

      drawRouteOnMap(data, algo.color);

      setNotification({
        open: true,
        message: `${algo.name}: ${data.total_distance_km} km | ${data.estimated_time_minutes} min`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Optimization error:', error);
      setNotification({
        open: true,
        message: `Failed: ${algo.name}`,
        severity: 'error'
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  // Compare all algorithms
  const compareAllAlgorithms = async () => {
    setShowAlgoDropdown(false);
    setShowCompareModal(true);
    setIsComparing(true);
    setCompareResults([]);

    const results: CompareResult[] = [];

    for (let i = 0; i < ALGORITHMS.length; i++) {
      const algo = ALGORITHMS[i];
      setCompareProgress(`Running ${algo.name}... (${i + 1}/${ALGORITHMS.length})`);

      const startTime = performance.now();
      try {
        const response = await fetch(`${algo.endpoint}?threshold=30`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: RouteResponse = await response.json();
        const elapsed = Math.round(performance.now() - startTime);

        results.push({ algorithm: algo, data, executionTimeMs: elapsed });
      } catch (error: any) {
        const elapsed = Math.round(performance.now() - startTime);
        results.push({ algorithm: algo, data: null, executionTimeMs: elapsed, error: error.message });
      }

      // Update results progressively
      setCompareResults([...results]);
    }

    setIsComparing(false);
    setCompareProgress('');
  };

  // Upload functionality
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  const uploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setNotification({ open: false, message: '', severity: 'info' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 201) {
          const response = JSON.parse(xhr.responseText);
          setNotification({
            open: true,
            message: response.message,
            severity: response.results.skipped_count > 0 ? 'warning' : 'success'
          });
          fetchBins();
        } else {
          const error = JSON.parse(xhr.responseText);
          setNotification({
            open: true,
            message: error.detail || 'Upload failed',
            severity: 'error'
          });
        }
        setIsUploading(false);
        setUploadProgress(0);
      });

      xhr.addEventListener('error', () => {
        setNotification({
          open: true,
          message: 'Network error during upload',
          severity: 'error'
        });
        setIsUploading(false);
        setUploadProgress(0);
      });

      xhr.open('POST', '/api/v1/bins/upload');
      xhr.send(formData);

    } catch (error) {
      console.error('Upload error:', error);
      setNotification({
        open: true,
        message: 'Upload failed. Please try again.',
        severity: 'error'
      });
      setIsUploading(false);
      setUploadProgress(0);
    }

    event.target.value = '';
  };

  function addMarker(
    map: L.Map,
    data: BinPoint,
    icon: L.Icon,
    onDelete: (id: number, marker: L.Marker) => void
  ) {
    const marker = L.marker([data.lat, data.lng], { icon }).addTo(map);

    const popupHtml = `
      <div class="marker-popup">
        <div class="marker-popup-title">${data.title}</div>
        <div class="marker-popup-details">
          <div class="marker-popup-row">
            <span class="marker-popup-label">Latitude:</span>
            <span class="marker-popup-value">${data.lat.toFixed(5)}</span>
          </div>
          <div class="marker-popup-row">
            <span class="marker-popup-label">Longitude:</span>
            <span class="marker-popup-value">${data.lng.toFixed(5)}</span>
          </div>
          <div class="marker-popup-row">
            <span class="marker-popup-label">Dolu:</span>
            <span class="marker-popup-value">%${data.fill.toFixed(2)}</span>
          </div>
        </div>
        <button id="del-${data.id}" class="marker-delete-btn">
          🗑️ Sil
        </button>
      </div>
    `;

    marker.bindPopup(popupHtml);

    marker.on("popupopen", () => {
      const btn = document.getElementById(`del-${data.id}`);
      if (btn) {
        btn.onclick = () => {
          console.log("removed", data.id);
          onDelete(data.id, marker);
        };
      }
    });

    return marker;
  }

  // Leaflet init
  useEffect(() => {
    if (mapRef.current) return;

    mapRef.current = L.map("map").setView([36.89488259077369, 30.649857090761955], 13);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      minZoom: 16,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);

    fetchBins();
  }, []);

  // Update markers when points or routeStops change
  useEffect(() => {
    if (!mapRef.current) return;

    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        mapRef.current?.removeLayer(layer);
      }
    });

    if (routeStops && routeStops.length > 0) {
      routeStops.forEach(stop => {
        if (stop.type === 'start' || stop.type === 'end') {
          L.marker([stop.lat, stop.lng], { icon: depotIcon })
            .addTo(mapRef.current!)
            .bindPopup(`<b>Depot (Start/End)</b><br>${stop.title}`);
          return;
        }

        L.marker([stop.lat, stop.lng], { icon: numberedIcon(stop.sequence) })
          .addTo(mapRef.current!)
          .bindPopup(`<b>Stop #${stop.sequence}</b><br>${stop.title}<br>Fill: ${stop.fill_level}%`);
      });

    } else {
      points.forEach(p => {
        addMarker(
          mapRef.current!,
          {
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            title: p.title,
            fill: p.fill
          }, greenIcon, (binId, marker) => {
            deleteBin(binId);
            marker.removeFrom(mapRef.current!);
          }
        );
      });
    }

  }, [points, routeStops]);

  const [isAddMode, setIsAddMode] = useState(false);

  // new marker
  useEffect(() => {
    if (!mapRef.current) return;

    const popup = L.popup();

    const onMapClick = (e: L.LeafletMouseEvent) => {
      console.log(isAddMode);
      if (!isAddMode) return;
      popup
        .setLatLng(e.latlng)
        .setContent(`
          <div class="popup-container">
            <div class="popup-coords">
              📍 ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}
            </div>

            <div class="popup-field">
              <label class="popup-label">Marker İsmi</label>
              <input 
                id="addTitle" 
                type="text" 
                placeholder="Başlık girin..."
                class="popup-input"
              />
            </div>

            <button id="addMarkerBtn" class="popup-button">
              ✓ Marker Ekle
            </button>
          </div>
        `)
        .openOn(mapRef.current!);

      setTimeout(() => {
        const addButton = document.getElementById("addMarkerBtn");
        if (!addButton) return;

        addButton.onclick = async () => {
          const input = document.getElementById("addTitle") as HTMLInputElement | null;
          const markerTitle = input?.value || "Untitled Marker";
          const newMarkerData = {
            lat: e.latlng.lat,
            lng: e.latlng.lng,
            title: markerTitle,
            fill: Math.floor(Math.random() * 101)
          };

          try {
            await createBin(newMarkerData);
            console.log(`added new marker title: ${newMarkerData.title}`);
            popup.close();
          } catch (error) {
            console.error('Failed to create bin:', error);
            alert('Failed to create bin. Please try again.');
          }
        };
      });
    };

    mapRef.current.on("click", onMapClick);

    return () => {
      mapRef.current?.off("click", onMapClick);
      popup.off("add");
    };
  }, [isAddMode, createBin]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showAlgoDropdown) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.algo-dropdown-wrapper')) {
        setShowAlgoDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showAlgoDropdown]);

  // Find best result
  const bestResult = compareResults.length > 0
    ? compareResults.reduce((best, r) => {
      if (!r.data) return best;
      if (!best || !best.data) return r;
      return r.data.total_distance_km < best.data.total_distance_km ? r : best;
    }, null as CompareResult | null)
    : null;

  return (
    <>
      <Box sx={{ height: "100vh", width: "100vw" }}>
        <Box id="map" sx={{ height: "100%", width: "100%" }} />
      </Box>

      {/* Hidden file input for upload */}
      <input
        type="file"
        accept=".json,.txt,.csv"
        onChange={uploadFile}
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

      {/* Optimize Route Button with Dropdown */}
      <Box
        className="algo-dropdown-wrapper"
        sx={{
          position: 'absolute',
          bottom: 20,
          right: 170,
          zIndex: 1000,
        }}
      >
        {/* Dropdown Menu */}
        {showAlgoDropdown && (
          <div className="algo-dropdown">
            {ALGORITHMS.map((algo) => (
              <button
                key={algo.key}
                className="algo-dropdown-item"
                onClick={() => optimizeWithAlgorithm(algo)}
              >
                <span className="algo-dot" style={{ backgroundColor: algo.color }} />
                {algo.name}
              </button>
            ))}
            <div className="algo-dropdown-divider" />
            <button
              className="algo-dropdown-item compare-all"
              onClick={compareAllAlgorithms}
            >
              🔬 Compare All
            </button>
          </div>
        )}

        <Button
          sx={{
            width: "160px",
            height: "44px",
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
          onClick={() => setShowAlgoDropdown(!showAlgoDropdown)}
          disabled={isOptimizing}
        >
          {isOptimizing ? "Optimizing..." : "⚡ Optimize ▾"}
        </Button>
      </Box>

      {/* ============ Compare All Modal ============ */}
      {showCompareModal && (
        <div className="compare-overlay" onClick={(e) => {
          if ((e.target as HTMLElement).classList.contains('compare-overlay') && !isComparing) {
            setShowCompareModal(false);
          }
        }}>
          <div className="compare-modal">
            <h2>🔬 Algorithm Comparison</h2>
            <p className="subtitle">All algorithms tested with threshold=30 on the same bin data</p>

            {isComparing && compareResults.length === 0 ? (
              <div className="compare-loading">
                <div className="spinner" />
                <p>Running algorithms...</p>
                <p className="progress-text">{compareProgress}</p>
              </div>
            ) : (
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Algorithm</th>
                    <th>Distance</th>
                    <th>Time</th>
                    <th>Stops</th>
                    <th>Exec.</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {compareResults.map((result) => {
                    const isBest = bestResult && result.algorithm.key === bestResult.algorithm.key && result.data;
                    return (
                      <tr
                        key={result.algorithm.key}
                        className={isBest && !isComparing ? 'best-row' : ''}
                      >
                        <td>
                          <div className="algo-name-cell">
                            <span className="algo-dot" style={{ backgroundColor: result.algorithm.color }} />
                            {result.algorithm.name}
                            {isBest && !isComparing && <span className="best-badge">BEST</span>}
                          </div>
                        </td>
                        <td className="distance-cell">
                          {result.data ? `${result.data.total_distance_km} km` : result.error ? '❌' : '...'}
                        </td>
                        <td>
                          {result.data ? `${result.data.estimated_time_minutes} min` : '-'}
                        </td>
                        <td>
                          {result.data ? result.data.total_stops : '-'}
                        </td>
                        <td>
                          {result.executionTimeMs}ms
                        </td>
                        <td>
                          {result.data && (
                            <button
                              className="show-btn"
                              onClick={() => {
                                drawRouteOnMap(result.data!, result.algorithm.color);
                                setShowCompareModal(false);
                                setNotification({
                                  open: true,
                                  message: `Showing: ${result.algorithm.name} — ${result.data!.total_distance_km} km`,
                                  severity: 'info'
                                });
                              }}
                            >
                              Show ➜
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {isComparing && compareResults.length < ALGORITHMS.length && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: '#888', padding: '12px' }}>
                        {compareProgress}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            <div className="compare-modal-footer">
              <button
                className="compare-close-btn"
                onClick={() => setShowCompareModal(false)}
                disabled={isComparing}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{
          zIndex: 2000,
        }}
      >
        <Alert
          onClose={() => setNotification(prev => ({ ...prev, open: false }))}
          severity={notification.severity}
          sx={{
            minWidth: '300px',
            fontSize: '14px',
          }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default App;