import { useEffect, useRef, useState } from "react";
import L, { circle, latLng, Map as LeafletMap, marker, polygon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Box, Button } from "@mui/material";
import trashBin from "./assets/binRed.png";
import './App.css';

const App: React.FC = () => {
  const mapRef = useRef<LeafletMap | null>(null);
  
  type BinPoint = {
    id: number;
    lat: number;
    lng: number;
    title: string;
    fill: number;
  };

  const greenIcon = L.icon({
    iconUrl: trashBin,
    shadowUrl: trashBin,

    iconSize:     [40, 40], // size of the icon
    shadowSize:   [0, 0], // size of the shadow
    iconAnchor:   [20, 40], // point of the icon which will correspond to marker's location
    shadowAnchor: [0, 0],  // the same for the shadow
    popupAnchor:  [-3, -76] // point from which the popup should open relative to the iconAnchor
  });
  

  const points: BinPoint[] = [
    {id: 1, lat: 36.89694, lng: 30.64797, title: "Test1", fill: 33 },
    {id: 2, lat: 36.89617, lng: 30.65224, title: "Test2", fill: 53 },
    {id: 3, lat: 36.89267928744974, lng: 30.66249011529842, title: 'AMBALAJ ATIK-KAPALI SİSTEM', fill: 33,},
    {id: 4, lat: 36.89215843836044, lng: 30.66254166528108, title: 'DİĞER EVSEL ATIK-5 ADET', fill: 33,},
    {id: 5, lat: 36.89215843836044, lng: 30.66254166528108, title: 'ATIK GEÇİCİ DEPOLAMA', fill: 33,},
    {id: 6, lat: 36.89222943226011, lng: 30.66224195537897, title: 'AMBALAJ ATIK-KAFES SİSTEM', fill: 33,},
    {id: 7, lat: 36.89229356505423, lng: 30.66268481152862, title: 'DİĞER EVSEL ATIK-1 ADET', fill: 33,},
    {id: 8, lat: 36.8903084454933, lng: 30.66168764407357, title: 'DİĞER EVSEL ATIK-2 ADET', fill: 33,},
    {id: 9, lat: 36.89278875461729, lng: 30.66300576766275, title: 'DİĞER EVSEL ATIK-1 ADET', fill: 33,},
    {id: 10, lat: 36.89173903450233, lng: 30.65983549318285, title: 'DİĞER EVSEL ATIK-3 ADET', fill: 33,},
    {id: 11, lat: 36.8912692140121, lng: 30.65997402125544, title: 'AMBALAJ ATIK-KONTEYNER', fill: 33,},
    {id: 12, lat: 36.89218360649441, lng: 30.65651353695466, title: 'DİĞER EVSEL ATIK- 2 ADET', fill: 33,},
    {id: 13, lat: 36.89218360652611, lng: 30.65651353690172, title: 'AMBALAJ ATIK-KONTEYNER', fill: 33,},
    {id: 14, lat: 36.89212860651759, lng: 30.65620013982255, title: 'DİĞER EVSEL ATIK-1 ADET', fill: 33,},
    {id: 15, lat: 36.89241689468369, lng: 30.65725414177407, title: 'AMBALAJ ATIK-KAPALI SİSTEM', fill: 33,},
    {id: 16, lat: 36.89241689468369, lng: 30.65725414177407, title: 'DİĞER EVSEL ATIK-3 ADET', fill: 33,},
  ];

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
            <span class="marker-popup-value">%${data.fill}</span>
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
          console.log("removed", data.id)
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
    mapRef.current = L.map("map").setView([36.89488259077369, 30.649857090761955], 13, );

    // Tile layer
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      minZoom: 16,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);

    points.forEach(p => {
      addMarker(
        mapRef.current!, 
        { id: p.id,
          lat: p.lat,
          lng: p.lng,
          title: p.title,
          fill: p.fill
        }, greenIcon, (id, marker) => {
          marker.removeFrom(mapRef.current!);
        } )
      
    })
    console.log(points);
  

  }, []);




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

        addButton.onclick = () => {
          const input = document.getElementById("addTitle") as HTMLInputElement | null;
          const markerTitle = input?.value || "Untitled Marker";
          const newMarker = {
              id: Date.now(),
              lat: e.latlng.lat,
              lng: e.latlng.lng,
              title: markerTitle,
              fill: 70
            };

          addMarker(mapRef.current!, newMarker, greenIcon, (id, marker) => {
              marker.removeFrom(mapRef.current!);
            });
          points.push(newMarker);
          console.log(`added new marker id: ${newMarker.id}, title: ${newMarker.title}`)
          console.log(points);

          popup.close();
        };
      });
    };

    mapRef.current.on("click", onMapClick);

    return () => {
      mapRef.current?.off("click", onMapClick);
      popup.off("add"); // Clean up popup listener
    };
  }, [isAddMode]);
    

  return (
    <>
    <Box sx={{ height: "100vh", width: "100vw" }}>
      {/* Leaflet map container */}
      <Box id="map" sx={{ height: "100%", width: "100%" }} />
    </Box>
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
    </>
  );
};

export default App;
