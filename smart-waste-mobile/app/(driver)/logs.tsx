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

function LogItem({ log }: { log: CollectionLog }) {
  const isCollection = log.action.toLowerCase().includes('collect');
  const fillDelta = log.fill_before - log.fill_after;

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
            Bin #{log.bin_id}
          </Chip>

          <View style={styles.fillChange}>
            <Chip
              compact
              style={{ backgroundColor: fillColor(log.fill_before) }}
              textStyle={{ color: '#fff', fontSize: 11 }}
            >
              {log.fill_before}%
            </Chip>
            <Text style={styles.arrow}>→</Text>
            <Chip
              compact
              style={{ backgroundColor: fillColor(log.fill_after) }}
              textStyle={{ color: '#fff', fontSize: 11 }}
            >
              {log.fill_after}%
            </Chip>
            {isCollection && fillDelta > 0 && (
              <Text style={styles.delta}>-{fillDelta}%</Text>
            )}
          </View>
        </View>

        {log.notes ? (
          <Text variant="bodySmall" style={styles.notes}>{log.notes}</Text>
        ) : null}
      </Card.Content>
    </Card>
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

  footerSpinner: { marginVertical: 16 },
  loadMoreBtn: { margin: 12, borderColor: '#2e7d32' },
  endText: { textAlign: 'center', color: '#bdbdbd', marginVertical: 16, fontSize: 12 },
});
