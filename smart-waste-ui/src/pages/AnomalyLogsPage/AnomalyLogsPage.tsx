import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Fade,
  Pagination,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ImageOutlined,
  LocationOnOutlined,
  PersonOutline,
  ReportProblemOutlined,
  TimerOutlined,
} from '@mui/icons-material';
import { anomalyApi } from '../../api/anomalyApi';
import type { RoadAnomaly } from '../../types/bin';

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '-';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function absoluteImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return imageUrl;
}

const AnomalyLogsPage: React.FC = () => {
  const [anomalies, setAnomalies] = useState<RoadAnomaly[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 12;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    anomalyApi.fetchLogs(page * limit, limit)
      .then((data) => {
        if (!isMounted) return;
        setAnomalies(data.anomalies);
        setTotal(data.total);
      })
      .catch((error) => {
        console.error('Error fetching anomaly logs:', error);
        if (isMounted) {
          setAnomalies([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  const summary = useMemo(() => {
    const uniqueDrivers = new Set(anomalies.map(item => item.driver_id).filter(Boolean));
    const avgConfidence = anomalies.length
      ? anomalies.reduce((sum, item) => sum + item.confidence, 0) / anomalies.length
      : 0;
    return {
      visible: anomalies.length,
      drivers: uniqueDrivers.size,
      avgConfidence,
    };
  }, [anomalies]);

  return (
    <Fade in timeout={600}>
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1280, mx: 'auto' }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Anomaly Logs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Detected road anomalies with crop images, GPS coordinates, confidence, and driver details
          </Typography>
        </Box>

        <Box sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          mb: 3,
          p: 2,
          bgcolor: 'grey.50',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
        }}>
          <Chip
            icon={<ReportProblemOutlined />}
            label={`${total} total anomalies`}
            sx={{ bgcolor: '#f3e5f5', color: '#6a1b9a', fontWeight: 700, '& .MuiChip-icon': { color: '#6a1b9a' } }}
          />
          <Chip
            icon={<ImageOutlined />}
            label={`${summary.visible} visible on this page`}
            sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 700, '& .MuiChip-icon': { color: '#2e7d32' } }}
          />
          <Chip
            icon={<PersonOutline />}
            label={`${summary.drivers} drivers on this page`}
            sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 700, '& .MuiChip-icon': { color: '#1565c0' } }}
          />
          <Chip
            label={`${Math.round(summary.avgConfidence * 100)}% avg confidence`}
            sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700 }}
          />
        </Box>

        <TableContainer
          component={Paper}
          sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}
        >
          <Table stickyHeader sx={{ minWidth: 980 }}>
            <TableHead>
              <TableRow>
                {['Image', 'Detection', 'GPS', 'Driver', 'Upload', 'Created'].map((header) => (
                  <TableCell key={header} sx={{
                    fontWeight: 700,
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: 'text.secondary',
                    bgcolor: 'grey.50',
                    borderBottom: '2px solid',
                    borderColor: 'divider',
                  }}>
                    {header}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : anomalies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.45 }}>
                      <ReportProblemOutlined sx={{ fontSize: 52, color: 'text.secondary', mb: 1.5 }} />
                      <Typography variant="h6" color="text.secondary">No anomaly logs found</Typography>
                      <Typography variant="body2" color="text.disabled">
                        Analyzed road anomalies will appear here
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                anomalies.map((anomaly, index) => {
                  const imageUrl = absoluteImageUrl(anomaly.image_url);
                  const createdAt = anomaly.created_at ? new Date(anomaly.created_at) : null;

                  return (
                    <TableRow
                      key={anomaly.id}
                      hover
                      sx={{
                        bgcolor: index % 2 === 0 ? 'background.paper' : 'grey.50',
                        '&:last-child td': { border: 0 },
                      }}
                    >
                      <TableCell>
                        {imageUrl ? (
                          <Box
                            component="img"
                            src={imageUrl}
                            alt={`${anomaly.class_name} crop`}
                            sx={{
                              width: 118,
                              height: 78,
                              objectFit: 'cover',
                              borderRadius: 1.5,
                              display: 'block',
                              bgcolor: '#eceff1',
                            }}
                          />
                        ) : (
                          <Box sx={{
                            width: 118,
                            height: 78,
                            borderRadius: 1.5,
                            bgcolor: '#eceff1',
                            color: 'text.disabled',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                          }}>
                            No image
                          </Box>
                        )}
                      </TableCell>

                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                          <Chip
                            icon={<ReportProblemOutlined sx={{ fontSize: '14px !important' }} />}
                            label={anomaly.class_name}
                            size="small"
                            sx={{ alignSelf: 'flex-start', bgcolor: '#f3e5f5', color: '#6a1b9a', fontWeight: 700, '& .MuiChip-icon': { color: '#6a1b9a' } }}
                          />
                          <Typography variant="body2" fontWeight={600}>
                            {Math.round(anomaly.confidence * 100)}% confidence
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <TimerOutlined sx={{ fontSize: 14 }} />
                            {anomaly.timestamp_seconds.toFixed(1)}s in video
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                          <LocationOnOutlined sx={{ fontSize: 18, color: '#6a1b9a', mt: 0.2 }} />
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {anomaly.latitude?.toFixed(5) ?? '-'}
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {anomaly.longitude?.toFixed(5) ?? '-'}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <PersonOutline sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {anomaly.driver_full_name || anomaly.driver_username || `Driver #${anomaly.driver_id ?? '-'}`}
                            </Typography>
                            <Typography variant="caption" color="text.disabled">
                              {anomaly.driver_email || anomaly.driver_username || '-'}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          Upload #{anomaly.upload_id}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          Track #{anomaly.track_id}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {createdAt ? (
                          <Tooltip title={createdAt.toLocaleString()} arrow>
                            <Box>
                              <Typography variant="body2" fontWeight={500}>
                                {timeAgo(anomaly.created_at)}
                              </Typography>
                              <Typography variant="caption" color="text.disabled">
                                {createdAt.toLocaleDateString()}
                              </Typography>
                            </Box>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.disabled">-</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Showing page {page + 1} of {totalPages} ({total} total entries)
            </Typography>
            <Pagination
              count={totalPages}
              page={page + 1}
              onChange={(_, value) => setPage(value - 1)}
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

export default AnomalyLogsPage;
