import L from 'leaflet';
import depotImg from '../assets/marker-icon-2x-red.png';
import depotShadow from '../assets/marker-shadow.png';

export const getBinIcon = (fillLevel: number) => {
    let color = '#2ed573';
    if (fillLevel >= 50 && fillLevel < 80) {
        color = '#ffa502';
    } else if (fillLevel >= 80) {
        color = '#ff4757';
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

export const truckIcon = L.divIcon({
    className: 'truck-marker-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
        <circle cx="24" cy="20" r="18" fill="#283930" stroke="#ffffff" stroke-width="2.5" />
        <rect x="14" y="13" width="16" height="10" rx="2" fill="#ffffff" />
        <rect x="30" y="16" width="5" height="7" rx="1" fill="#F5F7F3" stroke="#ffffff" stroke-width="0.5" />
        <circle cx="18" cy="25" r="2" fill="#283930" stroke="#ffffff" stroke-width="1" />
        <circle cx="30" cy="25" r="2" fill="#283930" stroke="#ffffff" stroke-width="1" />
        <polygon points="24,44 16,34 32,34" fill="#283930" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`,
    iconSize: [48, 48],
    iconAnchor: [24, 44],
    popupAnchor: [0, -44]
});

export const depotIcon = L.icon({
    iconUrl: depotImg,
    shadowUrl: depotShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});
