import { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Chip, Pagination,
  Fade, ToggleButton, ToggleButtonGroup, Tooltip, Collapse, IconButton,
} from '@mui/material';
import {
  History as HistoryIcon,
  AddCircleOutline,
  DeleteOutline,
  DeleteForever,
  LocalShipping,
  Sensors,
  CheckCircle,
  Cancel,
  Route as RouteIcon,
  StraightenOutlined,
  TimerOutlined,
  PersonOutline,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { useLogs } from '../../hooks/useLogs';

// ── Action metadata ───────────────────────────────────────────────────────────

type ActionKey = 'bin_added' | 'collected' | 'bin_deleted' | 'bulk_delete' | 'route_completed' | 'iot_update';

const ACTION_META: Record<ActionKey, {
  label: string;
  bg: string;
  color: string;
  icon: React.ReactNode;
}> = {
  bin_added:       { label: 'Bin Added',       bg: '#e8f5e9', color: '#2e7d32', icon: <AddCircleOutline sx={{ fontSize: 14 }} /> },
  collected:       { label: 'Collected',        bg: '#e3f2fd', color: '#1565c0', icon: <LocalShipping sx={{ fontSize: 14 }} /> },
  bin_deleted:     { label: 'Bin Deleted',      bg: '#fce4ec', color: '#c62828', icon: <DeleteOutline sx={{ fontSize: 14 }} /> },
  bulk_delete:     { label: 'Bulk Delete',      bg: '#fce4ec', color: '#b71c1c', icon: <DeleteForever sx={{ fontSize: 14 }} /> },
  route_completed: { label: 'Route Completed',  bg: '#f3e5f5', color: '#6a1b9a', icon: <RouteIcon sx={{ fontSize: 14 }} /> },
  iot_update:      { label: 'IoT Update',       bg: '#e0f7fa', color: '#00695c', icon: <Sensors sx={{ fontSize: 14 }} /> },
};

function getActionMeta(action: string) {
  return ACTION_META[action as ActionKey] ?? {
    label: action,
    bg: '#f5f5f5',
    color: '#616161',
    icon: <HistoryIcon sx={{ fontSize: 14 }} />,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface BinEntry { id: number; title: string; fill_level: number; }
interface RouteBins { collected: BinEntry[]; skipped: BinEntry[]; }

function parseRouteNotes(notes: string): { stats: Record<string, string>; bins: RouteBins | null } {
  const [statsPart, jsonPart] = notes.split('||');
  const stats: Record<string, string> = {};
  statsPart.split('|').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k && v !== undefined) stats[k.trim()] = v.trim();
  });
  let bins: RouteBins | null = null;
  if (jsonPart) {
    try { bins = JSON.parse(jsonPart); } catch { /* old format */ }
  }
  return { stats, bins };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const meta = getActionMeta(action);
  return (
    <Chip
      icon={meta.icon as any}
      label={meta.label}
      size="small"
      sx={{
        bgcolor: meta.bg,
        color: meta.color,
        fontWeight: 600,
        fontSize: 11,
        border: 'none',
        '& .MuiChip-icon': { color: meta.color },
      }}
    />
  );
}

function RouteSummaryCell({ notes, expanded, onToggle }: {
  notes: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { stats, bins } = parseRouteNotes(notes);
  const elapsedMin = Math.round(parseInt(stats.elapsed_sec ?? '0') / 60);
  const hasBins = bins && (bins.collected.length > 0 || bins.skipped.length > 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Chip
          icon={<CheckCircle sx={{ fontSize: '13px !important' }} />}
          label={`${stats.collected ?? 0} collected`}
          size="small"
          sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 600, fontSize: 11, '& .MuiChip-icon': { color: '#2e7d32' } }}
        />
        <Chip
          icon={<Cancel sx={{ fontSize: '13px !important' }} />}
          label={`${stats.skipped ?? 0} skipped`}
          size="small"
          sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 600, fontSize: 11, '& .MuiChip-icon': { color: '#e65100' } }}
        />
        <Chip
          icon={<StraightenOutlined sx={{ fontSize: '13px !important' }} />}
          label={`${parseFloat(stats.distance_km ?? '0').toFixed(1)} km`}
          size="small"
          sx={{ bgcolor: '#f3e5f5', color: '#6a1b9a', fontWeight: 600, fontSize: 11, '& .MuiChip-icon': { color: '#6a1b9a' } }}
        />
        <Chip
          icon={<TimerOutlined sx={{ fontSize: '13px !important' }} />}
          label={`${elapsedMin}m elapsed`}
          size="small"
          sx={{ bgcolor: '#e8eaf6', color: '#283593', fontWeight: 600, fontSize: 11, '& .MuiChip-icon': { color: '#283593' } }}
        />
        <Typography variant="caption" color="text.disabled" sx={{ ml: 0.5 }}>
          {stats.stops ?? 0} stops · est. {stats.est_min ?? 0}m
        </Typography>
        {hasBins && (
          <IconButton size="small" onClick={onToggle} sx={{ p: 0.25, ml: 0.5 }}>
            {expanded ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
          </IconButton>
        )}
      </Box>

      {hasBins && (
        <Collapse in={expanded}>
          <Box sx={{ mt: 1.5, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {bins!.collected.length > 0 && (
              <Box sx={{ minWidth: 160 }}>
                <Typography variant="caption" fontWeight={700} color="#2e7d32" sx={{ display: 'block', mb: 0.5 }}>
                  ✓ Collected
                </Typography>
                {bins!.collected.map(b => (
                  <Box key={b.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25, gap: 2 }}>
                    <Typography variant="caption" noWrap sx={{ maxWidth: 160 }}>{b.title}</Typography>
                    <Typography variant="caption" color="text.disabled">{b.fill_level}% → 0%</Typography>
                  </Box>
                ))}
              </Box>
            )}
            {bins!.skipped.length > 0 && (
              <Box sx={{ minWidth: 160 }}>
                <Typography variant="caption" fontWeight={700} color="#e65100" sx={{ display: 'block', mb: 0.5 }}>
                  — Skipped
                </Typography>
                {bins!.skipped.map(b => (
                  <Box key={b.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25, gap: 2 }}>
                    <Typography variant="caption" noWrap sx={{ maxWidth: 160, color: 'text.disabled', textDecoration: 'line-through' }}>{b.title}</Typography>
                    <Typography variant="caption" color="text.disabled">{b.fill_level}%</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Collapse>
      )}
    </Box>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type FilterValue = 'all' | ActionKey;

const LogsPage: React.FC = () => {
  const { logs, total, loading, fetchLogs } = useLogs();
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState<FilterValue>('all');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const limit = 15;

  useEffect(() => {
    fetchLogs(page * limit, limit);
  }, [page, fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  const filteredLogs = useMemo(() => {
    if (actionFilter === 'all') return logs;
    return logs.filter((l: any) => l.action === actionFilter);
  }, [logs, actionFilter]);

  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach((l: any) => { counts[l.action] = (counts[l.action] || 0) + 1; });
    return counts;
  }, [logs]);

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value - 1);
    setActionFilter('all');
    setExpandedIds(new Set());
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Fade in timeout={600}>
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>

        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>System Logs</Typography>
          <Typography variant="body2" color="text.secondary">
            Activity history for all waste bins and system events
          </Typography>
        </Box>

        {/* Summary Stats Bar */}
        <Box sx={{
          display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 3,
          p: 2, bgcolor: 'grey.50', borderRadius: 3,
          border: '1px solid', borderColor: 'divider',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
            <HistoryIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Total: <strong>{total}</strong> events
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {Object.entries(ACTION_META).map(([key, meta]) =>
              actionCounts[key] ? (
                <Chip
                  key={key}
                  icon={meta.icon as any}
                  label={`${meta.label}: ${actionCounts[key]}`}
                  size="small"
                  sx={{
                    bgcolor: meta.bg, color: meta.color, fontWeight: 500,
                    border: 'none', '& .MuiChip-icon': { color: meta.color },
                  }}
                />
              ) : null
            )}
          </Box>
        </Box>

        {/* Action Filter */}
        <Box sx={{ mb: 2.5 }}>
          <ToggleButtonGroup
            value={actionFilter}
            exclusive
            onChange={(_, v) => { if (v !== null) setActionFilter(v); }}
            size="small"
            sx={{
              flexWrap: 'wrap', gap: 0.5,
              '& .MuiToggleButton-root': {
                borderRadius: '20px !important',
                border: '1px solid',
                borderColor: 'divider',
                px: 2, fontSize: 12,
                fontWeight: 500,
                textTransform: 'none',
              },
              '& .Mui-selected': { fontWeight: 700 },
            }}
          >
            <ToggleButton value="all">All</ToggleButton>
            {Object.entries(ACTION_META).map(([key, meta]) => (
              <ToggleButton key={key} value={key}
                sx={{
                  '&.Mui-selected': { bgcolor: meta.bg + ' !important', color: meta.color + ' !important' },
                }}
              >
                {meta.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {/* Table */}
        <TableContainer
          component={Paper}
          sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}
        >
          <Table stickyHeader sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                {['Time', 'Action', 'User', 'Details'].map(h => (
                  <TableCell key={h} sx={{
                    fontWeight: 700, fontSize: 12,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                    color: 'text.secondary', bgcolor: 'grey.50',
                    borderBottom: '2px solid', borderColor: 'divider',
                  }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 8 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.45 }}>
                      <HistoryIcon sx={{ fontSize: 52, color: 'text.secondary', mb: 1.5 }} />
                      <Typography variant="h6" color="text.secondary">No logs found</Typography>
                      <Typography variant="body2" color="text.disabled">
                        {actionFilter !== 'all' ? 'Try a different filter' : 'System events will appear here'}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log: any, idx: number) => {
                  const isRouteCompleted = log.action === 'route_completed';
                  const isExpanded = expandedIds.has(log.id);

                  return (
                    <TableRow
                      key={log.id}
                      hover
                      sx={{
                        bgcolor: isRouteCompleted
                          ? '#faf5ff'
                          : idx % 2 === 0 ? 'background.paper' : 'grey.50',
                        '&:last-child td': { border: 0 },
                        ...(isRouteCompleted && { borderLeft: '3px solid #9c27b0' }),
                      }}
                    >
                      {/* Time */}
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title={new Date(log.created_at).toLocaleString()} arrow>
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {timeAgo(log.created_at)}
                            </Typography>
                            <Typography variant="caption" color="text.disabled">
                              {new Date(log.created_at).toLocaleDateString()}
                            </Typography>
                          </Box>
                        </Tooltip>
                      </TableCell>

                      {/* Action badge */}
                      <TableCell>
                        <ActionBadge action={log.action} />
                      </TableCell>

                      {/* User */}
                      <TableCell>
                        {log.performed_by ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PersonOutline sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="body2" fontWeight={500}>
                              {log.performed_by}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>

                      {/* Details */}
                      {isRouteCompleted ? (
                        <TableCell sx={{ maxWidth: 500 }}>
                          {log.notes
                            ? <RouteSummaryCell
                                notes={log.notes}
                                expanded={isExpanded}
                                onToggle={() => toggleExpand(log.id)}
                              />
                            : <Typography variant="body2" color="text.disabled">—</Typography>
                          }
                        </TableCell>
                      ) : (
                        <TableCell sx={{ maxWidth: 340 }}>
                          <Typography variant="body2"
                            color={log.notes ? 'text.primary' : 'text.disabled'}
                            sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                          >
                            {log.notes || '—'}
                          </Typography>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Showing page {page + 1} of {totalPages} ({total} total entries)
            </Typography>
            <Pagination
              count={totalPages}
              page={page + 1}
              onChange={handlePageChange}
              color="primary"
              shape="rounded"
              size="medium"
            />
          </Box>
        )}
      </Box>
    </Fade>
  );
};

export default LogsPage;
