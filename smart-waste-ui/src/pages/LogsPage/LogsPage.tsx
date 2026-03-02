import { useEffect, useState } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, CircularProgress } from '@mui/material';
import { useLogs } from '../../hooks/useLogs';

const LogsPage: React.FC = () => {
  const { logs, total, loading, fetchLogs } = useLogs();
  const [page, setPage] = useState(0);
  const limit = 10;

  useEffect(() => {
    fetchLogs(page * limit, limit);
  }, [page, fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'bin_added': return 'success';
      case 'bin_deleted': return 'error';
      case 'collected': return 'info';
      case 'route_generated': return 'primary';
      default: return 'default';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Logs
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Date</strong></TableCell>
              <TableCell><strong>Action</strong></TableCell>
              <TableCell><strong>Bin ID</strong></TableCell>
              <TableCell><strong>Fill Before</strong></TableCell>
              <TableCell><strong>Fill After</strong></TableCell>
              <TableCell><strong>Notes</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  No logs found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log: any) => (
                <TableRow key={log.id} hover>
                  <TableCell>{formatDate(log.created_at)}</TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        display: 'inline-block',
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        bgcolor: `${getActionColor(log.action)}.light`,
                        color: `${getActionColor(log.action)}.main`,
                        fontWeight: 500,
                      }}
                    >
                      {log.action}
                    </Typography>
                  </TableCell>
                  <TableCell>{log.bin_id || '-'}</TableCell>
                  <TableCell>{log.fill_before ?? '-'}</TableCell>
                  <TableCell>{log.fill_after ?? '-'}</TableCell>
                  <TableCell>{log.notes || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 2, gap: 2 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
        >
          Previous
        </Button>
        <Typography variant="body2">
          Page {page + 1} of {totalPages || 1}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setPage(p => p + 1)}
          disabled={page + 1 >= totalPages}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
};

export default LogsPage;
