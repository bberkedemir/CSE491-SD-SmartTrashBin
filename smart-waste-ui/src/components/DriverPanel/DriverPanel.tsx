import React from 'react';
import { Box, Typography, LinearProgress, Chip, Paper } from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import type { DriverSession } from '../../types/bin';

interface DriverPanelProps {
    sessions: DriverSession[];
    isConnected: boolean;
    getColor: (driverId: number) => string;
    onDriverClick: (session: DriverSession) => void;
}

export const DriverPanel: React.FC<DriverPanelProps> = ({
    sessions,
    isConnected,
    getColor,
    onDriverClick,
}) => {
    if (sessions.length === 0) return null;

    return (
        <Box
            sx={{
                position: 'absolute',
                top: 80,
                right: 20,
                zIndex: 1000,
                width: 270,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                pointerEvents: 'all',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                    Active Drivers
                </Typography>
                <Chip
                    size="small"
                    label={isConnected ? 'Live' : 'Polling'}
                    sx={{
                        height: 18,
                        fontSize: 10,
                        bgcolor: isConnected ? '#e8f5e9' : '#fff3e0',
                        color: isConnected ? '#2e7d32' : '#e65100',
                        fontWeight: 700,
                    }}
                />
            </Box>

            {sessions.map(session => {
                const pickupStops = session.route_stops.filter(s => s.type === 'pickup');
                const totalStops = pickupStops.length;
                const done = session.collected_ids.length + session.skipped_ids.length;
                const progress = totalStops > 0 ? (done / totalStops) * 100 : 0;
                const color = getColor(session.driver_id);
                const currentStop = pickupStops[session.current_stop_index] ?? null;
                const elapsedMs = Date.now() - new Date(session.started_at).getTime();
                const elapsedMin = Math.floor(elapsedMs / 60000);

                return (
                    <Paper
                        key={session.driver_id}
                        elevation={4}
                        onClick={() => onDriverClick(session)}
                        sx={{
                            p: 1.5,
                            cursor: 'pointer',
                            borderLeft: `4px solid ${color}`,
                            borderRadius: 2,
                            bgcolor: 'background.paper',
                            '&:hover': { bgcolor: 'action.hover' },
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                            <LocalShippingIcon sx={{ color, fontSize: 18 }} />
                            <Typography variant="body2" fontWeight={700} noWrap sx={{ flex: 1 }}>
                                {session.driver_full_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {elapsedMin}m
                            </Typography>
                        </Box>

                        <LinearProgress
                            variant="determinate"
                            value={progress}
                            sx={{
                                height: 5,
                                borderRadius: 3,
                                mb: 0.75,
                                bgcolor: '#e0e0e0',
                                '& .MuiLinearProgress-bar': { bgcolor: color },
                            }}
                        />

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Chip
                                    icon={<CheckCircleIcon sx={{ fontSize: '12px !important' }} />}
                                    label={session.collected_ids.length}
                                    size="small"
                                    sx={{ height: 18, fontSize: 10, bgcolor: '#e8f5e9', color: '#2e7d32' }}
                                />
                                <Chip
                                    icon={<CancelIcon sx={{ fontSize: '12px !important' }} />}
                                    label={session.skipped_ids.length}
                                    size="small"
                                    sx={{ height: 18, fontSize: 10, bgcolor: '#fff3e0', color: '#e65100' }}
                                />
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                                {done}/{totalStops} stops
                            </Typography>
                        </Box>

                        {currentStop && (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                                sx={{ display: 'block', mt: 0.5 }}
                            >
                                Next: {currentStop.title}
                            </Typography>
                        )}
                    </Paper>
                );
            })}
        </Box>
    );
};
