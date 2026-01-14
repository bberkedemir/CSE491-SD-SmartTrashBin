import { useEffect, useRef } from "react";
import L, { circle, Map as LeafletMap, marker, polygon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Box } from "@mui/material";
import trashBin from "./assets/bin.png";

const App: React.FC = () => {
  const mapRef = useRef<LeafletMap | null>(null);
  
  type BinPoint = {
    lat: number;
    lng: number;
    title: string;
    fill: number;
  };

  const points: BinPoint[] = [
    { lat: 36.89694, lng: 30.64797, title: "Arr 1", fill: 33 },
    { lat: 36.89617, lng: 30.65224, title: "Arr 2", fill: 53 },
  ];

  const greenIcon = L.icon({
    iconUrl: trashBin,
    shadowUrl: trashBin,

    iconSize:     [60, 60], // size of the icon
    shadowSize:   [0, 0], // size of the shadow
    iconAnchor:   [30, 30], // point of the icon which will correspond to marker's location
    shadowAnchor: [0, 0],  // the same for the shadow
    popupAnchor:  [-3, -76] // point from which the popup should open relative to the iconAnchor
  });
  

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
    /* L.marker([51.5, -0.09]).addTo(mapRef.current);
    */

    

   /*  L.circle([36.89236066584776, 30.6550484574058], {
    color: 'red',
    fillColor: '#f03',
    fillOpacity: 0.5,
    radius: 500
    }).addTo(mapRef.current); */

   /*  L.polygon([
    [36.89236066584776, 30.6550484574053],
    [36.89236066584776, 30.6550484574058],
    [36.89236066584776, 30.6550484574055]
    ]).addTo(mapRef.current); */

    

    points.forEach(p => L.marker(p).addTo(mapRef.current!));

    const m1 = L.marker([36.89236066584776, 30.6550484574058]).addTo(mapRef.current!);
    const m2 = L.marker([36.89392186729378, 30.64230601200724]).addTo(mapRef.current!);

    points.forEach(p => {
      L.marker([p.lat, p.lng], {icon: greenIcon})
      .addTo(mapRef.current!)
      .bindPopup(`<b>${p.title}</b><br>Dolu: ${p.fill}`)
    })
    

    m1.bindPopup("<b>Kız Yurdu</b><br>");
    m2.bindPopup("<b>Erkek Yurdu</b><br>");
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const popup = L.popup();

    

    const onMapClick = (e: L.LeafletMouseEvent) => {
      popup
        .setLatLng(e.latlng)
        .setContent(`Tıkladığın yer: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`)
        .openOn(mapRef.current!);
        
      let addingMarker = false;
      if (addingMarker = true) {
        L.marker(e.latlng, {icon: greenIcon})
        .addTo(mapRef.current!)
        .bindPopup(`Yeni çöp kutusu:<br>${e.latlng.lat}, ${e.latlng.lng}`)
        .openPopup();
      } 
      
    };

    mapRef.current.on("click", onMapClick);

    return () => {
      mapRef.current?.off("click", onMapClick);
    };
  }, []);
    

  return (
    <Box sx={{ height: "100vh", width: "100vw" }}>
      {/* Leaflet map container */}
      <Box id="map" sx={{ height: "100%", width: "100%" }} />
    </Box>
  );
};

export default App;
