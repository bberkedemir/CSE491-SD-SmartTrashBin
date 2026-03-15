import L from 'leaflet';
import redBin from '../../assets/redBin.png';
import yellowBin from '../../assets/yellowBin.png';
import greenBin from '../../assets/greenBin.png';
import whiteBin from '../../assets/whiteBin.png';

const createBinIcon = (iconUrl: string) =>
    L.icon({
        iconUrl,
        shadowUrl: iconUrl,
        iconSize: [35, 35],
        shadowSize: [0, 0],
        iconAnchor: [17, 35],
        shadowAnchor: [0, 0],
        popupAnchor: [-3, -76],
    });

export const binRedIcon = createBinIcon(redBin);
export const binYellowIcon = createBinIcon(yellowBin);
export const binGreenIcon = createBinIcon(greenBin);
export const binWhiteIcon = createBinIcon(whiteBin);

export const binIcon = binRedIcon;

export function getBinIconByFill(fill: number): L.Icon {
    if (fill >= 80) return binRedIcon;
    if (fill >= 50) return binYellowIcon;
    return binGreenIcon;
}

export function getFillColor(fill: number): string {
    if (fill >= 80) return '#ff4757';
    if (fill >= 50) return '#ffa502';
    return '#2ed573';
}

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

export const numberedIconByFill = (num: number, fill: number) =>
    L.divIcon({
        className: 'custom-number-icon',
        html: `<div class="marker-number" style="background-color: ${getFillColor(fill)}">${num}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
    });