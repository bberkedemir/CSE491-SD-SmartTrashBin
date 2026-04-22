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
    const [fullRouteGeometry, setFullRouteGeometry] = useState<L.LatLngExpression[]>([]);

    const polylineRef = useRef<L.Polyline | null>(null);
    const decoratorRef = useRef<any | null>(null);
    const currentRouteIndexRef = useRef<number>(0);

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
        setFullRouteGeometry([]);
        currentRouteIndexRef.current = 0;
    }, []);

    const optimizeRoute = useCallback(async (threshold: number = 30, startLat: number, startLng: number, algo: 'default' | 'greedy' = 'default'): Promise<boolean> => {
        setIsOptimizing(true);
        clearRoute();

        try {
            const apiCall = algo === 'greedy' ? binApi.optimizeRouteGreedy : binApi.optimizeRoute;
            const data: RouteResponse = await apiCall(threshold, startLat, startLng);

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
                setFullRouteGeometry(latlngs);
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
                return true;
            } else {
                onNotification({
                    open: true,
                    message: 'No route found (no bins above threshold).',
                    severity: 'info',
                });
                return false;
            }
        } catch (error) {
            console.error('Optimization error:', error);
            onNotification({
                open: true,
                message: 'Failed to generate route.',
                severity: 'error',
            });
            return false;
        } finally {
            setIsOptimizing(false);
        }
    }, [mapRef, clearRoute, onNotification]);

    const updateTruckPositionOnRoute = useCallback((currLat: number, currLng: number) => {
        if (!fullRouteGeometry.length || !mapRef.current) return;

        let closestIndex = currentRouteIndexRef.current;
        let minDistanceSq = Infinity;

        // Search the remaining valid geometry but favor points that are sequentially closer to 
        // the last known position. This allows the truck to jump large array index gaps (like on 
        // straight roads) while preventing it from cutting across the map to future loops.
        const startIndex = currentRouteIndexRef.current;

        for (let i = startIndex; i < fullRouteGeometry.length; i++) {
            const point = fullRouteGeometry[i] as [number, number];

            // Calculate Euclidean distance squared
            const distSq = Math.pow(point[0] - currLat, 2) + Math.pow(point[1] - currLng, 2);

            // Sequential penalty: points further ahead in the array are penalized artificially 
            // so that if a future sequence point is physically close, we still prefer the 
            // naturally sequence-ordered point. (Penalty scaled to typical LatLng degree sizes).
            const indexPenalty = (i - startIndex) * 0.00000001;
            const penalizedDistSq = distSq + indexPenalty;

            if (penalizedDistSq < minDistanceSq) {
                minDistanceSq = penalizedDistSq;
                closestIndex = i;
            }
        }

        currentRouteIndexRef.current = closestIndex;

        // Slice the geometry from the closest point onwards
        const remainingRoute = fullRouteGeometry.slice(closestIndex);

        // Ensure the truck's exact current position is the starting point of the new line
        const truckLatLng: L.LatLngExpression = [currLat, currLng];
        const updatedLatLngs = [truckLatLng, ...remainingRoute];

        // Redraw polyline
        if (polylineRef.current) {
            polylineRef.current.remove();
        }

        const newPolyline = L.polyline(updatedLatLngs, {
            color: '#3388ff',
            weight: 5,
            opacity: 0.8,
            lineJoin: 'round',
        }).addTo(mapRef.current);

        polylineRef.current = newPolyline;

        // Redraw decorator
        if (decoratorRef.current) {
            decoratorRef.current.remove();
        }

        const newDecorator = (L as any).polylineDecorator(newPolyline, {
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

        decoratorRef.current = newDecorator;

    }, [fullRouteGeometry, mapRef]);

    return { routeStops, routeMetrics, isOptimizing, isRouteActive, optimizeRoute, clearRoute, updateTruckPositionOnRoute };
}