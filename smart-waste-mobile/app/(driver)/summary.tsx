import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Card, Chip, Divider } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import type { RouteResponse } from '../../types';

export default function SummaryScreen() {
  const params = useLocalSearchParams<{
    routeJson?: string;
    collectedJson?: string;
    skippedJson?: string;
  }>();

  let route: RouteResponse | null = null;
  let collectedIds: number[] = [];
  let skippedIds: number[] = [];

  try {
    if (params.routeJson) route = JSON.parse(params.routeJson);
    if (params.collectedJson) collectedIds = JSON.parse(params.collectedJson);
    if (params.skippedJson) skippedIds = JSON.parse(params.skippedJson);
  } catch {
    // malformed params — show empty state
  }

  if (!route) {
    return (
      <View style={styles.empty}>
        <Text variant="titleMedium">No summary available.</Text>
        <Button mode="contained" onPress={() => router.replace('/(driver)')} style={{ marginTop: 16 }}>
          Back to Map
        </Button>
      </View>
    );
  }

  const collectedSet = new Set(collectedIds);
  const skippedSet = new Set(skippedIds);
  const pickupStops = route.route_sequence.filter((s) => s.type === 'pickup');
  const collectedStops = pickupStops.filter((s) => collectedSet.has(s.id));
  const skippedStops = pickupStops.filter((s) => skippedSet.has(s.id));
  const distanceKm = route.total_distance_km.toFixed(1);
  const durationMin = Math.round(route.estimated_time_minutes);
  const completionPct = Math.round((collectedStops.length / pickupStops.length) * 100);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.trophy}>🏁</Text>
        <Text variant="headlineMedium" style={styles.title}>Route Complete</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Great work! Here's your collection summary.
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard value={`${collectedStops.length}`} label="Collected" color="#2e7d32" />
        <StatCard value={`${skippedStops.length}`} label="Skipped" color="#e65100" />
        <StatCard value={`${completionPct}%`} label="Completion" color="#1565c0" />
      </View>

      <View style={styles.statsRow}>
        <StatCard value={`${distanceKm} km`} label="Distance" color="#37474f" />
        <StatCard value={`${durationMin} min`} label="Est. Time" color="#37474f" />
      </View>

      {/* Collected bins */}
      {collectedStops.length > 0 && (
        <Card style={styles.listCard}>
          <Card.Content>
            <Text variant="titleSmall" style={[styles.listTitle, { color: '#2e7d32' }]}>
              ✓ Collected ({collectedStops.length})
            </Text>
            {collectedStops.map((s) => (
              <View key={s.id} style={styles.listRow}>
                <Text variant="bodyMedium" style={{ flex: 1 }}>{s.title}</Text>
                <Chip
                  compact
                  style={{ backgroundColor: '#e8f5e9' }}
                  textStyle={{ color: '#2e7d32', fontSize: 11 }}
                >
                  {s.fill_level}% → 0%
                </Chip>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Skipped bins */}
      {skippedStops.length > 0 && (
        <Card style={styles.listCard}>
          <Card.Content>
            <Text variant="titleSmall" style={[styles.listTitle, { color: '#e65100' }]}>
              — Skipped ({skippedStops.length})
            </Text>
            {skippedStops.map((s) => (
              <View key={s.id} style={styles.listRow}>
                <Text variant="bodyMedium" style={[{ flex: 1 }, styles.skippedText]}>{s.title}</Text>
                <Chip
                  compact
                  style={{ backgroundColor: '#fff3e0' }}
                  textStyle={{ color: '#e65100', fontSize: 11 }}
                >
                  {s.fill_level}%
                </Chip>
              </View>
            ))}
            <Text variant="bodySmall" style={styles.skippedNote}>
              Skipped bins still require collection. Notify your supervisor.
            </Text>
          </Card.Content>
        </Card>
      )}

      <Divider style={{ marginVertical: 16 }} />

      <Button
        mode="contained"
        icon="map"
        onPress={() => router.replace('/(driver)')}
        style={styles.doneBtn}
        contentStyle={{ paddingVertical: 6 }}
      >
        Back to Map
      </Button>

      <Button
        mode="outlined"
        icon="clipboard-list"
        onPress={() => router.replace('/(driver)/logs')}
        style={styles.logsBtn}
      >
        View Collection Logs
      </Button>
    </ScrollView>
  );
}

function StatCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <Card style={styles.statCard}>
      <Card.Content style={styles.statContent}>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 48 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  header: { alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  trophy: { fontSize: 52, marginBottom: 8 },
  title: { fontWeight: 'bold', color: '#1b5e20' },
  subtitle: { color: '#546e7a', marginTop: 4, textAlign: 'center' },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statCard: { flex: 1, backgroundColor: '#fff' },
  statContent: { alignItems: 'center', paddingVertical: 12 },
  statValue: { fontSize: 22, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: '#78909c', marginTop: 2 },

  listCard: { backgroundColor: '#fff', marginBottom: 8 },
  listTitle: { fontWeight: '700', marginBottom: 10 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  skippedText: { color: '#bdbdbd' },
  skippedNote: { color: '#e65100', marginTop: 10, fontStyle: 'italic' },

  doneBtn: { backgroundColor: '#2e7d32', marginBottom: 10 },
  logsBtn: { marginBottom: 8 },
});
