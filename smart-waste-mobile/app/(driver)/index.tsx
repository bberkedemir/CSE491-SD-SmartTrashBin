import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Alert, Modal, ScrollView } from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Text, FAB, Card, Chip, Button, ActivityIndicator, IconButton } from 'react-native-paper';
import { router } from 'expo-router';
import { getBins, getOptimizedRoute } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { Bin, RouteResponse } from '../../types';

const DEFAULT_REGION = {
  latitude: 36.892539,
  longitude: 30.663895,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export default function MapScreen() {
  const { user, logout } = useAuth();
  const mapRef = useRef<MapView>(null);

  const [bins, setBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);

  useEffect(() => {
    loadBins();
    requestLocation();
  }, []);

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLocation(loc);
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
    try {
      const data = await getBins();
      setBins(data);
    } catch {
      Alert.alert('Error', 'Failed to load bins.');
    } finally {
      setLoading(false);
    }
  };

  const handleGetRoute = async () => {
    const lat = location?.coords.latitude ?? DEFAULT_REGION.latitude;
    const lng = location?.coords.longitude ?? DEFAULT_REGION.longitude;
    setRouteLoading(true);
    try {
      const r = await getOptimizedRoute(lat, lng);
      if (r.stops.length === 0) {
        Alert.alert('No bins', 'No bins are above the fill threshold right now.');
        return;
      }
      setRoute(r);
      // Fit map to show all route stops
      const coords = r.stops.map((s) => ({ latitude: s.lat, longitude: s.lng }));
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

  const handleStartRoute = () => {
    if (!route) return;
    router.push({ pathname: '/(driver)/route', params: { routeJson: JSON.stringify(route) } });
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const routePolyline =
    route?.geometry?.map(([lng, lat]) => ({ latitude: lat, longitude: lng })) ?? [];

  const fullBins = bins.filter((b) => b.fill >= 75);

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Bin markers */}
        {bins.map((bin) => (
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

        {/* Route polyline */}
        {routePolyline.length > 0 && (
          <Polyline
            coordinates={routePolyline}
            strokeColor="#2e7d32"
            strokeWidth={3}
            lineDashPattern={[1]}
          />
        )}

        {/* Route stop order numbers */}
        {route?.stops.map((stop, i) => (
          <Marker
            key={`stop-${stop.bin_id}`}
            coordinate={{ latitude: stop.lat, longitude: stop.lng }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.stopBadge}>
              <Text style={styles.stopBadgeText}>{i + 1}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Top overlay: user chip + stats */}
      <View style={styles.topOverlay}>
        <View style={styles.statsRow}>
          <View style={styles.statBubble}>
            <Text style={styles.statNum}>{bins.length}</Text>
            <Text style={styles.statLbl}>Bins</Text>
          </View>
          <View style={[styles.statBubble, { borderColor: '#e65100' }]}>
            <Text style={[styles.statNum, { color: '#e65100' }]}>{fullBins.length}</Text>
            <Text style={styles.statLbl}>Need pickup</Text>
          </View>
        </View>
        <IconButton
          icon="logout"
          size={20}
          style={styles.logoutBtn}
          onPress={handleLogout}
        />
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { color: '#2e7d32', label: '<50%' },
          { color: '#f9a825', label: '50–75%' },
          { color: '#e65100', label: '75–90%' },
          { color: '#c62828', label: '>90%' },
        ].map((l) => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={styles.legendLabel}>{l.label}</Text>
          </View>
        ))}
      </View>

      {/* Route result banner */}
      {route && (
        <View style={styles.routeBanner}>
          <View>
            <Text style={styles.bannerTitle}>Route ready — {route.stops.length} stops</Text>
            <Text style={styles.bannerSub}>
              {(route.total_distance_m / 1000).toFixed(1)} km · {Math.round(route.total_duration_s / 60)} min
            </Text>
          </View>
          <Button mode="contained" compact onPress={handleStartRoute} style={styles.startBtn}>
            Start
          </Button>
        </View>
      )}

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={{ marginTop: 8, color: '#37474f' }}>Loading bins…</Text>
        </View>
      )}

      {/* FABs */}
      <View style={styles.fabGroup}>
        <FAB
          icon="crosshairs-gps"
          size="small"
          style={styles.fabLocation}
          onPress={requestLocation}
        />
        <FAB
          icon={routeLoading ? 'loading' : 'map-marker-path'}
          label={routeLoading ? 'Computing…' : 'Get Route'}
          style={styles.fabRoute}
          onPress={handleGetRoute}
          loading={routeLoading}
          disabled={routeLoading || loading}
        />
      </View>

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
                  <Chip
                    style={{ backgroundColor: markerColor(selectedBin.fill) }}
                    textStyle={{ color: '#fff' }}
                    icon="trash-can"
                  >
                    {selectedBin.fill}% full
                  </Chip>
                  <Chip icon="map-marker" compact>
                    {selectedBin.lat.toFixed(4)}, {selectedBin.lng.toFixed(4)}
                  </Chip>
                </View>
                <FillBar fill={selectedBin.fill} />
                <Button
                  mode="outlined"
                  onPress={() => setSelectedBin(null)}
                  style={{ marginTop: 12 }}
                >
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
      <View
        style={[
          fillBarStyles.bar,
          { width: `${fill}%` as any, backgroundColor: markerColor(fill) },
        ]}
      />
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

  // Markers
  markerOuter: {
    borderRadius: 20,
    borderWidth: 2,
    padding: 2,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
  },
  markerInner: { borderRadius: 14, paddingHorizontal: 6, paddingVertical: 3 },
  markerText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  // Route stop badge
  stopBadge: {
    backgroundColor: '#2e7d32',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  stopBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  // Top overlay
  topOverlay: {
    position: 'absolute',
    top: 48,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBubble: {
    backgroundColor: '#ffffffee',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#2e7d32',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  statNum: { fontWeight: 'bold', fontSize: 18, color: '#2e7d32' },
  statLbl: { fontSize: 11, color: '#546e7a' },
  logoutBtn: { backgroundColor: '#ffffffee' },

  // Legend
  legend: {
    position: 'absolute',
    bottom: 120,
    left: 12,
    backgroundColor: '#ffffffee',
    borderRadius: 10,
    padding: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 11, color: '#37474f' },

  // Route banner
  routeBanner: {
    position: 'absolute',
    bottom: 80,
    left: 12,
    right: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a5d6a7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  bannerTitle: { fontWeight: '700', color: '#1b5e20', fontSize: 14 },
  bannerSub: { color: '#558b2f', fontSize: 12, marginTop: 2 },
  startBtn: { backgroundColor: '#2e7d32' },

  // FABs
  fabGroup: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    gap: 10,
    alignItems: 'flex-end',
  },
  fabLocation: { backgroundColor: '#fff' },
  fabRoute: { backgroundColor: '#2e7d32' },

  // Loading overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffffcc',
  },

  // Bin detail modal
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#00000040',
  },
  binSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#cfd8dc',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: { fontWeight: '700', color: '#1b5e20', marginBottom: 10 },
  sheetRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
