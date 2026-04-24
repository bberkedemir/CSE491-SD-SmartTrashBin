import { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, FAB, Card, Chip, ActivityIndicator } from 'react-native-paper';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { getBins, getOptimizedRoute } from '../../services/api';
import type { Bin, RouteResponse } from '../../types';
import { useAuth } from '../../context/AuthContext';

export default function MapScreen() {
  const { user, logout } = useAuth();
  const [bins, setBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    loadBins();
    requestLocation();
  }, []);

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    setLocation(loc);
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
    const lat = location?.coords.latitude ?? 36.892539;
    const lng = location?.coords.longitude ?? 30.663895;
    setRouteLoading(true);
    try {
      const route = await getOptimizedRoute(lat, lng);
      if (route.stops.length === 0) {
        Alert.alert('No bins', 'No bins are above the fill threshold right now.');
        return;
      }
      // Pass route to the Route tab via global state / router params
      router.push({ pathname: '/(driver)/route', params: { routeJson: JSON.stringify(route) } });
    } catch {
      Alert.alert('Error', 'Could not compute route. Check your connection.');
    } finally {
      setRouteLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const fullBins = bins.filter((b) => b.fill >= 75);
  const avgFill = bins.length ? Math.round(bins.reduce((s, b) => s + b.fill, 0) / bins.length) : 0;

  return (
    <View style={styles.container}>
      {/* Stats summary (map will replace this area in Phase 2) */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <Text variant="headlineMedium" style={styles.statNumber}>{bins.length}</Text>
            <Text variant="bodySmall" style={styles.statLabel}>Total Bins</Text>
          </Card.Content>
        </Card>
        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <Text variant="headlineMedium" style={[styles.statNumber, { color: '#f57c00' }]}>
              {fullBins.length}
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>Need Collection</Text>
          </Card.Content>
        </Card>
        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <Text variant="headlineMedium" style={styles.statNumber}>{avgFill}%</Text>
            <Text variant="bodySmall" style={styles.statLabel}>Avg Fill</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Bin list */}
      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Bins Needing Collection ({fullBins.length})
        </Text>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : fullBins.length === 0 ? (
          <Text style={styles.emptyText}>All bins are below threshold.</Text>
        ) : (
          fullBins.slice(0, 6).map((bin) => (
            <Card key={bin.id} style={styles.binCard}>
              <Card.Content style={styles.binCardContent}>
                <Text variant="bodyMedium" style={{ flex: 1 }}>{bin.title}</Text>
                <Chip
                  compact
                  style={{ backgroundColor: fillColor(bin.fill) }}
                  textStyle={{ color: '#fff', fontSize: 12 }}
                >
                  {bin.fill}%
                </Chip>
              </Card.Content>
            </Card>
          ))
        )}
        {fullBins.length > 6 && (
          <Text style={styles.moreText}>+{fullBins.length - 6} more bins…</Text>
        )}
      </View>

      {/* Location chip */}
      <View style={styles.locationRow}>
        <Chip icon="crosshairs-gps" compact>
          {location ? 'GPS acquired' : 'Acquiring GPS…'}
        </Chip>
        <Chip icon="account" compact onPress={handleLogout}>
          {user?.username}
        </Chip>
      </View>

      <FAB
        icon={routeLoading ? 'loading' : 'map-marker-path'}
        label="Get Optimized Route"
        style={styles.fab}
        onPress={handleGetRoute}
        loading={routeLoading}
        disabled={routeLoading}
      />
    </View>
  );
}

function fillColor(fill: number) {
  if (fill >= 90) return '#c62828';
  if (fill >= 75) return '#e65100';
  if (fill >= 50) return '#f9a825';
  return '#2e7d32';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16, paddingBottom: 80 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#fff' },
  statContent: { alignItems: 'center', paddingVertical: 12 },
  statNumber: { fontWeight: 'bold', color: '#2e7d32' },
  statLabel: { color: '#78909c', marginTop: 2, textAlign: 'center' },
  section: { flex: 1 },
  sectionTitle: { color: '#37474f', marginBottom: 8, fontWeight: '600' },
  binCard: { marginBottom: 6, backgroundColor: '#fff' },
  binCardContent: { flexDirection: 'row', alignItems: 'center' },
  emptyText: { color: '#90a4ae', textAlign: 'center', marginTop: 24 },
  moreText: { color: '#90a4ae', textAlign: 'center', marginTop: 8 },
  locationRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  fab: { position: 'absolute', bottom: 16, right: 16, left: 16, backgroundColor: '#2e7d32' },
});
