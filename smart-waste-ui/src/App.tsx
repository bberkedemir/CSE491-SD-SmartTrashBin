import { useEffect, useRef } from "react";
import L, { circle, Map as LeafletMap, marker, polygon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Box } from "@mui/material";
import trashBin from "./assets/binRed.png";

const App: React.FC = () => {
  const mapRef = useRef<LeafletMap | null>(null);
  
  type BinPoint = {
    lat: number;
    lng: number;
    title: string;
    fill: number;
  };

  const points: BinPoint[] = [
    { lat: 36.89694, lng: 30.64797, title: "Test1", fill: 33 },
    { lat: 36.89617, lng: 30.65224, title: "Test2", fill: 53 },
    {lat: 36.89267928744974, lng: 30.66249011529842, title: 'AMBALAJ ATIK-KAPALI SİSTEM', fill: 33,},
    {lat: 36.89215843836044, lng: 30.66254166528108, title: 'DİĞER EVSEL ATIK-5 ADET', fill: 33,},
    {lat: 36.89215843836044, lng: 30.66254166528108, title: 'ATIK GEÇİCİ DEPOLAMA', fill: 33,},
    {lat: 36.89222943226011, lng: 30.66224195537897, title: 'AMBALAJ ATIK-KAFES SİSTEM', fill: 33,},
    {lat: 36.89229356505423, lng: 30.66268481152862, title: 'DİĞER EVSEL ATIK-1 ADET', fill: 33,},
    {lat: 36.8903084454933, lng: 30.66168764407357, title: 'DİĞER EVSEL ATIK-2 ADET', fill: 33,},
    {lat: 36.89278875461729, lng: 30.66300576766275, title: 'DİĞER EVSEL ATIK-1 ADET', fill: 33,},
    {lat: 36.89173903450233, lng: 30.65983549318285, title: 'DİĞER EVSEL ATIK-3 ADET', fill: 33,},
    {lat: 36.8912692140121, lng: 30.65997402125544, title: 'AMBALAJ ATIK-KONTEYNER', fill: 33,},
    {lat: 36.89218360649441, lng: 30.65651353695466, title: 'DİĞER EVSEL ATIK- 2 ADET', fill: 33,},
    {lat: 36.89218360652611, lng: 30.65651353690172, title: 'AMBALAJ ATIK-KONTEYNER', fill: 33,},
    {lat: 36.89212860651759, lng: 30.65620013982255, title: 'DİĞER EVSEL ATIK-1 ADET', fill: 33,},
    {lat: 36.89241689468369, lng: 30.65725414177407, title: 'AMBALAJ ATIK-KAPALI SİSTEM', fill: 33,},
    {lat: 36.89241689468369, lng: 30.65725414177407, title: 'DİĞER EVSEL ATIK-3 ADET', fill: 33,},
  ];

  const greenIcon = L.icon({
    iconUrl: trashBin,
    shadowUrl: trashBin,

    iconSize:     [40, 40], // size of the icon
    shadowSize:   [0, 0], // size of the shadow
    iconAnchor:   [20, 40], // point of the icon which will correspond to marker's location
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

    // L.marker([51.5, -0.09]).addTo(mapRef.current);
    /* points.forEach(p => L.marker(p).addTo(mapRef.current!)); */

    ////////////////// Test Markers /////////////
    const m1 = L.marker([36.89236066584776, 30.6550484574058]).addTo(mapRef.current!);
    const m2 = L.marker([36.89392186729378, 30.64230601200724]).addTo(mapRef.current!);

    points.forEach(p => {
      L.marker([p.lat, p.lng], {icon: greenIcon})
      .addTo(mapRef.current!)
      .bindPopup(
        `<b>${p.title}</b><br>Dolu: ${p.fill}
         /* <br/>
         <button id="delBtn"> Sil </button> */
        `)

      
    })

    
    
    m1.bindPopup("<b>Kız Yurdu</b><br>");
    m2.bindPopup("<b>Erkek Yurdu</b><br>");
    /////////////////////////////////////////////
  }, []);


  // new marker
  useEffect(() => {
    if (!mapRef.current) return;

    const popup = L.popup();

    const onMapClick = (e: L.LeafletMouseEvent) => {
      
      popup
        .setLatLng(e.latlng)
        .setContent(`Tıkladığın yer: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)} 
         <br/>
        <button id="addBtn">Ekle</button>`)
        .openOn(mapRef.current!);
        
      const addButton = document.getElementById("addBtn");
      
      if (addButton) {

        addButton.addEventListener("click", () => {
          const newMarker = L.marker(e.latlng, {icon: greenIcon}).addTo(mapRef.current!);

          newMarker.bindPopup(`
            Yeni çöp kutusu:<br>${e.latlng.lat}, ${e.latlng.lng} 
            <br> <button id="delBtn"> Sil </button>
            `).openPopup();

          newMarker.getPopup()?.on("add", () => {
            const delButton = document.getElementById("delBtn");
            if (delButton) {
              delButton.addEventListener("click", () => {
                newMarker.removeFrom(mapRef.current!);
                console.log("marker silindi");
              });
            }
          });
        })
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
