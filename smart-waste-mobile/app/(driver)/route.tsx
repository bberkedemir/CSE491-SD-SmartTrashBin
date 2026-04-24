import { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Linking, ScrollView } from 'react-native';
import { Text, Button, Card, Chip, ProgressBar, Divider } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { collectBin } from '../../services/api';
import type { RouteResponse, RouteStop } from '../../types';

export default function RouteScreen() {
  const params = useLocalSearchParams<{ routeJson?: string }>();
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [collecting, setCollecting] = useState(false);
  const [collected, setCollected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (params.routeJson) {
      try {
        setRoute(JSON.parse(params.routeJson));
        setCurrentIndex(0);
        setCollected(new Set());
      } catch {
        // invalid json
      }
    }
  }, [params.routeJson]);

  if (!route) {
    return (
      <View style={styles.empty}>
        <Text variant="titleMedium" style={styles.emptyTitle}>No Active Route</Text>
        <Text variant="bodyMedium" style={styles.emptySubtitle}>
          Go to the Map tab and tap "Get Optimized Route" to start.
        </Text>
        <Button mode="contained" onPress={() => router.push('/(driver)')} style={{ marginTop: 24 }}>
          Go to Map
        </Button>
      </View>
    );
  }

  const stop = route.stops[currentIndex];
  const progress = collected.size / route.stops.length;
  const distanceKm = (route.total_distance_m / 1000).toFixed(1);
  const durationMin = Math.round(route.total_duration_s / 60);

  const openNavigation = (s: RouteStop) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=driving`;
    Linking.openURL(url);
  };

  const handleCollect = async () => {
    if (!stop) return;
    setCollecting(true);
    try {
      await collectBin(stop.bin_id);
      const next = new Set(collected);
      next.add(stop.bin_id);
      setCollected(next);
      if (currentIndex + 1 < route.stops.length) {
        setCurrentIndex(currentIndex + 1);
      } else {
        Alert.alert('Route Complete!', 'All bins have been collected.', [
          { text: 'Done', onPress: () => router.push('/(driver)') },
        ]);
      }
    } catch {
      Alert.alert('Error', 'Failed to mark bin as collected. Try again.');
    } finally {
      setCollecting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Route summary */}
      <Card style={styles.summaryCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.summaryTitle}>Route Summary</Text>
          <View style={styles.summaryRow}>
            <Chip icon="map-marker-multiple">{route.stops.length} stops</Chip>
            <Chip icon="road-variant">{distanceKm} km</Chip>
            <Chip icon="clock-outline">{durationMin} min</Chip>
          </View>
          <ProgressBar progress={progress} color="#2e7d32" style={styles.progress} />
          <Text variant="bodySmall" style={styles.progressLabel}>
            {collected.size} of {route.stops.length} collected
          </Text>
        </Card.Content>
      </Card>

      {/* Current stop */}
      {stop && (
        <Card style={styles.currentCard}>
          <Card.Content>
            <Text variant="labelSmall" style={styles.currentLabel}>CURRENT STOP</Text>
            <Text variant="headlineSmall" style={styles.stopTitle}>{stop.title}</Text>
            <View style={styles.stopRow}>
              <Chip
                compact
                style={{ backgroundColor: fillColor(stop.fill) }}
                textStyle={{ color: '#fff' }}
              >
                {stop.fill}% full
              </Chip>
              <Chip compact icon="map-marker">{stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}</Chip>
            </View>
          </Card.Content>
          <Card.Actions style={styles.cardActions}>
            <Button
              mode="outlined"
              icon="google-maps"
              onPress={() => openNavigation(stop)}
            >
              Navigate
            </Button>
            <Button
              mode="contained"
              icon="check-circle"
              onPress={handleCollect}
              loading={collecting}
              disabled={collecting}
            >
              Mark Collected
            </Button>
          </Card.Actions>
        </Card>
      )}

      <Divider style={{ marginVertical: 16 }} />

      {/* All stops list */}
      <Text variant="titleSmall" style={styles.allStopsTitle}>All Stops</Text>
      {route.stops.map((s, i) => (
        <View key={s.bin_id} style={styles.stopItem}>
          <View style={styles.stopIndex}>
            <Text
              style={[
                styles.stopIndexText,
                collected.has(s.bin_id) && styles.stopIndexDone,
                i === currentIndex && styles.stopIndexCurrent,
              ]}
            >
              {collected.has(s.bin_id) ? '✓' : i + 1}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              variant="bodyMedium"
              style={collected.has(s.bin_id) ? styles.strikethrough : undefined}
            >
              {s.title}
            </Text>
          </View>
          <Chip
            compact
            style={{ backgroundColor: fillColor(s.fill) }}
            textStyle={{ color: '#fff', fontSize: 11 }}
          >
            {s.fill}%
          </Chip>
        </View>
      ))}
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
  content: { padding: 16, paddingBottom: 40 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { color: '#37474f', fontWeight: 'bold', marginBottom: 8 },
  emptySubtitle: { color: '#90a4ae', textAlign: 'center' },
  summaryCard: { backgroundColor: '#fff', marginBottom: 12 },
  summaryTitle: { fontWeight: '600', color: '#37474f', marginBottom: 10 },
  summaryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  progress: { height: 8, borderRadius: 4 },
  progressLabel: { color: '#78909c', marginTop: 6, textAlign: 'right' },
  currentCard: { backgroundColor: '#e8f5e9', marginBottom: 12, borderWidth: 1, borderColor: '#a5d6a7' },
  currentLabel: { color: '#558b2f', fontWeight: 'bold', marginBottom: 4, letterSpacing: 1 },
  stopTitle: { color: '#1b5e20', fontWeight: 'bold', marginBottom: 8 },
  stopRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  cardActions: { justifyContent: 'flex-end', gap: 8, paddingBottom: 8 },
  allStopsTitle: { color: '#546e7a', marginBottom: 8, fontWeight: '600' },
  stopItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eeeeee' },
  stopIndex: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#cfd8dc', justifyContent: 'center', alignItems: 'center' },
  stopIndexText: { fontWeight: 'bold', fontSize: 13, color: '#37474f' },
  stopIndexDone: { color: '#2e7d32' },
  stopIndexCurrent: { color: '#e65100' },
  strikethrough: { textDecorationLine: 'line-through', color: '#bdbdbd' },
});
