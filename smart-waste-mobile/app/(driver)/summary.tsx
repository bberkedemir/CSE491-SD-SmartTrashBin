import { useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Card, Chip, Divider } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { useRoute } from '../../context/RouteContext';
import { logRouteCompleted } from '../../services/api';

export default function SummaryScreen() {
  const { activeRoute: route, setActiveRoute } = useRoute();

  const finish = (target: '/(driver)' | '/(driver)/logs') => {
    setActiveRoute(null);
    router.replace(target);
  };
  const params = useLocalSearchParams<{
    collectedJson?: string;
    skippedJson?: string;
    startedAt?: string;
    completedAt?: string;
  }>();

  let collectedIds: number[] = [];
  let skippedIds: number[] = [];

  try {
    if (params.collectedJson) collectedIds = JSON.parse(params.collectedJson);
    if (params.skippedJson) skippedIds = JSON.parse(params.skippedJson);
  } catch {
    // malformed params — show empty state
  }

  if (!route) {
    return (
      <View style={styles.empty}>
        <Text variant="titleMedium">No summary available.</Text>
        <Button mode="contained" onPress={() => finish('/(driver)')} style={{ marginTop: 16 }}>
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
  const estDurationMin = Math.round(route.estimated_time_minutes);
  const completionPct = Math.round((collectedStops.length / pickupStops.length) * 100);

  const startedAt = params.startedAt ? Number(params.startedAt) : null;
  const completedAt = params.completedAt ? Number(params.completedAt) : null;
  const elapsedMs = startedAt && completedAt ? completedAt - startedAt : null;
  const actualDurationLabel = elapsedMs !== null ? formatDuration(elapsedMs) : '—';
  const avgSecPerStop =
    elapsedMs !== null && collectedStops.length + skippedStops.length > 0
      ? Math.round(elapsedMs / 1000 / (collectedStops.length + skippedStops.length))
      : null;
  const avgPerStopLabel = avgSecPerStop !== null ? formatDuration(avgSecPerStop * 1000) : '—';
  const totalWastePct = collectedStops.reduce((sum, s) => sum + s.fill_level, 0);
  const vsEstimate =
    elapsedMs !== null
      ? Math.round(elapsedMs / 1000 / 60) - estDurationMin
      : null;
  const timeFmt = (ms: number) =>
    new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Fire-and-forget: record this trip in the collection logs exactly once per mount
  const postedRef = useRef(false);
  useEffect(() => {
    if (postedRef.current) return;
    if (collectedStops.length + skippedStops.length === 0) return;
    postedRef.current = true;
    logRouteCompleted({
      stops_total: pickupStops.length,
      collected: collectedStops.length,
      skipped: skippedStops.length,
      distance_km: route.total_distance_km,
      estimated_minutes: estDurationMin,
      elapsed_seconds: elapsedMs !== null ? Math.round(elapsedMs / 1000) : 0,
    }).catch(() => {
      // non-fatal — the trip still shows on-screen
    });
  }, []);

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
        <StatCard value={actualDurationLabel} label="Actual Time" color="#6a1b9a" />
        <StatCard value={avgPerStopLabel} label="Avg / Stop" color="#37474f" />
      </View>

      <View style={styles.statsRow}>
        <StatCard value={`${distanceKm} km`} label="Distance" color="#37474f" />
        <StatCard value={`${estDurationMin} min`} label="Est. Time" color="#37474f" />
      </View>

      {/* Timing detail card */}
      {startedAt && completedAt && (
        <Card style={styles.listCard}>
          <Card.Content>
            <Text variant="titleSmall" style={[styles.listTitle, { color: '#37474f' }]}>
              ⏱ Timing
            </Text>
            <DetailRow label="Started" value={timeFmt(startedAt)} />
            <DetailRow label="Completed" value={timeFmt(completedAt)} />
            <DetailRow label="Total time" value={actualDurationLabel} />
            {vsEstimate !== null && (
              <DetailRow
                label="vs. estimate"
                value={
                  vsEstimate === 0
                    ? 'on time'
                    : vsEstimate > 0
                    ? `+${vsEstimate} min over`
                    : `${Math.abs(vsEstimate)} min under`
                }
                valueColor={vsEstimate > 0 ? '#e65100' : vsEstimate < 0 ? '#2e7d32' : '#37474f'}
              />
            )}
            <DetailRow label="Total waste collected" value={`${totalWastePct}% (combined fill)`} />
          </Card.Content>
        </Card>
      )}

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
        onPress={() => finish('/(driver)')}
        style={styles.doneBtn}
        contentStyle={{ paddingVertical: 6 }}
      >
        Back to Map
      </Button>

      <Button
        mode="outlined"
        icon="clipboard-list"
        onPress={() => finish('/(driver)/logs')}
        style={styles.logsBtn}
      >
        View Collection Logs
      </Button>
    </ScrollView>
  );
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function DetailRow({
  label,
  value,
  valueColor = '#37474f',
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text variant="bodyMedium" style={styles.detailLabel}>{label}</Text>
      <Text variant="bodyMedium" style={[styles.detailValue, { color: valueColor }]}>{value}</Text>
    </View>
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
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  detailLabel: { color: '#78909c' },
  detailValue: { fontWeight: '600' },
  skippedText: { color: '#bdbdbd' },
  skippedNote: { color: '#e65100', marginTop: 10, fontStyle: 'italic' },

  doneBtn: { backgroundColor: '#2e7d32', marginBottom: 10 },
  logsBtn: { marginBottom: 8 },
});
