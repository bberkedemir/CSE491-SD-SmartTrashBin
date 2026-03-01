import L from 'leaflet';
import trashBin from '../../assets/binRed.png';

export const binIcon = L.icon({
    iconUrl: trashBin,
    shadowUrl: trashBin,
    iconSize: [40, 40],
    shadowSize: [0, 0],
    iconAnchor: [20, 40],
    shadowAnchor: [0, 0],
    popupAnchor: [-3, -76],
});

export const truckIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3204/3204855.png', // Fallback URL for garbage truck
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -48]
});

export const depotIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

export const numberedIcon = (num: number) =>
    L.divIcon({
        className: 'custom-number-icon',
        html: `<div class="marker-number">${num}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
    });