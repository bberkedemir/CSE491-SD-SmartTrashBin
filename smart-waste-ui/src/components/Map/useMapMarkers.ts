import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { BinPoint, NewBinData, RouteStop, DriverSession } from '../../types/bin';
import {
    createMarkerPopupHtml,
    createAddMarkerPopupHtml,
    createRouteStopPopupHtml,
} from './popupTemplates';
import * as mapIcons from './mapIcons';
import mapPinCursor from '../../assets/mapPinCursor.png';

const ADD_MODE_CURSOR = `url(${mapPinCursor}) 16 32, crosshair`;

const MAP_CENTER: L.LatLngExpression = [36.89488259077369, 30.649857090761955];
const MAP_ZOOM = 15;

export function useMapMarkers(
    bins: BinPoint[],
    routeStops: RouteStop[] | null,
    isAddMode: boolean,
    truckPosition: [number, number],
    onTruckMove: (lat: number, lng: number) => void,
    onCreateBin: (data: NewBinData) => Promise<BinPoint>,
    onDeleteBin: (id: number) => Promise<void>,
    onCollectBin: (id: number) => Promise<void>,
    onThrowTrash: (id: number) => Promise<void>,
    onExitAddMode: () => void,
    driverSessions?: DriverSession[],
    getDriverColor?: (driverId: number) => string,
) {
    const mapRef = useRef<L.Map | null>(null);
    const markersRef = useRef<L.Marker[]>([]);
    const truckMarkerRef = useRef<L.Marker | null>(null);
    const addPopupRef = useRef<L.Popup | null>(null);
    const driverMarkersRef = useRef<Map<number, L.Marker>>(new Map());
    const driverPolylinesRef = useRef<Map<number, L.Polyline>>(new Map());
    const driverCirclesRef = useRef<Map<number, L.Circle[]>>(new Map());

    useEffect(() => {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) return;

        if (isAddMode) {
            mapContainer.style.setProperty('--pin-cursor', ADD_MODE_CURSOR);
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
            minZoom: 3,
            attribution:
                '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapRef.current);
    }, []);

    // Manage Truck Marker
    useEffect(() => {
        if (!mapRef.current) return;

        if (!truckMarkerRef.current) {
            truckMarkerRef.current = L.marker(truckPosition, {
                icon: mapIcons.truckIcon,
                draggable: true
            })
                .addTo(mapRef.current)
                .bindPopup("<b>Garbage Truck</b><br>Drag me to set starting position.");

            truckMarkerRef.current.on('dragend', (e) => {
                const marker = e.target as L.Marker;
                const position = marker.getLatLng();
                onTruckMove(position.lat, position.lng);
            });
        } else {
            truckMarkerRef.current.setLatLng(truckPosition);
        }
    }, [truckPosition, onTruckMove]);

    // Sync markers with bins or route stops
    useEffect(() => {
        if (!mapRef.current) return;

        // Remove old basic markers (do NOT remove truckMarker)
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        if (routeStops && routeStops.length > 0) {
            // --- ROUTE MODE: numbered markers + depot ---
            routeStops.forEach(stop => {
                if (stop.type === 'start') return;

                const icon =
                    stop.type === 'end'
                        ? mapIcons.depotIcon
                        : mapIcons.numberedIcon(stop.sequence);

                const marker = L.marker([stop.lat, stop.lng], { icon })
                    .addTo(mapRef.current!)
                    .bindPopup(createRouteStopPopupHtml(stop));

                markersRef.current.push(marker);
            });
        } else {
            // --- DEFAULT MODE: bins with popups ---
            // When driver sessions are active, only show bins included in those routes
            const driverBinIds = driverSessions && driverSessions.length > 0
                ? new Set(
                    driverSessions.flatMap(s =>
                        s.route_stops.filter(r => r.type === 'pickup').map(r => r.id)
                    )
                  )
                : null;

            const visibleBins = driverBinIds
                ? bins.filter(b => driverBinIds.has(b.id))
                : bins;

            visibleBins.forEach(bin => {
                const marker = L.marker([bin.lat, bin.lng], { icon: mapIcons.getBinIcon(bin.fill) })
                    .addTo(mapRef.current!)
                    .bindPopup(createMarkerPopupHtml(bin));

                marker.on('popupopen', () => {
                    // Delete Button Binding
                    const delBtn = document.getElementById(`del-${bin.id}`);
                    if (delBtn) {
                        delBtn.onclick = async () => {
                            try {
                                await onDeleteBin(bin.id);
                                marker.remove();
                            } catch (error) {
                                console.error('Failed to delete bin:', error);
                            }
                        };
                    }

                    // Collect Button Binding
                    const collectBtn = document.getElementById(`collect-${bin.id}`);
                    if (collectBtn) {
                        collectBtn.onclick = async () => {
                            try {
                                await onCollectBin(bin.id);
                                // The react state update for fill=0 will trigger a re-render
                                // causing `useMapMarkers` to re-draw the markers with the updated color and popup data
                            } catch (error) {
                                console.error('Failed to collect bin:', error);
                            }
                        };
                    }
                    // Throw Trash Button Binding
                    const throwBtn = document.getElementById(`throw-${bin.id}`);
                    if (throwBtn) {
                        throwBtn.onclick = async () => {
                            try {
                                await onThrowTrash(bin.id);
                            } catch (error) {
                                console.error('Failed to throw trash:', error);
                            }
                        };
                    }
                });

                markersRef.current.push(marker);
            });
        }
    }, [bins, routeStops, driverSessions, onDeleteBin, onCollectBin, onThrowTrash]);

    // Handle add-mode click
    useEffect(() => {
        if (!mapRef.current) return;

        const mapContainer = document.getElementById('map');
        const popup = L.popup();
        addPopupRef.current = popup;

        let justCreated = false;

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
                        justCreated = true;
                        onExitAddMode();
                        popup.close();
                    } catch (error) {
                        console.error('Failed to create bin:', error);
                    }
                };
            });
        };

        // Restore pin cursor when popup closes (only if user dismissed without creating)
        const onPopupClose = () => {
            if (justCreated) {
                justCreated = false;
                return;
            }
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

    // Render live driver trucks, route polylines, and collected-bin overlays
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;
        const sessions = driverSessions ?? [];
        const activeIds = new Set(sessions.map(s => s.driver_id));

        // Remove layers for sessions that ended
        driverMarkersRef.current.forEach((marker, id) => {
            if (!activeIds.has(id)) { marker.remove(); driverMarkersRef.current.delete(id); }
        });
        driverPolylinesRef.current.forEach((poly, id) => {
            if (!activeIds.has(id)) { poly.remove(); driverPolylinesRef.current.delete(id); }
        });
        driverCirclesRef.current.forEach((circles, id) => {
            if (!activeIds.has(id)) { circles.forEach(c => c.remove()); driverCirclesRef.current.delete(id); }
        });

        sessions.forEach(session => {
            const color = getDriverColor ? getDriverColor(session.driver_id) : '#e53935';
            const pickupStops = session.route_stops.filter(s => s.type === 'pickup');
            const done = session.collected_ids.length + session.skipped_ids.length;
            const popupHtml = `
                <b>${session.driver_full_name}</b><br>
                Progress: ${done}/${pickupStops.length} stops<br>
                Collected: ${session.collected_ids.length} &nbsp;|&nbsp; Skipped: ${session.skipped_ids.length}
            `;

            const driverIcon = L.divIcon({
                className: '',
                html: `<div style="background:${color};border:3px solid white;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.45)">🚛</div>`,
                iconSize: [34, 34],
                iconAnchor: [17, 17],
                popupAnchor: [0, -18],
            });

            // Truck marker — update position if exists, otherwise create
            const existing = driverMarkersRef.current.get(session.driver_id);
            if (existing) {
                existing.setLatLng([session.lat, session.lng]);
                existing.setPopupContent(popupHtml);
            } else {
                const marker = L.marker([session.lat, session.lng], { icon: driverIcon })
                    .addTo(map)
                    .bindPopup(popupHtml);
                driverMarkersRef.current.set(session.driver_id, marker);
            }

            // Route polyline — rebuild every update (geometry doesn't change often)
            const oldPoly = driverPolylinesRef.current.get(session.driver_id);
            if (oldPoly) oldPoly.remove();
            if (session.route_geometry.length > 0) {
                const poly = L.polyline(session.route_geometry as L.LatLngExpression[], {
                    color,
                    weight: 4,
                    opacity: 0.75,
                    dashArray: '8, 6',
                }).addTo(map);
                driverPolylinesRef.current.set(session.driver_id, poly);
            }

            // Collected-bin green circles
            const oldCircles = driverCirclesRef.current.get(session.driver_id) ?? [];
            oldCircles.forEach(c => c.remove());
            const circles: L.Circle[] = [];
            session.route_stops
                .filter(s => s.type === 'pickup' && session.collected_ids.includes(s.id))
                .forEach(stop => {
                    const circle = L.circle([stop.lat, stop.lng], {
                        radius: 14,
                        color: '#2e7d32',
                        fillColor: '#2e7d32',
                        fillOpacity: 0.45,
                        weight: 2,
                    }).addTo(map).bindTooltip(`Collected: ${stop.title}`);
                    circles.push(circle);
                });
            driverCirclesRef.current.set(session.driver_id, circles);
        });
    }, [driverSessions, getDriverColor]);

    return mapRef;
}