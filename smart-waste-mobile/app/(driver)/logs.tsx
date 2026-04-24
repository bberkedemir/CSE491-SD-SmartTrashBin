import { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Chip, ActivityIndicator } from 'react-native-paper';
import { getLogs } from '../../services/api';
import type { CollectionLog } from '../../types';

export default function LogsScreen() {
  const [logs, setLogs] = useState<CollectionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const data = await getLogs();
      setLogs(data);
    } catch {
      // silently fail; user can refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  if (logs.length === 0) {
    return (
      <View style={styles.center}>
        <Text variant="titleMedium" style={styles.emptyTitle}>No Logs Yet</Text>
        <Text variant="bodyMedium" style={styles.emptySubtitle}>
          Collection events will appear here after bins are collected.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={logs}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2e7d32']} />}
      renderItem={({ item }) => <LogItem log={item} />}
    />
  );
}

function LogItem({ log }: { log: CollectionLog }) {
  const date = new Date(log.created_at).toLocaleString();

  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <Text variant="bodyMedium" style={styles.binId}>Bin #{log.bin_id}</Text>
          <Chip compact icon="clock-outline" style={styles.dateChip}>
            <Text variant="labelSmall">{date}</Text>
          </Chip>
        </View>
        <Text variant="bodySmall" style={styles.action}>{log.action}</Text>
        <View style={styles.fillRow}>
          <Chip compact style={{ backgroundColor: fillColor(log.fill_before) }} textStyle={{ color: '#fff', fontSize: 11 }}>
            {log.fill_before}%
          </Chip>
          <Text style={styles.arrow}>→</Text>
          <Chip compact style={{ backgroundColor: fillColor(log.fill_after) }} textStyle={{ color: '#fff', fontSize: 11 }}>
            {log.fill_after}%
          </Chip>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { color: '#37474f', fontWeight: 'bold', marginBottom: 8 },
  emptySubtitle: { color: '#90a4ae', textAlign: 'center' },
  list: { padding: 12, paddingBottom: 32 },
  card: { marginBottom: 10, backgroundColor: '#fff' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  binId: { fontWeight: '600', color: '#37474f' },
  dateChip: { backgroundColor: '#f5f5f5' },
  action: { color: '#546e7a', marginBottom: 8, textTransform: 'capitalize' },
  fillRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { color: '#78909c', fontWeight: 'bold' },
  notes: { color: '#90a4ae', marginTop: 6, fontStyle: 'italic' },
});
