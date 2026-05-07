import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Chip, ActivityIndicator, Button, Divider } from 'react-native-paper';
import { getLogs } from '../../services/api';
import type { CollectionLog } from '../../types';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function LogsScreen() {
  const [logs, setLogs] = useState<CollectionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');

  const fetchPage = useCallback(async (skip: number, append: boolean) => {
    try {
      setError('');
      const page = await getLogs(skip, PAGE_SIZE);
      setLogs((prev) => (append ? [...prev, ...page] : page));
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      setError('Could not load logs. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(0, false);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPage(0, false);
  };

  const onLoadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchPage(logs.length, true);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text variant="bodyMedium" style={styles.loadingText}>Loading logs…</Text>
      </View>
    );
  }

  if (error && logs.length === 0) {
    return <ErrorState message={error} onRetry={() => { setLoading(true); fetchPage(0, false); }} />;
  }

  if (logs.length === 0) {
    return (
      <EmptyState
        icon="clipboard-text-off"
        title="No Logs Yet"
        subtitle="Collection events will appear here after bins are collected during a route."
      />
    );
  }

  return (
    <FlatList
      data={logs}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2e7d32']} />
      }
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      renderItem={({ item }) => <LogItem log={item} />}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.3}
      ListFooterComponent={
        hasMore ? (
          loadingMore ? (
            <ActivityIndicator style={styles.footerSpinner} color="#2e7d32" />
          ) : (
            <Button
              mode="outlined"
              onPress={onLoadMore}
              style={styles.loadMoreBtn}
              icon="chevron-down"
            >
              Load More
            </Button>
          )
        ) : logs.length >= PAGE_SIZE ? (
          <Text style={styles.endText}>All logs loaded</Text>
        ) : null
      }
    />
  );
}

function parseTripNotes(notes: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of notes.split('|')) {
    const [k, v] = pair.split('=');
    if (k && v !== undefined) out[k.trim()] = v.trim();
  }
  return out;
}

function formatElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function LogItem({ log }: { log: CollectionLog }) {
  if (log.action === 'route_completed') {
    return <RouteTripItem log={log} />;
  }

  const isCollection = log.action.toLowerCase().includes('collect');
  const fillDelta = (log.fill_before ?? 0) - (log.fill_after ?? 0);
  const hasFillInfo = log.fill_before !== null && log.fill_after !== null;

  return (
    <Card style={styles.card}>
      <Card.Content>
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.actionBadge}>
            <Text style={styles.actionText}>{log.action}</Text>
          </View>
          <Text variant="labelSmall" style={styles.dateText}>{formatDate(log.created_at)}</Text>
        </View>

        <Divider style={styles.divider} />

        {/* Bin + fill change row */}
        <View style={styles.detailRow}>
          <Chip compact icon="trash-can-outline" style={styles.binChip}>
            {log.bin_id !== null ? `Bin #${log.bin_id}` : 'Bin'}
          </Chip>

          {hasFillInfo && (
            <View style={styles.fillChange}>
              <Chip
                compact
                style={{ backgroundColor: fillColor(log.fill_before!) }}
                textStyle={{ color: '#fff', fontSize: 11 }}
              >
                {log.fill_before}%
              </Chip>
              <Text style={styles.arrow}>→</Text>
              <Chip
                compact
                style={{ backgroundColor: fillColor(log.fill_after!) }}
                textStyle={{ color: '#fff', fontSize: 11 }}
              >
                {log.fill_after}%
              </Chip>
              {isCollection && fillDelta > 0 && (
                <Text style={styles.delta}>-{fillDelta}%</Text>
              )}
            </View>
          )}
        </View>

        {log.notes ? (
          <Text variant="bodySmall" style={styles.notes}>{log.notes}</Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

function RouteTripItem({ log }: { log: CollectionLog }) {
  const data = parseTripNotes(log.notes ?? '');
  const stops = data.stops ?? '—';
  const collected = data.collected ?? '—';
  const skipped = data.skipped ?? '—';
  const distance = data.distance_km ? `${data.distance_km} km` : '—';
  const estMin = data.est_min ? `${data.est_min} min` : '—';
  const elapsed = data.elapsed_sec ? formatElapsed(Number(data.elapsed_sec)) : '—';

  return (
    <Card style={[styles.card, styles.tripCard]}>
      <Card.Content>
        <View style={styles.headerRow}>
          <View style={styles.tripBadge}>
            <Text style={styles.tripBadgeText}>🏁 Route Trip</Text>
          </View>
          <Text variant="labelSmall" style={styles.dateText}>{formatDate(log.created_at)}</Text>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.tripStatsRow}>
          <TripStat value={collected} label="Collected" color="#2e7d32" />
          <TripStat value={skipped} label="Skipped" color="#e65100" />
          <TripStat value={stops} label="Stops" color="#37474f" />
        </View>

        <View style={styles.tripMetaRow}>
          <Chip compact icon="road-variant" style={styles.tripMetaChip}>{distance}</Chip>
          <Chip compact icon="timer-outline" style={styles.tripMetaChip}>{elapsed}</Chip>
          <Chip compact icon="clock-outline" style={styles.tripMetaChip}>est. {estMin}</Chip>
        </View>
      </Card.Content>
    </Card>
  );
}

function TripStat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={styles.tripStat}>
      <Text style={[styles.tripStatValue, { color }]}>{value}</Text>
      <Text style={styles.tripStatLabel}>{label}</Text>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#78909c' },
  list: { padding: 12, paddingBottom: 32 },

  card: { backgroundColor: '#fff', borderRadius: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  actionBadge: { backgroundColor: '#e8f5e9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  actionText: { color: '#2e7d32', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  dateText: { color: '#90a4ae' },
  divider: { marginBottom: 10 },

  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  binChip: { backgroundColor: '#f5f5f5' },
  fillChange: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arrow: { color: '#90a4ae', fontWeight: 'bold' },
  delta: { color: '#2e7d32', fontWeight: '700', fontSize: 12 },

  notes: { color: '#90a4ae', marginTop: 8, fontStyle: 'italic' },

  tripCard: { backgroundColor: '#f1f8e9', borderWidth: 1, borderColor: '#c5e1a5' },
  tripBadge: { backgroundColor: '#2e7d32', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tripBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  tripStatsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  tripStat: { alignItems: 'center' },
  tripStatValue: { fontSize: 20, fontWeight: 'bold' },
  tripStatLabel: { fontSize: 11, color: '#78909c', marginTop: 2 },
  tripMetaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  tripMetaChip: { backgroundColor: '#ffffff' },

  footerSpinner: { marginVertical: 16 },
  loadMoreBtn: { margin: 12, borderColor: '#2e7d32' },
  endText: { textAlign: 'center', color: '#bdbdbd', marginVertical: 16, fontSize: 12 },
});
