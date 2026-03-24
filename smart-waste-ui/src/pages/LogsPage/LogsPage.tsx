import { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Chip, Pagination,
  Fade, ToggleButton, ToggleButtonGroup, Tooltip,
} from '@mui/material';
import {
  History as HistoryIcon,
  AddCircleOutline,
  DeleteOutline,
  LocalShipping,
  AltRoute,
  ArrowForward,
} from '@mui/icons-material';
import { useLogs } from '../../hooks/useLogs';

type ActionType = 'all' | 'bin_added' | 'bin_deleted' | 'collected' | 'route_generated';

const ACTION_META: Record<string, { label: string; color: 'success' | 'error' | 'info' | 'primary'; icon: React.ReactNode }> = {
  bin_added:       { label: 'Bin Added',       color: 'success', icon: <AddCircleOutline fontSize="small" /> },
  bin_deleted:     { label: 'Bin Deleted',     color: 'error',   icon: <DeleteOutline fontSize="small" /> },
  collected:       { label: 'Collected',       color: 'info',    icon: <LocalShipping fontSize="small" /> },
  route_generated: { label: 'Route Generated', color: 'primary', icon: <AltRoute fontSize="small" /> },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function FillDelta({ before, after }: { before: number | null; after: number | null }) {
  if (before == null && after == null) return <Typography variant="body2" color="text.disabled">—</Typography>;

  const getFillColor = (v: number) =>
    v < 25 ? '#22c55e' : v < 50 ? '#f59e0b' : v < 75 ? '#f97316' : '#ef4444';

  if (before == null || after == null) {
    const val = before ?? after ?? 0;
    return (
      <Chip
        label={`${val}%`}
        size="small"
        sx={{ bgcolor: getFillColor(val) + '22', color: getFillColor(val), fontWeight: 600, fontSize: 11 }}
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Chip
        label={`${before}%`}
        size="small"
        sx={{ bgcolor: getFillColor(before) + '22', color: getFillColor(before), fontWeight: 600, fontSize: 11 }}
      />
      <ArrowForward sx={{ fontSize: 14, color: 'text.disabled' }} />
      <Chip
        label={`${after}%`}
        size="small"
        sx={{ bgcolor: getFillColor(after) + '22', color: getFillColor(after), fontWeight: 600, fontSize: 11 }}
      />
    </Box>
  );
}

const LogsPage: React.FC = () => {
  const { logs, total, loading, fetchLogs } = useLogs();
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState<ActionType>('all');
  const limit = 15;

  useEffect(() => {
    fetchLogs(page * limit, limit);
  }, [page, fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  const filteredLogs = useMemo(() => {
    if (actionFilter === 'all') return logs;
    return logs.filter((l: any) => l.action === actionFilter);
  }, [logs, actionFilter]);

  // Count per action type from current page
  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach((l: any) => { counts[l.action] = (counts[l.action] || 0) + 1; });
    return counts;
  }, [logs]);

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value - 1);
    setActionFilter('all');
  };

  return (
    <Fade in timeout={600}>
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            System Logs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Activity history for all waste bins and system events
          </Typography>
        </Box>

        {/* Summary Stats Bar */}
        <Box
          sx={{
            display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 3,
            p: 2, bgcolor: 'grey.50', borderRadius: 3, border: '1px solid', borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
            <HistoryIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Total: <strong>{total}</strong> events
            </Typography>
          </Box>
          <Fade in timeout={400}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {Object.entries(ACTION_META).map(([key, meta]) =>
                actionCounts[key] ? (
                  <Chip
                    key={key}
                    icon={meta.icon as any}
                    label={`${meta.label}: ${actionCounts[key]}`}
                    color={meta.color}
                    variant="outlined"
                    size="small"
                    sx={{ fontWeight: 500 }}
                  />
                ) : null
              )}
            </Box>
          </Fade>
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
                borderRadius: '20px !important', border: '1px solid', borderColor: 'divider',
                px: 2, fontSize: 12, fontWeight: 500, textTransform: 'none',
              },
              '& .Mui-selected': { fontWeight: 700 },
            }}
          >
            <ToggleButton value="all">All</ToggleButton>
            {Object.entries(ACTION_META).map(([key, meta]) => (
              <ToggleButton key={key} value={key} color={meta.color}>
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
                {['Time', 'Action', 'Bin ID', 'Fill Change', 'Notes'].map(h => (
                  <TableCell
                    key={h}
                    sx={{
                      fontWeight: 700, fontSize: 12, textTransform: 'uppercase',
                      letterSpacing: 0.5, color: 'text.secondary',
                      bgcolor: 'grey.50', borderBottom: '2px solid', borderColor: 'divider',
                    }}
                  >
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
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
                  const meta = ACTION_META[log.action];
                  return (
                    <TableRow
                      key={log.id}
                      hover
                      sx={{
                        bgcolor: idx % 2 === 0 ? 'background.paper' : 'grey.50/50',
                        '&:last-child td': { border: 0 },
                      }}
                    >
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
                      <TableCell>
                        {meta ? (
                          <Chip
                            icon={meta.icon as any}
                            label={meta.label}
                            color={meta.color}
                            size="small"
                            sx={{ fontWeight: 600, fontSize: 11 }}
                          />
                        ) : (
                          <Chip label={log.action} size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                          {log.bin_id ?? '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <FillDelta before={log.fill_before} after={log.fill_after} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={log.notes ? 'text.primary' : 'text.disabled'}>
                          {log.notes || '—'}
                        </Typography>
                      </TableCell>
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
