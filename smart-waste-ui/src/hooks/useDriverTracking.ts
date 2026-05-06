import { useState, useEffect, useRef, useCallback } from 'react';
import type { DriverSession, WSTrackingMessage } from '../types/bin';

const WS_PATH = '/api/v1/tracking/ws';
const POLL_URL = '/api/v1/tracking/sessions';
const RECONNECT_DELAY_MS = 3000;
const FALLBACK_POLL_MS = 8000;

function getToken(): string {
    return localStorage.getItem('token') ?? '';
}

function buildWsUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${WS_PATH}?token=${getToken()}`;
}

export function useDriverTracking() {
    const [sessions, setSessions] = useState<DriverSession[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(false);

    const applyMessage = useCallback((msg: WSTrackingMessage) => {
        if (msg.event === 'full_snapshot' && msg.sessions) {
            setSessions(msg.sessions);
            return;
        }
        if (!msg.session) return;
        const incoming = msg.session;

        if (msg.event === 'session_started' || msg.event === 'position_updated') {
            setSessions(prev => {
                const idx = prev.findIndex(s => s.driver_id === incoming.driver_id);
                if (idx === -1) return [...prev, incoming];
                const next = [...prev];
                next[idx] = incoming;
                return next;
            });
        } else if (msg.event === 'session_completed') {
            setSessions(prev => prev.filter(s => s.driver_id !== incoming.driver_id));
        }
    }, []);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []);

    const startPolling = useCallback(() => {
        if (pollIntervalRef.current) return;
        const poll = async () => {
            try {
                const res = await fetch(POLL_URL, {
                    headers: { Authorization: `Bearer ${getToken()}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    setSessions(data.sessions ?? []);
                }
            } catch {
                // ignore — WS reconnect will take over
            }
        };
        poll();
        pollIntervalRef.current = setInterval(poll, FALLBACK_POLL_MS);
    }, []);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(buildWsUrl());
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            stopPolling();
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
        };

        ws.onmessage = (event) => {
            try {
                const msg: WSTrackingMessage = JSON.parse(event.data);
                applyMessage(msg);
            } catch {
                console.warn('[useDriverTracking] Failed to parse WS message');
            }
        };

        ws.onclose = () => {
            setIsConnected(false);
            if (!mountedRef.current) return;  // don't reconnect after unmount
            startPolling();
            reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
        };

        ws.onerror = () => {
            ws.close();
        };
    }, [applyMessage, startPolling, stopPolling]);

    useEffect(() => {
        mountedRef.current = true;
        connect();
        return () => {
            mountedRef.current = false;
            wsRef.current?.close();
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            stopPolling();
        };
    }, [connect, stopPolling]);

    return { sessions, isConnected };
}
