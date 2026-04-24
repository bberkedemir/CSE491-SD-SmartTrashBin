import { View, StyleSheet } from 'react-native';
import { Text, Button, Icon } from 'react-native-paper';

interface Props {
  icon: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, subtitle, actionLabel, onAction }: Props) {
  return (
    <View style={styles.container}>
      <Icon source={icon} size={64} color="#b0bec5" />
      <Text variant="titleMedium" style={styles.title}>{title}</Text>
      {subtitle ? <Text variant="bodyMedium" style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Button mode="contained" onPress={onAction} style={styles.btn}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  title: { color: '#546e7a', fontWeight: '600', textAlign: 'center' },
  subtitle: { color: '#90a4ae', textAlign: 'center', lineHeight: 20 },
  btn: { marginTop: 8, backgroundColor: '#2e7d32' },
});
