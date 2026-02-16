import { useEffect, useRef, useState } from "react";
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

  const optimizeRoute = async () => {
    setIsOptimizing(true);
    // clear previous route
    if (routePolyline) {
      routePolyline.remove();
      setRoutePolyline(null);
    }
    if (routeDecorator) {
      routeDecorator.remove();
      setRouteDecorator(null);
    }
    // We update markers via state now, so no need to manually remove depotMarker here
    if (routeStops) {
      setRouteStops(null);
    }

    try {
      const response = await fetch('/api/v1/routes/optimize?threshold=30'); // using 30 for demo purposes
      if (!response.ok) throw new Error('Failed to optimize route');

      const data: RouteResponse = await response.json();

      // Use geometry if available, otherwise fallback to sequence (straight lines)
      let latlngs: L.LatLngExpression[] = [];

      if (data.route_geometry && data.route_geometry.length > 0) {
        // Backend already returns [lat, lng]
        latlngs = data.route_geometry as L.LatLngExpression[];
      } else if (data.route_sequence && data.route_sequence.length > 0) {
        latlngs = data.route_sequence.map((stop: RouteStop) => [stop.lat, stop.lng]);
      }

      if (latlngs.length > 0) {
        // Draw polyline
        if (mapRef.current) {
          const polyline = L.polyline(latlngs, {
            color: '#3388ff', // Leaflet default blue
            weight: 5,
            opacity: 0.8,
            lineJoin: 'round'
          }).addTo(mapRef.current);

          // Add arrows with polyline decorator
          const decorator = (L as any).polylineDecorator(polyline, {
            patterns: [
              {
                offset: '5%',
                repeat: '300px',
                symbol: (L as any).Symbol.arrowHead({
                  pixelSize: 15,
                  polygon: false,
                  pathOptions: { stroke: true, color: '#3388ff', weight: 3 }
                })
              }
            ]
          }).addTo(mapRef.current);
          setRouteDecorator(decorator);

          // Fit bounds to show the whole route
          mapRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });

          setRoutePolyline(polyline);

          // Update markers state to route
          setRouteStops(data.route_sequence);

          // Show notification
          setNotification({
            open: true,
            message: `Route generated! Distance: ${data.total_distance_km} km`,
            severity: 'success'
          });
        }
      } else {
        setNotification({
          open: true,
          message: 'No route found (no bins above threshold).',
          severity: 'info'
        });
      }
    } catch (error) {
      console.error('Optimization error:', error);
      setNotification({
        open: true,
        message: 'Failed to generate route.',
        severity: 'error'
      });
    } finally {
      setIsOptimizing(false);
    }
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

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();

      // Progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status === 201) {
          const response = JSON.parse(xhr.responseText);

          // Show success notification
          setNotification({
            open: true,
            message: response.message,
            severity: response.results.skipped_count > 0 ? 'warning' : 'success'
          });

          // Refresh bins data
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

      // Handle errors
      xhr.addEventListener('error', () => {
        setNotification({
          open: true,
          message: 'Network error during upload',
          severity: 'error'
        });
        setIsUploading(false);
        setUploadProgress(0);
      });

      // Send request
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

    // Reset file input
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

    // Leaflet map init
    mapRef.current = L.map("map").setView([36.89488259077369, 30.649857090761955], 13);

    // Tile layer
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      minZoom: 16,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);

    // Fetch bins on component mount
    fetchBins();
  }, []);

  // Update markers when points or routeStops change
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        mapRef.current?.removeLayer(layer);
      }
    });

    if (routeStops && routeStops.length > 0) {
      // --- ROUTE MODE: Show numbered markers via Popup ---
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
      // --- DEFAULT MODE: Show all bins ---
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

  return (
    <>
      <Box sx={{ height: "100vh", width: "100vw" }}>
        {/* Leaflet map container */}
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

      {/* Optimize Route Button */}
      <Button
        sx={{
          position: 'absolute',
          bottom: 20,
          right: 170, // Positioned to the left of Add Marker
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
        onClick={optimizeRoute}
        disabled={isOptimizing}
      >
        {isOptimizing ? "Optimizing..." : "⚡ Optimize Route"}
      </Button>


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