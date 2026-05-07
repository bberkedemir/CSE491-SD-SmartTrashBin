import { useEffect, useRef, useState } from 'react';
import { Image, View, StyleSheet, Alert, Modal } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import type { LatLng } from 'react-native-maps';
import * as Location from 'expo-location';
import { Text, FAB, Chip, Button, ActivityIndicator, IconButton } from 'react-native-paper';
import { router } from 'expo-router';
import { API_BASE_URL, getBins, getOptimizedRoute, getRoadAnomalies, startTrackingSession, completeTrackingSession } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useRoute } from '../../context/RouteContext';
import ErrorState from '../../components/ErrorState';
import type { Bin, RoadAnomaly, RouteResponse } from '../../types';

/**
 * Ported from web UI useRouteOptimization.ts:
 * Finds the closest point in the remaining geometry to the truck's new position,
 * slices from there, and prepends the truck's exact location.
 * No API call — pure client-side geometry update.
 */
function sliceGeometryFromTruck(
  fullGeometry: [number, number][],
  fromIndex: number,
  truckLat: number,
  truckLng: number
): { polyline: LatLng[]; newIndex: number } {
  let closestIndex = fromIndex;
  let minDistSq = Infinity;

  for (let i = fromIndex; i < fullGeometry.length; i++) {
    const [lat, lng] = fullGeometry[i];
    const distSq = (lat - truckLat) ** 2 + (lng - truckLng) ** 2;
    // Sequential penalty: prefer points earlier in the sequence when physically equidistant
    const penalized = distSq + (i - fromIndex) * 0.00000001;
    if (penalized < minDistSq) {
      minDistSq = penalized;
      closestIndex = i;
    }
  }

  const remaining = fullGeometry.slice(closestIndex);
  const polyline: LatLng[] = [
    { latitude: truckLat, longitude: truckLng },
    ...remaining.map(([lat, lng]) => ({ latitude: lat, longitude: lng })),
  ];

  return { polyline, newIndex: closestIndex };
}

const DEFAULT_REGION = {
  latitude: 36.892539,
  longitude: 30.663895,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export default function MapScreen() {
  const { user, logout } = useAuth();
  const { activeRoute, setActiveRoute } = useRoute();
  const mapRef = useRef<MapView>(null);
  const hasDragged = useRef(false);

  const [bins, setBins] = useState<Bin[]>([]);
  const [roadAnomalies, setRoadAnomalies] = useState<RoadAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [binsError, setBinsError] = useState('');
  const [routeLoading, setRouteLoading] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [truckPosition, setTruckPosition] = useState<LatLng>({
    latitude: DEFAULT_REGION.latitude,
    longitude: DEFAULT_REGION.longitude,
  });
  const [route, setRoute] = useState<RouteResponse | null>(null);
  // Full original geometry stored once after optimization; never re-fetched on drag
  const fullGeometry = useRef<[number, number][]>([]);
  const geometryIndex = useRef(0);
  // The polyline currently drawn — updated cheaply on drag without an API call
  const [displayPolyline, setDisplayPolyline] = useState<LatLng[]>([]);
  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState<RoadAnomaly | null>(null);

  useEffect(() => {
    loadBins();
    loadRoadAnomalies();
    requestLocation();
  }, []);

  // Clear local route state when the active route is cleared (e.g. after summary)
  useEffect(() => {
    if (activeRoute === null) {
      setRoute(null);
      setDisplayPolyline([]);
      fullGeometry.current = [];
      geometryIndex.current = 0;
    }
  }, [activeRoute]);

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLocation(loc);
    // Only sync truck position with GPS if driver hasn't manually dragged it yet
    if (!hasDragged.current) {
      setTruckPosition({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    }
    mapRef.current?.animateToRegion(
      {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      800
    );
  };

  const loadBins = async () => {
    setLoading(true);
    setBinsError('');
    try {
      const data = await getBins();
      setBins(data);
    } catch {
      setBinsError('Could not load bins. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const loadRoadAnomalies = async () => {
    try {
      const data = await getRoadAnomalies();
      setRoadAnomalies(data.filter((item) => item.latitude !== null && item.longitude !== null));
    } catch {
      // Keep bin tracking usable if anomaly history is temporarily unavailable.
    }
  };

  const handleGetRoute = async () => {
    setRouteLoading(true);
    try {
      const r = await getOptimizedRoute(truckPosition.latitude, truckPosition.longitude);
      const pickupStops = r.route_sequence.filter((s) => s.type === 'pickup');
      if (pickupStops.length === 0) {
        Alert.alert('No bins', 'No bins are above the fill threshold right now.');
        return;
      }
      // Store full geometry for cheap client-side slicing on drag
      const geo = r.route_geometry as [number, number][];
      fullGeometry.current = geo;
      geometryIndex.current = 0;
      setRoute(r);
      setActiveRoute(r);  // share with Route tab via context
      setDisplayPolyline(geo.map(([lat, lng]) => ({ latitude: lat, longitude: lng })));
      // Start live tracking session (non-blocking)
      startTrackingSession({
        route_stops: r.route_sequence,
        route_geometry: r.route_geometry as [number, number][],
        current_lat: truckPosition.latitude,
        current_lng: truckPosition.longitude,
      }).catch(() => { });
      const coords = pickupStops.map((s) => ({ latitude: s.lat, longitude: s.lng }));
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 40, bottom: 120, left: 40 },
        animated: true,
      });
    } catch {
      Alert.alert('Error', 'Could not compute route. Check your connection.');
    } finally {
      setRouteLoading(false);
    }
  };

  const handleTruckDragEnd = (e: { nativeEvent: { coordinate: LatLng } }) => {
    const newPos = e.nativeEvent.coordinate;
    hasDragged.current = true;
    setTruckPosition(newPos);
    // If a route is active, slice the stored geometry from the nearest remaining point.
    // No API call — matches the web UI behaviour exactly.
    if (route && fullGeometry.current.length > 0) {
      const { polyline, newIndex } = sliceGeometryFromTruck(
        fullGeometry.current,
        geometryIndex.current,
        newPos.latitude,
        newPos.longitude
      );
      geometryIndex.current = newIndex;
      setDisplayPolyline(polyline);
    }
  };

  const handleStopRoute = () => {
    completeTrackingSession({ collected_ids: [], skipped_ids: [] }).catch(() => { });
    setActiveRoute(null);
    setRoute(null);
    setDisplayPolyline([]);
    fullGeometry.current = [];
    geometryIndex.current = 0;
    hasDragged.current = false;
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const fullBins = bins.filter((b) => b.fill >= 30);
  const avgFill = bins.length > 0 ? bins.reduce((s, b) => s + b.fill, 0) / bins.length : 0;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Bin markers — when a route is active, only show bins included in the route */}
        {(route
          ? bins.filter((b) =>
            route.route_sequence.some((s) => s.type === 'pickup' && s.id === b.id)
          )
          : bins
        ).map((bin) => (
          <Marker
            key={bin.id}
            coordinate={{ latitude: bin.lat, longitude: bin.lng }}
            onPress={() => setSelectedBin(bin)}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.markerOuter, { borderColor: markerBorderColor(bin.fill) }]}>
              <View style={[styles.markerInner, { backgroundColor: markerColor(bin.fill) }]}>
                <Text style={styles.markerText}>{bin.fill}%</Text>
              </View>
            </View>
          </Marker>
        ))}

        {/* Route polyline — sliced from truck position on drag, no API call */}
        {roadAnomalies.map((anomaly) => (
          <Marker
            key={`anomaly-${anomaly.id}`}
            coordinate={{ latitude: anomaly.latitude!, longitude: anomaly.longitude! }}
            onPress={() => setSelectedAnomaly(anomaly)}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={8}
          >
            <View style={styles.anomalyMarkerOuter}>
              <View style={styles.anomalyMarkerInner}>
                <Text style={styles.anomalyMarkerText}>!</Text>
              </View>
            </View>
          </Marker>
        ))}

        {displayPolyline.length > 0 && (
          <Polyline
            coordinates={displayPolyline}
            strokeColor="#2e7d32"
            strokeWidth={3}
            lineDashPattern={[1]}
          />
        )}

        {/* Route stop order badges — pickup stops only */}
        {route?.route_sequence.filter((s) => s.type === 'pickup').map((stop, i) => (
          <Marker
            key={`stop-${stop.id}`}
            coordinate={{ latitude: stop.lat, longitude: stop.lng }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.stopBadge}>
              <Text style={styles.stopBadgeText}>{i + 1}</Text>
            </View>
          </Marker>
        ))}

        {/* Draggable truck marker */}
        <Marker
          coordinate={truckPosition}
          draggable
          onDragEnd={handleTruckDragEnd}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={10}
        >
          <View style={styles.truckMarker}>
            <Text style={styles.truckEmoji}>🚛</Text>
            {!hasDragged.current && (
              <View style={styles.dragHint}>
                <Text style={styles.dragHintText}>Drag to replan</Text>
              </View>
            )}
          </View>
        </Marker>
      </MapView>

      {/* Top overlay: stats + logout */}
      <View style={styles.topOverlay}>
        <View style={styles.statsRow}>
          <View style={styles.statBubble}>
            <Text style={styles.statNum}>{bins.length}</Text>
            <Text style={styles.statLbl}>Bins</Text>
          </View>
          <View style={[styles.statBubble, { borderColor: '#1976d2' }]}>
            <Text style={[styles.statNum, { color: '#1976d2' }]}>{avgFill.toFixed(1)}%</Text>
            <Text style={styles.statLbl}>Avg fill</Text>
          </View>
          <View style={[styles.statBubble, { borderColor: '#e65100' }]}>
            <Text style={[styles.statNum, { color: '#e65100' }]}>{fullBins.length}</Text>
            <Text style={styles.statLbl}>Need pickup</Text>
          </View>
        </View>
        <IconButton icon="logout" size={20} style={styles.logoutBtn} onPress={handleLogout} />
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { color: '#2e7d32', label: '<50%' },
          { color: '#f9a825', label: '50–75%' },
          { color: '#e65100', label: '75–90%' },
          { color: '#c62828', label: '>90%' },
          { color: '#7b1fa2', label: 'Road anomaly' },
        ].map((l) => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={styles.legendLabel}>{l.label}</Text>
          </View>
        ))}
      </View>

      {/* Route banner */}
      {route && (
        <View style={styles.routeBanner}>
          <View>
            <Text style={styles.bannerTitle}>Route ready — {route.total_stops} stops</Text>
            <Text style={styles.bannerSub}>
              {route.total_distance_km.toFixed(1)} km · {Math.round(route.estimated_time_minutes)} min
            </Text>
          </View>
          <View style={styles.bannerButtons}>
            <Button mode="contained" compact icon="stop-circle-outline" onPress={handleStopRoute} style={styles.startBtn}>
              Stop
            </Button>
            <Button mode="outlined" compact icon="map-marker-path" onPress={() => router.push('/(driver)/route')} style={styles.routeBtn}>
              Route
            </Button>
          </View>
        </View>
      )}

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={{ marginTop: 8, color: '#37474f' }}>Loading bins…</Text>
        </View>
      )}

      {/* Error overlay */}
      {!loading && binsError ? (
        <View style={styles.loadingOverlay}>
          <ErrorState message={binsError} onRetry={loadBins} />
        </View>
      ) : null}

      {/* Small utility FABs — anchored above the route banner so they never overlap */}
      <View style={styles.fabSmallGroup}>
        <FAB icon="refresh" size="small" style={styles.fabSmall} onPress={() => { loadBins(); loadRoadAnomalies(); }} disabled={loading} />
        <FAB icon="crosshairs-gps" size="small" style={styles.fabSmall} onPress={requestLocation} />
      </View>

      {/* Get Route FAB — bottom right */}
      <FAB
        icon={routeLoading ? 'loading' : 'map-marker-path'}
        label={routeLoading ? 'Computing…' : 'Get Route'}
        style={styles.fabRoute}
        onPress={handleGetRoute}
        loading={routeLoading}
        disabled={routeLoading || loading}
      />

      {/* Bin detail bottom sheet */}
      <Modal
        visible={!!selectedBin}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedBin(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.binSheet}>
            {selectedBin && (
              <>
                <View style={styles.sheetHandle} />
                <Text variant="titleMedium" style={styles.sheetTitle}>{selectedBin.title}</Text>
                <View style={styles.sheetRow}>
                  <Chip style={{ backgroundColor: markerColor(selectedBin.fill) }} textStyle={{ color: '#fff' }} icon="trash-can">
                    {selectedBin.fill}% full
                  </Chip>
                  <Chip icon="map-marker" compact>
                    {selectedBin.lat.toFixed(4)}, {selectedBin.lng.toFixed(4)}
                  </Chip>
                </View>
                <FillBar fill={selectedBin.fill} />
                <Button mode="outlined" onPress={() => setSelectedBin(null)} style={{ marginTop: 12 }}>
                  Close
                </Button>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!selectedAnomaly}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedAnomaly(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.binSheet}>
            {selectedAnomaly && (
              <>
                <View style={styles.sheetHandle} />
                <Text variant="titleMedium" style={styles.anomalySheetTitle}>Road Anomaly</Text>
                {selectedAnomaly.image_url && (
                  <Image
                    source={{ uri: `${API_BASE_URL}${selectedAnomaly.image_url}` }}
                    style={styles.anomalyImage}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.sheetRow}>
                  <Chip icon="road-variant" style={styles.anomalyChip} textStyle={{ color: '#fff' }}>
                    {selectedAnomaly.class_name}
                  </Chip>
                  <Chip icon="percent" compact>
                    {(selectedAnomaly.confidence * 100).toFixed(0)}% confidence
                  </Chip>
                  <Chip icon="timer-outline" compact>
                    {selectedAnomaly.timestamp_seconds.toFixed(1)}s
                  </Chip>
                  <Chip icon="map-marker" compact>
                    {selectedAnomaly.latitude?.toFixed(4)}, {selectedAnomaly.longitude?.toFixed(4)}
                  </Chip>
                </View>
                <Button mode="outlined" onPress={() => setSelectedAnomaly(null)} style={{ marginTop: 12 }}>
                  Close
                </Button>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FillBar({ fill }: { fill: number }) {
  return (
    <View style={fillBarStyles.track}>
      <View style={[fillBarStyles.bar, { width: `${fill}%` as any, backgroundColor: markerColor(fill) }]} />
    </View>
  );
}

const fillBarStyles = StyleSheet.create({
  track: { height: 10, backgroundColor: '#e0e0e0', borderRadius: 5, marginTop: 12, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 5 },
});

function markerColor(fill: number) {
  if (fill >= 90) return '#c62828';
  if (fill >= 75) return '#e65100';
  if (fill >= 50) return '#f9a825';
  return '#2e7d32';
}

function markerBorderColor(fill: number) {
  if (fill >= 90) return '#b71c1c';
  if (fill >= 75) return '#bf360c';
  if (fill >= 50) return '#f57f17';
  return '#1b5e20';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  markerOuter: { borderRadius: 20, borderWidth: 2, padding: 2, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 4 },
  markerInner: { borderRadius: 14, paddingHorizontal: 6, paddingVertical: 3 },
  markerText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  anomalyMarkerOuter: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', borderWidth: 2, borderColor: '#4a148c', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },
  anomalyMarkerInner: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#7b1fa2', justifyContent: 'center', alignItems: 'center' },
  anomalyMarkerText: { color: '#fff', fontSize: 17, fontWeight: '900' },

  stopBadge: { backgroundColor: '#2e7d32', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  stopBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  // Truck marker
  truckMarker: { alignItems: 'center' },
  truckEmoji: { fontSize: 32 },
  dragHint: { backgroundColor: '#1b5e20ee', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
  dragHintText: { color: '#fff', fontSize: 10, fontWeight: '600' },

  topOverlay: { position: 'absolute', top: 48, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBubble: { backgroundColor: '#ffffffee', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', borderWidth: 1.5, borderColor: '#2e7d32', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 3 },
  statNum: { fontWeight: 'bold', fontSize: 18, color: '#2e7d32' },
  statLbl: { fontSize: 11, color: '#546e7a' },
  logoutBtn: { backgroundColor: '#ffffffee' },

  legend: { position: 'absolute', bottom: 120, left: 12, backgroundColor: '#ffffffee', borderRadius: 10, padding: 8, gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 3 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 11, color: '#37474f' },

  routeBanner: { position: 'absolute', bottom: 80, left: 12, right: 12, backgroundColor: '#e8f5e9', borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#a5d6a7', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  bannerTitle: { fontWeight: '700', color: '#1b5e20', fontSize: 14 },
  bannerSub: { color: '#558b2f', fontSize: 12, marginTop: 2 },
  bannerButtons: { flexDirection: 'row', gap: 8 },
  startBtn: { backgroundColor: '#2e7d32' },
  routeBtn: { borderColor: '#2e7d32' },

  fabSmallGroup: { position: 'absolute', bottom: 170, right: 16, gap: 10, alignItems: 'flex-end' },
  fabSmall: { backgroundColor: '#fff' },
  fabRoute: { position: 'absolute', bottom: 16, right: 16, backgroundColor: '#2e7d32' },

  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffffcc' },

  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000040' },
  binSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#cfd8dc', alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontWeight: '700', color: '#1b5e20', marginBottom: 10 },
  anomalySheetTitle: { fontWeight: '700', color: '#4a148c', marginBottom: 10 },
  anomalyImage: { width: '100%', height: 180, borderRadius: 10, backgroundColor: '#eceff1', marginBottom: 12 },
  anomalyChip: { backgroundColor: '#7b1fa2' },
  sheetRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
