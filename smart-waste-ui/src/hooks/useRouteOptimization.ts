import { useState, useCallback, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-polylinedecorator';
import type { RouteStop, RouteResponse, AppNotification, RouteMetrics } from '../types/bin';
import { binApi } from '../api/binApi';

export function useRouteOptimization(
    mapRef: React.RefObject<L.Map | null>,
    onNotification: (notification: AppNotification) => void
) {
    const [routeStops, setRouteStops] = useState<RouteStop[] | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [isRouteActive, setIsRouteActive] = useState(false);
    const [routeMetrics, setRouteMetrics] = useState<RouteMetrics | null>(null);

    const polylineRef = useRef<L.Polyline | null>(null);
    const decoratorRef = useRef<any | null>(null);

    const clearRoute = useCallback(() => {
        if (polylineRef.current) {
            polylineRef.current.remove();
            polylineRef.current = null;
        }
        if (decoratorRef.current) {
            decoratorRef.current.remove();
            decoratorRef.current = null;
        }
        setRouteStops(null);
        setIsRouteActive(false);
        setRouteMetrics(null);
    }, []);

    const optimizeRoute = useCallback(async (threshold: number = 30, startLat: number, startLng: number) => {
        setIsOptimizing(true);
        clearRoute();

        try {
            const data: RouteResponse = await binApi.optimizeRoute(threshold, startLat, startLng);

            let latlngs: L.LatLngExpression[] = [];

            if (data.route_geometry?.length > 0) {
                latlngs = data.route_geometry as L.LatLngExpression[];
            } else if (data.route_sequence?.length > 0) {
                latlngs = data.route_sequence.map(stop => [stop.lat, stop.lng] as L.LatLngExpression);
            }

            if (latlngs.length > 0 && mapRef.current) {
                const polyline = L.polyline(latlngs, {
                    color: '#3388ff',
                    weight: 5,
                    opacity: 0.8,
                    lineJoin: 'round',
                }).addTo(mapRef.current);

                const decorator = (L as any).polylineDecorator(polyline, {
                    patterns: [
                        {
                            offset: '5%',
                            repeat: '300px',
                            symbol: (L as any).Symbol.arrowHead({
                                pixelSize: 15,
                                polygon: false,
                                pathOptions: { stroke: true, color: '#3388ff', weight: 3 },
                            }),
                        },
                    ],
                }).addTo(mapRef.current);

                polylineRef.current = polyline;
                decoratorRef.current = decorator;

                mapRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });

                setRouteStops(data.route_sequence);
                setIsRouteActive(true);

                const binStops = data.route_sequence.filter(s => s.type !== 'start' && s.type !== 'end');
                setRouteMetrics({
                    generatedAt: data.generated_at,
                    totalStops: data.total_stops,
                    totalDistanceKm: data.total_distance_km,
                    estimatedTimeMinutes: data.estimated_time_minutes,
                    stops: binStops,
                });

                onNotification({
                    open: true,
                    message: `Route generated! Distance: ${data.total_distance_km} km`,
                    severity: 'success',
                });
            } else {
                onNotification({
                    open: true,
                    message: 'No route found (no bins above threshold).',
                    severity: 'info',
                });
            }
        } catch (error) {
            console.error('Optimization error:', error);
            onNotification({
                open: true,
                message: 'Failed to generate route.',
                severity: 'error',
            });
        } finally {
            setIsOptimizing(false);
        }
    }, [mapRef, clearRoute, onNotification]);

    return { routeStops, routeMetrics, isOptimizing, isRouteActive, optimizeRoute, clearRoute };
}