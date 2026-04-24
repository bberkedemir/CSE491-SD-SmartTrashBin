import { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Alert, Linking, ScrollView } from 'react-native';
import { Text, Button, Card, Chip, ProgressBar, Divider, Banner } from 'react-native-paper';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { collectBin } from '../../services/api';
import { useRoute } from '../../context/RouteContext';
import type { RouteResponse, RouteStop } from '../../types';

const PROXIMITY_METERS = 50;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function RouteScreen() {
  const { activeRoute } = useRoute();

  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [pickupStops, setPickupStops] = useState<RouteStop[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [collecting, setCollecting] = useState(false);
  const [collected, setCollected] = useState<Set<number>>(new Set());
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceToStop, setDistanceToStop] = useState<number | null>(null);
  const [proximityAlertShown, setProximityAlertShown] = useState(false);
  const [nearbyBanner, setNearbyBanner] = useState(false);

  const locationSub = useRef<Location.LocationSubscription | null>(null);

  // Sync from context whenever a new route is set from the Map tab
  useEffect(() => {
    if (!activeRoute) return;
    const pickups = activeRoute.route_sequence.filter((s) => s.type === 'pickup');
    setRoute(activeRoute);
    setPickupStops(pickups);
    setCurrentIndex(0);
    setCollected(new Set());
    setSkipped(new Set());
    setNearbyBanner(false);
  }, [activeRoute]);

  useEffect(() => {
    if (!route) return;
    startLocationTracking();
    return () => { locationSub.current?.remove(); };
  }, [route]);

  useEffect(() => {
    if (!driverLocation || pickupStops.length === 0) { setDistanceToStop(null); return; }
    const stop = pickupStops[currentIndex];
    if (!stop) return;
    const dist = haversine(driverLocation.lat, driverLocation.lng, stop.lat, stop.lng);
    setDistanceToStop(dist);
    if (dist <= PROXIMITY_METERS && !proximityAlertShown) {
      setProximityAlertShown(true);
      setNearbyBanner(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [driverLocation, currentIndex, pickupStops]);

  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000 },
      (loc) => setDriverLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude })
    );
  };

  const advanceToNextStop = useCallback(
    (updatedCollected: Set<number>, updatedSkipped: Set<number>, fromIndex: number) => {
      const remaining = pickupStops.findIndex(
        (s, i) => i > fromIndex && !updatedCollected.has(s.id) && !updatedSkipped.has(s.id)
      );
      if (remaining === -1) {
        router.replace({
          pathname: '/(driver)/summary',
          params: {
            collectedJson: JSON.stringify([...updatedCollected]),
            skippedJson: JSON.stringify([...updatedSkipped]),
          },
        });
      } else {
        setCurrentIndex(remaining);
        setProximityAlertShown(false);
        setNearbyBanner(false);
      }
    },
    [route, pickupStops]
  );

  const handleCollect = async () => {
    const stop = pickupStops[currentIndex];
    if (!stop) return;
    setCollecting(true);
    try {
      await collectBin(stop.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const next = new Set(collected);
      next.add(stop.id);
      setCollected(next);
      setNearbyBanner(false);
      advanceToNextStop(next, skipped, currentIndex);
    } catch {
      Alert.alert('Error', 'Failed to mark bin as collected. Try again.');
    } finally {
      setCollecting(false);
    }
  };

  const handleSkip = () => {
    const stop = pickupStops[currentIndex];
    if (!stop) return;
    Alert.alert(
      'Skip this stop?',
      `"${stop.title}" will be marked as skipped and you'll move to the next bin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const next = new Set(skipped);
            next.add(stop.id);
            setSkipped(next);
            setNearbyBanner(false);
            advanceToNextStop(collected, next, currentIndex);
          },
        },
      ]
    );
  };

  const openNavigation = (s: RouteStop) => {
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=driving`
    );
  };

  if (!route || pickupStops.length === 0) {
    return (
      <View style={styles.empty}>
        <Text variant="titleMedium" style={styles.emptyTitle}>No Active Route</Text>
        <Text variant="bodyMedium" style={styles.emptySubtitle}>
          Go to the Map tab and tap "Get Route" to start.
        </Text>
        <Button mode="contained" onPress={() => router.push('/(driver)')} style={{ marginTop: 24 }}>
          Go to Map
        </Button>
      </View>
    );
  }

  const stop = pickupStops[currentIndex];
  const done = collected.size + skipped.size;
  const progress = done / pickupStops.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Proximity alert banner */}
      <Banner
        visible={nearbyBanner}
        icon="map-marker-check"
        actions={[{ label: 'Dismiss', onPress: () => setNearbyBanner(false) }]}
        style={styles.banner}
      >
        <Text style={{ color: '#1b5e20', fontWeight: '600' }}>
          You are within {PROXIMITY_METERS} m of "{stop?.title}". Ready to collect!
        </Text>
      </Banner>

      {/* Route summary card */}
      <Card style={styles.summaryCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Route Summary</Text>
          <View style={styles.chipRow}>
            <Chip icon="map-marker-multiple">{pickupStops.length} stops</Chip>
            <Chip icon="road-variant">{route.total_distance_km.toFixed(1)} km</Chip>
            <Chip icon="clock-outline">{Math.round(route.estimated_time_minutes)} min</Chip>
          </View>
          <ProgressBar progress={progress} color="#2e7d32" style={styles.progress} />
          <View style={styles.progressLabelRow}>
            <Text variant="bodySmall" style={styles.progressLabel}>
              {collected.size} collected · {skipped.size} skipped
            </Text>
            <Text variant="bodySmall" style={styles.progressLabel}>
              {pickupStops.length - done} remaining
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Current stop card */}
      {stop && (
        <Card style={styles.currentCard}>
          <Card.Content>
            <View style={styles.currentHeader}>
              <Text variant="labelSmall" style={styles.currentLabel}>CURRENT STOP</Text>
              {distanceToStop !== null && (
                <Chip
                  compact
                  icon={distanceToStop <= PROXIMITY_METERS ? 'map-marker-check' : 'map-marker-distance'}
                  style={distanceToStop <= PROXIMITY_METERS ? styles.nearChip : styles.distChip}
                  textStyle={{ fontSize: 12 }}
                >
                  {distanceToStop <= PROXIMITY_METERS ? 'Arrived' : formatDistance(distanceToStop)}
                </Chip>
              )}
            </View>

            <Text variant="headlineSmall" style={styles.stopTitle}>{stop.title}</Text>

            <View style={styles.chipRow}>
              <Chip
                compact
                style={{ backgroundColor: fillColor(stop.fill_level) }}
                textStyle={{ color: '#fff' }}
                icon="trash-can"
              >
                {stop.fill_level}% full
              </Chip>
              <Chip compact icon="map-marker">
                {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
              </Chip>
              <Chip compact icon="counter">Stop {currentIndex + 1}</Chip>
            </View>
          </Card.Content>

          <Card.Actions style={styles.cardActions}>
            <Button mode="outlined" icon="skip-next" onPress={handleSkip} disabled={collecting} textColor="#e65100">
              Skip
            </Button>
            <Button mode="outlined" icon="google-maps" onPress={() => openNavigation(stop)}>
              Navigate
            </Button>
            <Button
              mode="contained"
              icon="check-circle"
              onPress={handleCollect}
              loading={collecting}
              disabled={collecting}
            >
              Collected
            </Button>
          </Card.Actions>
        </Card>
      )}

      {/* GPS status */}
      <View style={styles.gpsRow}>
        <Chip
          compact
          icon={driverLocation ? 'crosshairs-gps' : 'crosshairs'}
          style={driverLocation ? styles.gpsActive : styles.gpsInactive}
        >
          {driverLocation
            ? `GPS: ${driverLocation.lat.toFixed(4)}, ${driverLocation.lng.toFixed(4)}`
            : 'Acquiring GPS…'}
        </Chip>
      </View>

      <Divider style={{ marginVertical: 16 }} />

      {/* All stops list */}
      <Text variant="titleSmall" style={styles.allStopsTitle}>All Stops</Text>
      {pickupStops.map((s, i) => {
        const isDone = collected.has(s.id);
        const isSkipped = skipped.has(s.id);
        const isCurrent = i === currentIndex;
        return (
          <View key={s.id} style={[styles.stopItem, isCurrent && styles.stopItemCurrent]}>
            <View style={[styles.stopIndex, isDone && styles.stopIndexDone, isSkipped && styles.stopIndexSkipped, isCurrent && styles.stopIndexCurrent]}>
              <Text style={styles.stopIndexText}>
                {isDone ? '✓' : isSkipped ? '—' : i + 1}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" style={[isDone && styles.strikethrough, isSkipped && styles.skippedText]}>
                {s.title}
              </Text>
              {isSkipped && <Text variant="bodySmall" style={styles.skippedLabel}>Skipped</Text>}
            </View>
            <Chip
              compact
              style={{ backgroundColor: fillColor(s.fill_level) }}
              textStyle={{ color: '#fff', fontSize: 11 }}
            >
              {s.fill_level}%
            </Chip>
          </View>
        );
      })}
    </ScrollView>
  );
}

function fillColor(fill: number) {
  if (fill >= 90) return '#c62828';
  if (fill >= 75) return '#e65100';
  if (fill >= 50) return '#f9a825';
  return '#2e7d32';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { paddingBottom: 48 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { color: '#37474f', fontWeight: 'bold', marginBottom: 8 },
  emptySubtitle: { color: '#90a4ae', textAlign: 'center' },
  banner: { backgroundColor: '#c8e6c9', margin: 0 },
  summaryCard: { backgroundColor: '#fff', margin: 12, marginBottom: 8 },
  sectionTitle: { fontWeight: '600', color: '#37474f', marginBottom: 10 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  progress: { height: 8, borderRadius: 4 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressLabel: { color: '#78909c' },
  currentCard: { backgroundColor: '#e8f5e9', marginHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: '#a5d6a7' },
  currentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  currentLabel: { color: '#558b2f', fontWeight: 'bold', letterSpacing: 1 },
  nearChip: { backgroundColor: '#2e7d32' },
  distChip: { backgroundColor: '#f5f5f5' },
  stopTitle: { color: '#1b5e20', fontWeight: 'bold', marginBottom: 8 },
  cardActions: { justifyContent: 'flex-end', gap: 6, paddingBottom: 8, flexWrap: 'wrap' },
  gpsRow: { paddingHorizontal: 12, marginBottom: 4 },
  gpsActive: { backgroundColor: '#e8f5e9' },
  gpsInactive: { backgroundColor: '#fafafa' },
  allStopsTitle: { color: '#546e7a', marginBottom: 8, fontWeight: '600', paddingHorizontal: 12 },
  stopItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#eeeeee' },
  stopItemCurrent: { backgroundColor: '#f1f8e9' },
  stopIndex: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#cfd8dc', justifyContent: 'center', alignItems: 'center' },
  stopIndexDone: { backgroundColor: '#2e7d32' },
  stopIndexSkipped: { backgroundColor: '#bdbdbd' },
  stopIndexCurrent: { backgroundColor: '#e65100' },
  stopIndexText: { fontWeight: 'bold', fontSize: 13, color: '#fff' },
  strikethrough: { textDecorationLine: 'line-through', color: '#bdbdbd' },
  skippedText: { color: '#bdbdbd' },
  skippedLabel: { color: '#bdbdbd', fontSize: 11, marginTop: 1 },
});
