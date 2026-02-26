import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { BinPoint, NewBinData, RouteStop } from '../../types/bin';
import { binIcon, depotIcon, numberedIcon } from './mapIcons';
import {
    createMarkerPopupHtml,
    createAddMarkerPopupHtml,
    createRouteStopPopupHtml,
} from './popupTemplates';

const MAP_CENTER: L.LatLngExpression = [36.89488259077369, 30.649857090761955];
const MAP_ZOOM = 13;

export function useMapMarkers(
    bins: BinPoint[],
    routeStops: RouteStop[] | null,
    isAddMode: boolean,
    onCreateBin: (data: NewBinData) => Promise<BinPoint>,
    onDeleteBin: (id: number) => Promise<void>
) {
    const mapRef = useRef<L.Map | null>(null);
    const markersRef = useRef<L.Marker[]>([]);

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
                        : numberedIcon(stop.sequence);

                const marker = L.marker([stop.lat, stop.lng], { icon })
                    .addTo(mapRef.current!)
                    .bindPopup(createRouteStopPopupHtml(stop));

                markersRef.current.push(marker);
            });
        } else {
            // --- DEFAULT MODE: all bins with delete ---
            bins.forEach(bin => {
                const marker = L.marker([bin.lat, bin.lng], { icon: binIcon })
                    .addTo(mapRef.current!)
                    .bindPopup(createMarkerPopupHtml(bin));

                marker.on('popupopen', () => {
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

                markersRef.current.push(marker);
            });
        }
    }, [bins, routeStops, onDeleteBin]);

    // Handle add-mode click
    useEffect(() => {
        if (!mapRef.current) return;

        const popup = L.popup();

        const onMapClick = (e: L.LeafletMouseEvent) => {
            if (!isAddMode) return;

            popup
                .setLatLng(e.latlng)
                .setContent(createAddMarkerPopupHtml(e.latlng.lat, e.latlng.lng))
                .openOn(mapRef.current!);

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
                    } catch (error) {
                        console.error('Failed to create bin:', error);
                    }
                };
            });
        };

        mapRef.current.on('click', onMapClick);
        return () => {
            mapRef.current?.off('click', onMapClick);
        };
    }, [isAddMode, onCreateBin]);

    return mapRef;
}