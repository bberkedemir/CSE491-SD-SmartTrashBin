import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthProvider';
import { binApi } from '../api/binApi';
import { getBinIcon, truckIcon } from '../components/mapIcons';
import type { BinPoint, RouteStop, RouteMetrics } from '../types';

const DEFAULT_CENTER: [number, number] = [36.892539, 30.663895];

export default function MapPage() {
    const { user, logout } = useAuth();
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<L.Marker[]>([]);
    const truckMarkerRef = useRef<L.Marker | null>(null);
    const polylineRef = useRef<L.Polyline | null>(null);

    const [bins, setBins] = useState<BinPoint[]>([]);
    const [truckPosition, setTruckPosition] = useState<[number, number]>(DEFAULT_CENTER);
    const [selectedBin, setSelectedBin] = useState<BinPoint | null>(null);
    const [routeMetrics, setRouteMetrics] = useState<RouteMetrics | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);
    const [showProfile, setShowProfile] = useState(false);
    const [metricsCollapsed, setMetricsCollapsed] = useState(false);

    const fetchBins = useCallback(async () => {
        try {
            const data = await binApi.fetchAll();
            setBins(data);
        } catch (err) {
            console.error('Failed to fetch bins:', err);
        }
    }, []);

    useEffect(() => { fetchBins(); }, [fetchBins]);

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: DEFAULT_CENTER,
            zoom: 15,
            zoomControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap',
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        mapRef.current = map;

        return () => { map.remove(); mapRef.current = null; };
    }, []);

    useEffect(() => {
        if (!mapRef.current) return;

        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        bins.forEach(bin => {
            const marker = L.marker([bin.lat, bin.lng], {
                icon: getBinIcon(bin.fill),
            })
                .addTo(mapRef.current!)
                .on('click', () => setSelectedBin(bin));

            markersRef.current.push(marker);
        });
    }, [bins]);

    useEffect(() => {
        if (!mapRef.current) return;

        if (!truckMarkerRef.current) {
            truckMarkerRef.current = L.marker(truckPosition, {
                icon: truckIcon,
                draggable: true,
            }).addTo(mapRef.current)
                .bindPopup('<b>Cop Kamyonu</b><br>Konumu surukleyerek ayarlayin.');

            truckMarkerRef.current.on('dragend', (e) => {
                const pos = (e.target as L.Marker).getLatLng();
                setTruckPosition([pos.lat, pos.lng]);
            });
        } else {
            truckMarkerRef.current.setLatLng(truckPosition);
        }
    }, [truckPosition]);

    const handleCollect = async (binId: number) => {
        try {
            await binApi.collect(binId);
            setBins(prev => prev.map(b => b.id === binId ? { ...b, fill: 0 } : b));
            setSelectedBin(null);
            showNotification('Cop toplama basarili');
        } catch {
            showNotification('Cop toplama basarisiz');
        }
    };

    const handleSimulate = async () => {
        try {
            const msg = await binApi.simulateTime();
            await fetchBins();
            showNotification(msg);
        } catch {
            showNotification('Simulasyon basarisiz');
        }
    };

    const handleOptimize = async () => {
        setIsOptimizing(true);
        setMetricsCollapsed(false);
        try {
            const data = await binApi.optimizeRoute(30, truckPosition[0], truckPosition[1]);

            if (polylineRef.current) {
                polylineRef.current.remove();
            }

            let latlngs: L.LatLngExpression[] = [];
            if (data.route_geometry?.length > 0) {
                latlngs = data.route_geometry as L.LatLngExpression[];
            } else if (data.route_sequence?.length > 0) {
                latlngs = data.route_sequence.map(s => [s.lat, s.lng] as L.LatLngExpression);
            }

            if (latlngs.length > 0 && mapRef.current) {
                polylineRef.current = L.polyline(latlngs, {
                    color: '#3388ff',
                    weight: 5,
                    opacity: 0.8,
                }).addTo(mapRef.current);

                mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });

                const binStops = data.route_sequence.filter((s: RouteStop) => s.type !== 'start' && s.type !== 'end');
                setRouteMetrics({
                    generatedAt: data.generated_at,
                    totalStops: data.total_stops,
                    totalDistanceKm: data.total_distance_km,
                    estimatedTimeMinutes: data.estimated_time_minutes,
                    stops: binStops,
                });

                showNotification(`Rota olusturuldu — ${data.total_distance_km.toFixed(1)} km — NN + 2-opt + Or-Opt`);
            } else {
                showNotification('Rota bulunamadi (esik ustu cop kutusu yok)');
            }
        } catch {
            showNotification('Rota optimizasyonu basarisiz');
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleClearRoute = () => {
        if (polylineRef.current) {
            polylineRef.current.remove();
            polylineRef.current = null;
        }
        setRouteMetrics(null);
    };

    const showNotification = (msg: string) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 3000);
    };

    const getFillColor = (fill: number) => {
        if (fill >= 80) return '#ff4757';
        if (fill >= 50) return '#ffa502';
        return '#2ed573';
    };

    return (
        <div className="map-page">
            {/* Top bar */}
            <div className="top-bar">
                <h2>Smart Waste</h2>
                <div className="profile-area">
                    <div
                        className="avatar"
                        onClick={() => setShowProfile(!showProfile)}
                    >
                        {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    {showProfile && (
                        <div className="profile-dropdown">
                            <div className="profile-name">{user?.full_name}</div>
                            <div className="profile-role">Truck Driver</div>
                            <div className="profile-username">@{user?.username}</div>
                            <button className="btn-logout" onClick={logout}>Cikis Yap</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Map */}
            <div ref={mapContainerRef} className="map-container" />

            {/* Notification toast */}
            {notification && (
                <div className="toast">{notification}</div>
            )}

            {/* Bottom action bar */}
            <div className="action-bar">
                <button
                    className="action-btn optimize"
                    onClick={handleOptimize}
                    disabled={isOptimizing}
                >
                    {isOptimizing ? 'Hesaplaniyor...' : 'Rota Olustur'}
                </button>

                <button className="action-btn simulate" onClick={handleSimulate}>
                    Simule Et
                </button>

                {routeMetrics && (
                    <button className="action-btn clear" onClick={handleClearRoute}>
                        Rotayi Temizle
                    </button>
                )}
            </div>

            {/* Route metrics panel — collapsible */}
            {routeMetrics && (
                <div className="metrics-panel">
                    <div className="metrics-header" onClick={() => setMetricsCollapsed(!metricsCollapsed)}>
                        <div className="metrics-header-left">
                            <span>Rota Bilgisi</span>
                            <span className="algo-badge">NN + 2-opt + Or-Opt</span>
                        </div>
                        <button className={`metrics-toggle ${metricsCollapsed ? 'collapsed' : ''}`}>
                            &#9650;
                        </button>
                    </div>
                    <div className={`metrics-body ${metricsCollapsed ? 'collapsed' : ''}`}>
                        <div className="metrics-summary">
                            <div className="metric">
                                <span className="metric-value">{routeMetrics.totalDistanceKm.toFixed(1)}</span>
                                <span className="metric-label">km</span>
                            </div>
                            <div className="metric">
                                <span className="metric-value">{Math.round(routeMetrics.estimatedTimeMinutes)}</span>
                                <span className="metric-label">dk</span>
                            </div>
                            <div className="metric">
                                <span className="metric-value">{routeMetrics.totalStops}</span>
                                <span className="metric-label">durak</span>
                            </div>
                        </div>
                        <div className="metrics-stops">
                            {routeMetrics.stops.map((stop, i) => (
                                <div key={stop.id} className="stop-item">
                                    <div
                                        className="stop-num"
                                        style={{ backgroundColor: getFillColor(stop.fill_level) }}
                                    >
                                        {i + 1}
                                    </div>
                                    <span className="stop-title">{stop.title}</span>
                                    <span className="stop-fill">{stop.fill_level}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Bin detail bottom sheet */}
            {selectedBin && (
                <div className="bin-sheet">
                    <div className="bin-sheet-header">
                        <div>
                            <h3>{selectedBin.title}</h3>
                            <p className="bin-id">Bin #{selectedBin.id}</p>
                        </div>
                        <button className="btn-close" onClick={() => setSelectedBin(null)}>X</button>
                    </div>

                    <div className="fill-bar-container">
                        <div className="fill-bar-label">
                            <span>Doluluk</span>
                            <span style={{ color: getFillColor(selectedBin.fill), fontWeight: 700 }}>
                                {selectedBin.fill}%
                            </span>
                        </div>
                        <div className="fill-bar-track">
                            <div
                                className="fill-bar-fill"
                                style={{
                                    width: `${selectedBin.fill}%`,
                                    backgroundColor: getFillColor(selectedBin.fill),
                                }}
                            />
                        </div>
                    </div>

                    <button
                        className="btn-collect"
                        onClick={() => handleCollect(selectedBin.id)}
                    >
                        Cop Topla (Collect)
                    </button>
                </div>
            )}
        </div>
    );
}
