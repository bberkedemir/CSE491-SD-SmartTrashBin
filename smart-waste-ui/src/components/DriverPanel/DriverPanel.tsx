import React, { useState } from 'react';
import { Box, Typography, LinearProgress, Chip, Paper, Collapse, Divider, IconButton, Tooltip } from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import type { DriverSession, DriverRouteStop } from '../../types/bin';
import type { Truck } from '../../types/truck';

interface DriverPanelProps {
    sessions: DriverSession[];
    isConnected: boolean;
    isAdmin?: boolean;
    getColor: (driverId: number) => string;
    onDriverClick: (session: DriverSession) => void;
    onCancelSession?: (driverId: number) => void;
    driverTrucks?: Record<number, Truck>;
}

function getFillColor(fill: number): string {
    if (fill >= 80) return '#c62828';
    if (fill >= 50) return '#e65100';
    return '#2e7d32';
}

function StopRow({ stop, status }: { stop: DriverRouteStop; status: 'collected' | 'skipped' | 'pending' | 'current' }) {
    const colors = {
        collected: { bg: '#e8f5e9', text: '#2e7d32', icon: <CheckCircleIcon sx={{ fontSize: 14, color: '#2e7d32' }} /> },
        skipped:   { bg: '#fafafa', text: '#9e9e9e', icon: <CancelIcon sx={{ fontSize: 14, color: '#bdbdbd' }} /> },
        current:   { bg: '#fff8e1', text: '#e65100', icon: <RadioButtonUncheckedIcon sx={{ fontSize: 14, color: '#e65100' }} /> },
        pending:   { bg: 'transparent', text: '#546e7a', icon: <RadioButtonUncheckedIcon sx={{ fontSize: 14, color: '#cfd8dc' }} /> },
    }[status];

    return (
        <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 1, py: 0.4, borderRadius: 1,
            bgcolor: colors.bg,
        }}>
            {colors.icon}
            <Typography
                variant="caption"
                noWrap
                sx={{
                    flex: 1,
                    color: colors.text,
                    textDecoration: status === 'skipped' ? 'line-through' : 'none',
                    fontSize: 11,
                }}
            >
                {stop.title}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: 10, color: getFillColor(stop.fill_level), fontWeight: 700 }}>
                {stop.fill_level}%
            </Typography>
        </Box>
    );
}

export const DriverPanel: React.FC<DriverPanelProps> = ({
    sessions,
    isConnected,
    isAdmin,
    getColor,
    onDriverClick,
    onCancelSession,
    driverTrucks,
}) => {
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    if (sessions.length === 0) return null;

    const toggleExpand = (driverId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedIds(prev => {
            const next = new Set(prev);
            next.has(driverId) ? next.delete(driverId) : next.add(driverId);
            return next;
        });
    };

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
                const truck = driverTrucks?.[session.driver_id];
                const elapsedMs = Date.now() - new Date(session.started_at).getTime();
                const elapsedMin = Math.floor(elapsedMs / 60000);
                const isExpanded = expandedIds.has(session.driver_id);

                return (
                    <Paper
                        key={session.driver_id}
                        elevation={4}
                        sx={{
                            borderLeft: `4px solid ${color}`,
                            borderRadius: 2,
                            bgcolor: 'background.paper',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Header row — click to pan map */}
                        <Box
                            onClick={() => onDriverClick(session)}
                            sx={{ p: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                                <LocalShippingIcon sx={{ color, fontSize: 18 }} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" fontWeight={700} noWrap>
                                        {session.driver_full_name}
                                    </Typography>
                                    {truck && (
                                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', lineHeight: 1.2 }}>
                                            {truck.license_plate} · {truck.model}
                                        </Typography>
                                    )}
                                </Box>
                                <Typography variant="caption" color="text.secondary">
                                    {elapsedMin}m
                                </Typography>
                                <IconButton
                                    size="small"
                                    onClick={(e) => toggleExpand(session.driver_id, e)}
                                    sx={{ p: 0.25, ml: 0.5 }}
                                >
                                    {isExpanded
                                        ? <ExpandLessIcon sx={{ fontSize: 16 }} />
                                        : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                                </IconButton>
                                {isAdmin && onCancelSession && (
                                    <Tooltip title="Cancel driver session">
                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCancelSession(session.driver_id);
                                            }}
                                            sx={{ p: 0.25, ml: 0.25, color: '#c62828', '&:hover': { bgcolor: '#ffebee' } }}
                                        >
                                            <DeleteForeverIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </Tooltip>
                                )}
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

                            {currentStop && !isExpanded && (
                                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.5 }}>
                                    Next: {currentStop.title}
                                </Typography>
                            )}
                        </Box>

                        {/* Expandable stops list */}
                        <Collapse in={isExpanded}>
                            <Divider />
                            <Box sx={{ px: 1, py: 0.75, maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                {pickupStops.map((stop, i) => {
                                    let status: 'collected' | 'skipped' | 'current' | 'pending';
                                    if (session.collected_ids.includes(stop.id)) status = 'collected';
                                    else if (session.skipped_ids.includes(stop.id)) status = 'skipped';
                                    else if (i === session.current_stop_index) status = 'current';
                                    else status = 'pending';
                                    return <StopRow key={stop.id} stop={stop} status={status} />;
                                })}
                            </Box>
                        </Collapse>
                    </Paper>
                );
            })}
        </Box>
    );
};
