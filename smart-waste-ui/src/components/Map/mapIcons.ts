import L from 'leaflet';
import truckImg from '../../assets/truck.png';
import depotImg from '../../assets/marker-icon-2x-red.png';
import depotShadow from '../../assets/marker-shadow.png';

export const getBinIcon = (fillLevel: number) => {
    let color = '#2ed573'; // Green
    if (fillLevel >= 50 && fillLevel < 80) {
        color = '#ffa502'; // Orange
    } else if (fillLevel >= 80) {
        color = '#ff4757'; // Red
    }

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="30" height="30">
            <circle cx="16" cy="16" r="14" fill="${color}" stroke="#ffffff" stroke-width="2" />
            <text x="16" y="20" font-family="Arial" font-size="12" font-weight="bold" fill="#fff" text-anchor="middle">${fillLevel}%</text>
        </svg>
    `;

    return L.divIcon({
        className: 'custom-bin-icon',
        html: svg,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15],
    });
};

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

export const roadAnomalyIcon = L.divIcon({
    className: 'road-anomaly-icon',
    html: `
        <div class="road-anomaly-marker">
            <span>!</span>
        </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
});
