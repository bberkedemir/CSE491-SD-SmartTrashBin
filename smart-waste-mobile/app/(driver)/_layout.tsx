import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { RouteProvider } from '../../context/RouteContext';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from 'react-native-paper';

export default function DriverLayout() {
  const { user, isLoading } = useAuth();
  const theme = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <RouteProvider>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: '#90a4ae',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#e0e0e0' },
        headerStyle: { backgroundColor: '#2e7d32' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="map-marker-radius" color={color} size={size} />
          ),
          headerTitle: 'Smart Waste — Map',
        }}
      />
      <Tabs.Screen
        name="route"
        options={{
          title: 'Route',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="truck-fast" color={color} size={size} />
          ),
          headerTitle: 'Active Route',
        }}
      />
      <Tabs.Screen
        name="anomaly"
        options={{
          title: 'Road',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="road-variant" color={color} size={size} />
          ),
          headerTitle: 'Road Anomaly Capture',
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: 'Logs',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="clipboard-list" color={color} size={size} />
          ),
          headerTitle: 'Collection Logs',
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          href: null, // hidden from tab bar — navigated to programmatically
          headerTitle: 'Route Summary',
        }}
      />
    </Tabs>
    </RouteProvider>
  );
}

// Inline icon component using react-native-paper's MaterialCommunityIcons
function TabIcon({ name, color, size }: { name: string; color: string; size: number }) {
  const { Icon } = require('react-native-paper');
  return <Icon source={name} color={color} size={size} />;
}
