import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { BinPoint, NewBinData, RouteStop } from '../../types/bin';
import { getBinIconByFill, binWhiteIcon, depotIcon, numberedIconByFill } from './mapIcons';
import {
    createMarkerPopupHtml,
    createAddMarkerPopupHtml,
    createRouteStopPopupHtml,
} from './popupTemplates';

// Inline SVG map pin cursor — works reliably across browsers
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%23e74c3c" stroke="%23ffffff" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="%23ffffff" stroke="none"/></svg>`;
const ADD_MODE_CURSOR = `url("data:image/svg+xml,${PIN_SVG}") 16 32, crosshair`;

const MAP_CENTER: L.LatLngExpression = [36.89488259077369, 30.649857090761955];
const MAP_ZOOM = 13;

export function useMapMarkers(
    bins: BinPoint[],
    routeStops: RouteStop[] | null,
    isAddMode: boolean,
    onCreateBin: (data: NewBinData) => Promise<BinPoint>,
    onDeleteBin: (id: number) => Promise<void>,
    onExitAddMode: () => void
) {
    const mapRef = useRef<L.Map | null>(null);
    const markersRef = useRef<L.Marker[]>([]);
    const addPopupRef = useRef<L.Popup | null>(null);

    useEffect(() => {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) return;

        if (isAddMode) {
            mapContainer.style.cursor = ADD_MODE_CURSOR;
            mapContainer.classList.add('add-mode-active');
        } else {
            mapContainer.style.cursor = '';
            mapContainer.classList.remove('add-mode-active');
            // Close the add-marker popup when exiting add mode
            if (addPopupRef.current && mapRef.current) {
                mapRef.current.closePopup(addPopupRef.current);
                addPopupRef.current = null;
            }
        }

        return () => {
            mapContainer.style.cursor = '';
            mapContainer.classList.remove('add-mode-active');
        };
    }, [isAddMode]);

    // Initialize map once
    useEffect(() => {
        if (mapRef.current) return;

        mapRef.current = L.map('map').setView(MAP_CENTER, MAP_ZOOM);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            minZoom: 16,
            attribution:
                '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapRef.current);
    }, []);

    // Sync markers with bins or route stops
    useEffect(() => {
        if (!mapRef.current) return;

        // Remove old markers
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        if (routeStops && routeStops.length > 0) {
            // --- ROUTE MODE: numbered markers + depot ---
            routeStops.forEach(stop => {
                const icon =
                    stop.type === 'start' || stop.type === 'end'
                        ? depotIcon
                        : numberedIconByFill(stop.sequence, stop.fill_level);

                const marker = L.marker([stop.lat, stop.lng], { icon })
                    .addTo(mapRef.current!)
                    .bindPopup(createRouteStopPopupHtml(stop));

                markersRef.current.push(marker);
            });
        } else {
            // --- DEFAULT MODE: white bins, colored on hover ---
            bins.forEach(bin => {
                const marker = L.marker([bin.lat, bin.lng], { icon: binWhiteIcon })
                    .addTo(mapRef.current!)
                    .bindPopup(createMarkerPopupHtml(bin));

                // Swap to fill-colored icon on hover
                marker.on('mouseover', () => {
                    marker.setIcon(getBinIconByFill(bin.fill));
                });
                marker.on('mouseout', () => {
                    if (!marker.isPopupOpen()) {
                        marker.setIcon(binWhiteIcon);
                    }
                });
                // Keep colored while popup is open, revert on close
                marker.on('popupopen', () => {
                    marker.setIcon(getBinIconByFill(bin.fill));
                    const btn = document.getElementById(`del-${bin.id}`);
                    if (btn) {
                        btn.onclick = async () => {
                            try {
                                await onDeleteBin(bin.id);
                                marker.remove();
                            } catch (error) {
                                console.error('Failed to delete bin:', error);
                            }
                        };
                    }
                });
                marker.on('popupclose', () => {
                    marker.setIcon(binWhiteIcon);
                });

                markersRef.current.push(marker);
            });
        }
    }, [bins, routeStops, onDeleteBin]);

    // Handle add-mode click
    useEffect(() => {
        if (!mapRef.current) return;

        const mapContainer = document.getElementById('map');
        const popup = L.popup();
        addPopupRef.current = popup;

        const onMapClick = (e: L.LeafletMouseEvent) => {
            if (!isAddMode) return;

            popup
                .setLatLng(e.latlng)
                .setContent(createAddMarkerPopupHtml(e.latlng.lat, e.latlng.lng))
                .openOn(mapRef.current!);

            // Revert cursor to normal while popup is open
            if (mapContainer) {
                mapContainer.classList.remove('add-mode-active');
            }

            setTimeout(() => {
                const addButton = document.getElementById('addMarkerBtn');
                if (!addButton) return;

                addButton.onclick = async () => {
                    const input = document.getElementById('addTitle') as HTMLInputElement | null;
                    const title = input?.value || 'Untitled Marker';

                    try {
                        await onCreateBin({
                            lat: e.latlng.lat,
                            lng: e.latlng.lng,
                            title,
                            fill: Math.floor(Math.random() * 101),
                        });
                        popup.close();
                        onExitAddMode();
                    } catch (error) {
                        console.error('Failed to create bin:', error);
                    }
                };
            });
        };

        // Restore pin cursor when popup closes (if still in add mode)
        const onPopupClose = () => {
            if (isAddMode && mapContainer) {
                mapContainer.classList.add('add-mode-active');
            }
        };

        mapRef.current.on('click', onMapClick);
        mapRef.current.on('popupclose', onPopupClose);
        return () => {
            mapRef.current?.off('click', onMapClick);
            mapRef.current?.off('popupclose', onPopupClose);
        };
    }, [isAddMode, onCreateBin, onExitAddMode]);

    return mapRef;
}