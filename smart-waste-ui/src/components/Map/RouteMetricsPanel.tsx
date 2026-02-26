import React, { useState } from 'react';
import { Box, Typography, IconButton, Divider } from '@mui/material';
import type { RouteMetrics } from '../../types/bin';

interface RouteMetricsPanelProps {
    metrics: RouteMetrics;
    onClose: () => void;
}

function getFillColor(fill: number): string {
    if (fill >= 80) return '#e74c3c';
    if (fill >= 50) return '#f39c12';
    return '#27ae60';
}

const RouteMetricsPanel: React.FC<RouteMetricsPanelProps> = ({ metrics, onClose }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <Box
            sx={{
                position: 'fixed',
                top: 20,
                right: 20,
                width: 300,
                maxHeight: '80vh',
                bgcolor: 'background.paper',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                animation: 'slideUp 0.3s ease-out',
                overflow: 'hidden',
                zIndex: 1000,
            }}
        >
            {/* Header */}
            <Box
                sx={{
                    bgcolor: '#9b59b6',
                    color: 'white',
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                    Route Metrics
                </Typography>
                <IconButton size="small" onClick={onClose} sx={{ color: 'white', p: 0.5 }}>
                    ✕
                </IconButton>
            </Box>

            {/* Stats Overview */}
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
                <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                        DISTANCE
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#2c3e50', fontWeight: 700 }}>
                        {metrics.totalDistanceKm} <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>km</span>
                    </Typography>
                </Box>
                <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                        TIME
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#2c3e50', fontWeight: 700 }}>
                        Math.round({metrics.estimatedTimeMinutes}) <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>min</span>
                    </Typography>
                </Box>
                <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                        STOPS
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#2c3e50', fontWeight: 700 }}>
                        {metrics.totalStops}
                    </Typography>
                </Box>
            </Box>

            <Divider />

            {/* Footer / Expansion Toggle */}
            <Box
                sx={{
                    p: 1.5,
                    bgcolor: '#f8f9fa',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: '#f1f3f5' },
                }}
                onClick={() => setExpanded(!expanded)}
            >
                <Typography variant="caption" color="text.secondary">
                    Generated: {new Date(metrics.generatedAt).toLocaleDateString()}
                </Typography>
                <Typography variant="caption" sx={{ color: '#9b59b6', fontWeight: 600, userSelect: 'none' }}>
                    {expanded ? '▲ Hide Stops' : '▼ Show Stops'}
                </Typography>
            </Box>

            {/* Expandable Stops List */}
            {expanded && (
                <Box
                    sx={{
                        maxHeight: 250,
                        overflowY: 'auto',
                        p: 1,
                        bgcolor: '#fafafa',
                        borderTop: '1px solid #eee',
                    }}
                >
                    {metrics.stops.map((stop, i) => (
                        <Box
                            key={stop.id}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                p: 1,
                                mb: 0.5,
                                bgcolor: 'white',
                                borderRadius: '6px',
                                border: '1px solid #eee',
                            }}
                        >
                            <Box
                                sx={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    bgcolor: '#f1f3f5',
                                    color: '#666',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    mr: 1.5,
                                }}
                            >
                                {i + 1}
                            </Box>

                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#333', mb: 0.2 }} noWrap>
                                    {stop.title}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#888', display: 'block' }}>
                                    {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                                </Typography>
                            </Box>

                            <Box
                                sx={{
                                    px: 1,
                                    py: 0.5,
                                    borderRadius: '4px',
                                    bgcolor: `${getFillColor(stop.fill_level)}15`,
                                    color: getFillColor(stop.fill_level),
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                }}
                            >
                                {stop.fill_level}%
                            </Box>
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default RouteMetricsPanel;
