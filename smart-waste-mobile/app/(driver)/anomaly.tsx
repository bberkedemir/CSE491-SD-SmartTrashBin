import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Button, Card, Chip, Divider, IconButton, ProgressBar, Text } from 'react-native-paper';

import { uploadAnomalySession } from '../../services/api';
import type { AnomalyCaptureSession, GpsSample } from '../../types';

const STORAGE_KEY = 'smartWaste.anomalySessions';
const SESSION_DIR = 'anomaly-sessions/';

type CameraRef = React.ElementRef<typeof CameraView>;

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function toGpsSample(location: Location.LocationObject): GpsSample {
  return {
    timestamp: new Date(location.timestamp).toISOString(),
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    altitude: location.coords.altitude,
    heading: location.coords.heading,
    speed: location.coords.speed,
  };
}

function statusLabel(status: AnomalyCaptureSession['status']): string {
  if (status === 'analysis_pending') return 'Analysis in progress';
  if (status === 'uploading') return 'Uploading';
  if (status === 'upload_failed') return 'Upload failed';
  return 'Ready to upload';
}

function statusColor(status: AnomalyCaptureSession['status']): string {
  if (status === 'analysis_pending') return '#1565c0';
  if (status === 'uploading') return '#6a1b9a';
  if (status === 'upload_failed') return '#c62828';
  return '#2e7d32';
}

export default function AnomalyScreen() {
  const cameraRef = useRef<CameraRef | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const gpsPointsRef = useRef<GpsSample[]>([]);
  const sessionsRef = useRef<AnomalyCaptureSession[]>([]);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();

  const [isRecording, setIsRecording] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pointCount, setPointCount] = useState(0);
  const [latestPoint, setLatestPoint] = useState<GpsSample | null>(null);
  const [sessions, setSessions] = useState<AnomalyCaptureSession[]>([]);

  useEffect(() => {
    loadSessions();
    return () => {
      stopLocationWatch();
      try {
        cameraRef.current?.stopRecording();
      } catch {
        // Camera may already be stopped.
      }
    };
  }, []);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    if (!isRecording || startedAtMs === null) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtMs) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording, startedAtMs]);

  const loadSessions = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const saved = raw ? (JSON.parse(raw) as AnomalyCaptureSession[]) : [];
      sessionsRef.current = saved;
      setSessions(saved);
    } catch {
      setSessions([]);
      sessionsRef.current = [];
    }
  };

  const persistSessions = async (next: AnomalyCaptureSession[]) => {
    sessionsRef.current = next;
    setSessions(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const upsertSession = async (session: AnomalyCaptureSession) => {
    const next = [
      session,
      ...sessionsRef.current.filter((item) => item.sessionId !== session.sessionId),
    ].slice(0, 30);
    await persistSessions(next);
  };

  const updateSession = async (
    sessionId: string,
    updates: Partial<AnomalyCaptureSession>
  ) => {
    const next = sessionsRef.current.map((session) =>
      session.sessionId === sessionId ? { ...session, ...updates } : session
    );
    await persistSessions(next);
  };

  const ensurePermissions = async () => {
    const camera = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();
    const microphone = microphonePermission?.granted
      ? microphonePermission
      : await requestMicrophonePermission();
    const location = locationPermission?.granted
      ? locationPermission
      : await requestLocationPermission();

    if (!camera.granted || !microphone.granted || !location.granted) {
      Alert.alert(
        'Permissions needed',
        'Camera, microphone, and location permissions are required to record synchronized road anomaly data.'
      );
      return false;
    }
    return true;
  };

  const getSessionDirectory = async () => {
    const root = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
    if (!root) throw new Error('No writable app directory is available.');
    const dir = `${root}${SESSION_DIR}`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    return dir;
  };

  const startLocationWatch = async () => {
    stopLocationWatch();
    const initial = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });
    const firstPoint = toGpsSample(initial);
    gpsPointsRef.current = [firstPoint];
    setLatestPoint(firstPoint);
    setPointCount(1);

    locationSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (location) => {
        const point = toGpsSample(location);
        gpsPointsRef.current = [...gpsPointsRef.current, point];
        setLatestPoint(point);
        setPointCount(gpsPointsRef.current.length);
      }
    );
  };

  const stopLocationWatch = () => {
    locationSubRef.current?.remove();
    locationSubRef.current = null;
  };

  const startRecording = async () => {
    const permitted = await ensurePermissions();
    if (!permitted) return;

    if (!isCameraReady || !cameraRef.current) {
      Alert.alert('Camera starting', 'Give the camera a moment to finish initializing.');
      return;
    }

    const sessionId = `road-${Date.now()}`;
    const startedAt = new Date().toISOString();
    gpsPointsRef.current = [];
    setPointCount(0);
    setLatestPoint(null);
    setActiveSessionId(sessionId);
    setStartedAtMs(Date.now());
    setElapsedSeconds(0);

    try {
      await startLocationWatch();
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const video = await cameraRef.current.recordAsync();
      if (video?.uri) {
        await finalizeRecording(sessionId, startedAt, video.uri);
      }
    } catch (error) {
      stopLocationWatch();
      setIsRecording(false);
      setActiveSessionId(null);
      Alert.alert(
        'Recording failed',
        error instanceof Error ? error.message : 'Could not record this session.'
      );
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    stopLocationWatch();
    setIsRecording(false);
    cameraRef.current?.stopRecording();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const finalizeRecording = async (sessionId: string, startedAt: string, videoUri: string) => {
    stopLocationWatch();
    const endedAt = new Date().toISOString();
    const points = gpsPointsRef.current;
    const durationSeconds = Math.max(
      1,
      Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
    );
    const dir = await getSessionDirectory();
    const gpsLogUri = `${dir}${sessionId}-gps.json`;
    await FileSystem.writeAsStringAsync(
      gpsLogUri,
      JSON.stringify(
        {
          sessionId,
          startedAt,
          endedAt,
          pointCount: points.length,
          points,
        },
        null,
        2
      )
    );

    const session: AnomalyCaptureSession = {
      sessionId,
      videoUri,
      gpsLogUri,
      startedAt,
      endedAt,
      durationSeconds,
      pointCount: points.length,
      status: 'recorded',
    };

    await upsertSession(session);
    setIsRecording(false);
    setActiveSessionId(null);
    setStartedAtMs(null);
    setElapsedSeconds(durationSeconds);
  };

  const handleUpload = async (session: AnomalyCaptureSession) => {
    await updateSession(session.sessionId, { status: 'uploading', errorMessage: undefined });
    try {
      const response = await uploadAnomalySession(session);
      await updateSession(session.sessionId, {
        status: response.status,
        uploadId: response.id,
        uploadedAt: new Date().toISOString(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      await updateSession(session.sessionId, {
        status: 'upload_failed',
        errorMessage: error instanceof Error ? error.message : 'Upload failed',
      });
      Alert.alert('Upload failed', 'The recording is still saved locally. Try again when connected.');
    }
  };

  const clearSession = (session: AnomalyCaptureSession) => {
    Alert.alert('Remove recording?', 'This removes the local session entry from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const next = sessionsRef.current.filter((item) => item.sessionId !== session.sessionId);
          await persistSessions(next);
        },
      },
    ]);
  };

  const hasCapturePermissions =
    cameraPermission?.granted && microphonePermission?.granted && locationPermission?.granted;

  return (
    <View style={styles.container}>
      <View style={styles.cameraPane}>
        {cameraPermission?.granted ? (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            mode="video"
            onCameraReady={() => setIsCameraReady(true)}
          >
            <View style={styles.cameraOverlay}>
              <View style={styles.recordingBadge}>
                <View style={[styles.recordingDot, isRecording && styles.recordingDotActive]} />
                <Text style={styles.recordingText}>
                  {isRecording ? formatDuration(elapsedSeconds) : 'Ready'}
                </Text>
              </View>
              {activeSessionId && (
                <Chip compact icon="identifier" style={styles.sessionChip}>
                  {activeSessionId}
                </Chip>
              )}
            </View>
          </CameraView>
        ) : (
          <View style={styles.permissionPane}>
            <Text variant="titleMedium" style={styles.permissionTitle}>
              Capture permissions required
            </Text>
            <Text variant="bodyMedium" style={styles.permissionText}>
              Enable camera, microphone, and GPS to record road-condition evidence.
            </Text>
            <Button mode="contained" icon="lock-open-outline" onPress={ensurePermissions}>
              Enable Capture
            </Button>
          </View>
        )}
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        <View style={styles.controlRow}>
          <Button
            mode={isRecording ? 'outlined' : 'contained'}
            icon={isRecording ? 'stop-circle-outline' : 'record-circle-outline'}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isRecording ? false : !hasCapturePermissions || !isCameraReady}
            buttonColor={isRecording ? undefined : '#2e7d32'}
            textColor={isRecording ? '#c62828' : '#fff'}
            style={styles.primaryButton}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </Button>
          <IconButton icon="refresh" mode="outlined" onPress={loadSessions} disabled={isRecording} />
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{pointCount}</Text>
            <Text style={styles.metricLabel}>GPS points</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{formatDuration(elapsedSeconds)}</Text>
            <Text style={styles.metricLabel}>Duration</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              {latestPoint ? `${latestPoint.accuracy?.toFixed(0) ?? '-'} m` : '-'}
            </Text>
            <Text style={styles.metricLabel}>Accuracy</Text>
          </View>
        </View>

        {isRecording && (
          <View style={styles.progressBlock}>
            <ProgressBar indeterminate color="#c62828" style={styles.progress} />
            <Text variant="bodySmall" style={styles.progressText}>
              Video and GPS are being captured together.
            </Text>
          </View>
        )}

        <Divider style={styles.divider} />

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Local Recordings
        </Text>

        {sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text variant="bodyMedium" style={styles.emptyTitle}>
              No road recordings yet
            </Text>
            <Text variant="bodySmall" style={styles.emptyText}>
              Completed sessions will appear here for upload.
            </Text>
          </View>
        ) : (
          sessions.map((session) => (
            <Card key={session.sessionId} style={styles.sessionCard}>
              <Card.Content>
                <View style={styles.sessionHeader}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleSmall" style={styles.sessionTitle}>
                      {formatDate(session.startedAt)}
                    </Text>
                    <Text variant="bodySmall" style={styles.sessionMeta}>
                      {formatDuration(session.durationSeconds)} · {session.pointCount} GPS points
                    </Text>
                  </View>
                  <Chip
                    compact
                    icon={session.status === 'upload_failed' ? 'alert-circle' : 'cloud-upload-outline'}
                    style={{ backgroundColor: statusColor(session.status) }}
                    textStyle={styles.statusText}
                  >
                    {statusLabel(session.status)}
                  </Chip>
                </View>

                {session.errorMessage && (
                  <Text variant="bodySmall" style={styles.errorText}>
                    {session.errorMessage}
                  </Text>
                )}
              </Card.Content>
              <Card.Actions style={styles.sessionActions}>
                <Button
                  mode="text"
                  icon="delete-outline"
                  textColor="#c62828"
                  onPress={() => clearSession(session)}
                  disabled={session.status === 'uploading'}
                >
                  Remove
                </Button>
                <Button
                  mode="contained-tonal"
                  icon="cloud-upload-outline"
                  onPress={() => handleUpload(session)}
                  loading={session.status === 'uploading'}
                  disabled={session.status === 'uploading' || session.status === 'analysis_pending'}
                >
                  Upload
                </Button>
              </Card.Actions>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f5' },
  cameraPane: { height: 320, backgroundColor: '#263238' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'space-between', padding: 16 },
  recordingBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#00000099',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#90a4ae' },
  recordingDotActive: { backgroundColor: '#ef5350' },
  recordingText: { color: '#fff', fontWeight: '700' },
  sessionChip: { alignSelf: 'flex-start', backgroundColor: '#ffffffdd' },
  permissionPane: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    gap: 12,
  },
  permissionTitle: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  permissionText: { color: '#cfd8dc', textAlign: 'center' },
  panel: { flex: 1 },
  panelContent: { padding: 16, paddingBottom: 40 },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primaryButton: { flex: 1 },
  metricRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  metric: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#dfe7e2',
  },
  metricValue: { color: '#263238', fontSize: 18, fontWeight: '800' },
  metricLabel: { color: '#607d8b', fontSize: 11, marginTop: 2 },
  progressBlock: { marginTop: 14 },
  progress: { height: 6, borderRadius: 3 },
  progressText: { color: '#607d8b', marginTop: 6 },
  divider: { marginVertical: 18 },
  sectionTitle: { color: '#263238', fontWeight: '700', marginBottom: 10 },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dfe7e2',
    padding: 18,
  },
  emptyTitle: { color: '#37474f', fontWeight: '700' },
  emptyText: { color: '#78909c', marginTop: 4 },
  sessionCard: { backgroundColor: '#fff', marginBottom: 10 },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sessionTitle: { color: '#263238', fontWeight: '700' },
  sessionMeta: { color: '#607d8b', marginTop: 2 },
  statusText: { color: '#fff', fontSize: 11 },
  errorText: { color: '#c62828', marginTop: 8 },
  sessionActions: { justifyContent: 'flex-end', gap: 6, paddingHorizontal: 12, paddingBottom: 10 },
});
