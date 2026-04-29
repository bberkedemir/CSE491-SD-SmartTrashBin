import { View, StyleSheet } from 'react-native';
import { Text, Button, Icon } from 'react-native-paper';

interface Props {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message = 'Something went wrong.', onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Icon source="alert-circle-outline" size={64} color="#ef9a9a" />
      <Text variant="titleMedium" style={styles.title}>Connection Error</Text>
      <Text variant="bodyMedium" style={styles.message}>{message}</Text>
      {onRetry ? (
        <Button mode="contained" onPress={onRetry} style={styles.btn} icon="refresh">
          Try Again
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  title: { color: '#c62828', fontWeight: '600' },
  message: { color: '#78909c', textAlign: 'center', lineHeight: 20 },
  btn: { marginTop: 8, backgroundColor: '#2e7d32' },
});
