import L from 'leaflet';
import trashBin from '../../assets/binRed.png';
import truckImg from '../../assets/truck.png';
import depotImg from '../../assets/marker-icon-2x-red.png';
import depotShadow from '../../assets/marker-shadow.png';

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
    iconUrl: truckImg, // Realistic garbage truck
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -48]
});

export const depotIcon = L.icon({
    iconUrl: depotImg,
    shadowUrl: depotShadow,
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