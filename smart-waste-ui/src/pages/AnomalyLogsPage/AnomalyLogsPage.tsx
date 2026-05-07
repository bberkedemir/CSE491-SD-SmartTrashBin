import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fade,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CloudUploadOutlined,
  DeleteOutline,
  FolderOpenOutlined,
  ImageOutlined,
  LocationOnOutlined,
  PersonOutline,
  ReportProblemOutlined,
  TimerOutlined,
} from '@mui/icons-material';
import { anomalyApi } from '../../api/anomalyApi';
import { usersApi } from '../../api/usersApi';
import type { RoadAnomaly, RoadAnomalyStatus } from '../../types/bin';
import type { User } from '../../types/auth';

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

function relativeFilePath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

function isImportCandidateFile(file: File): boolean {
  const path = relativeFilePath(file).replace(/\\/g, '/').toLowerCase();
  const isGps = path.includes('gps') && (path.endsWith('.json') || path.endsWith('.csv'));
  const isReport = path.endsWith('detections_report.csv');
  const isExtractedImage = path.includes('extracted_anomalies') && /\.(jpe?g|png|webp)$/.test(path);
  return isReport || isGps || isExtractedImage;
}

function selectedFolderLabel(files: File[]): string {
  const firstPath = files[0] ? relativeFilePath(files[0]).replace(/\\/g, '/') : '';
  return firstPath.includes('/') ? firstPath.split('/')[0] : 'Selected folder';
}

function statusLabel(status: RoadAnomalyStatus): string {
  if (status === 'needs_repair') return 'Needs Repair';
  if (status === 'repaired') return 'Repaired';
  return 'Default';
}

const AnomalyLogsPage: React.FC = () => {
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [anomalies, setAnomalies] = useState<RoadAnomaly[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState<{ severity: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importPath, setImportPath] = useState('');
  const [importDriverId, setImportDriverId] = useState('');
  const [importSessionId, setImportSessionId] = useState('');
  const [copyImages, setCopyImages] = useState(true);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState('');
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
  }, [page, reloadKey]);

  useEffect(() => {
    if (!importOpen) return;

    let isMounted = true;
    setDriversLoading(true);
    usersApi.getUsers()
      .then((data) => {
        if (isMounted) setDrivers(data);
      })
      .catch((error) => {
        console.error('Error fetching users for anomaly import:', error);
        if (isMounted) setDrivers([]);
      })
      .finally(() => {
        if (isMounted) setDriversLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [importOpen]);

  const handleImport = async () => {
    const sourcePath = importPath.trim();
    if (!sourcePath && folderFiles.length === 0) {
      setNotice({ severity: 'warning', message: 'Choose a folder or enter a backend path.' });
      return;
    }

    setImporting(true);
    try {
      const importPayload = {
        driver_id: importDriverId ? Number(importDriverId) : null,
        session_id: importSessionId.trim() || null,
        copy_images: copyImages,
      };
      const response = folderFiles.length > 0
        ? await anomalyApi.importFolderFiles(folderFiles, importPayload)
        : await anomalyApi.importExisting({
          source_path: sourcePath,
          ...importPayload,
        });
      const skippedText = response.total_skipped ? ` ${response.total_skipped} row(s) skipped.` : '';
      setNotice({ severity: 'success', message: `${response.message}${skippedText}` });
      setImportOpen(false);
      setImportPath('');
      setImportSessionId('');
      setImportDriverId('');
      setFolderFiles([]);
      setFolderName('');
      setPage(0);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setNotice({
        severity: 'error',
        message: error instanceof Error ? error.message : 'Import failed.',
      });
    } finally {
      setImporting(false);
    }
  };

  const openFolderPicker = () => {
    const input = folderInputRef.current;
    if (!input) return;
    input.value = '';
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.click();
  };

  const handleFolderSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const candidates = files.filter(isImportCandidateFile);
    setFolderFiles(candidates);
    setFolderName(candidates.length ? selectedFolderLabel(candidates) : '');
    setImportPath('');

    if (files.length > 0 && candidates.length === 0) {
      setNotice({ severity: 'warning', message: 'No importable CSV, GPS, or extracted anomaly image files were found in that folder.' });
    }
  };

  const handleStatusChange = async (anomaly: RoadAnomaly, status: RoadAnomalyStatus) => {
    try {
      const updated = await anomalyApi.updateStatus(anomaly.id, status);
      setAnomalies((items) => items.map((item) => item.id === anomaly.id ? updated : item));
      setNotice({ severity: 'success', message: `Anomaly marked as ${statusLabel(status)}.` });
    } catch (error) {
      setNotice({
        severity: 'error',
        message: error instanceof Error ? error.message : 'Failed to update anomaly status.',
      });
    }
  };

  const handleDeleteAnomaly = async (anomaly: RoadAnomaly) => {
    if (!window.confirm('Delete this road anomaly? This cannot be undone.')) return;

    try {
      await anomalyApi.delete(anomaly.id);
      setAnomalies((items) => items.filter((item) => item.id !== anomaly.id));
      setTotal((value) => Math.max(0, value - 1));
      setNotice({ severity: 'success', message: 'Road anomaly deleted.' });
    } catch (error) {
      setNotice({
        severity: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete road anomaly.',
      });
    }
  };

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
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' }, gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Anomaly Logs
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Detected road anomalies with crop images, GPS coordinates, confidence, and driver details
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<CloudUploadOutlined />}
            onClick={() => setImportOpen(true)}
            sx={{ alignSelf: { xs: 'stretch', md: 'center' }, bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
          >
            Import Existing Folder
          </Button>
        </Box>

        {notice && (
          <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ mb: 3 }}>
            {notice.message}
          </Alert>
        )}

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
          <Table stickyHeader sx={{ minWidth: 1120 }}>
            <TableHead>
              <TableRow>
                {['Image', 'Detection', 'GPS', 'Driver', 'Status', 'Upload', 'Created', 'Actions'].map((header) => (
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
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : anomalies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
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
                        <FormControl size="small" sx={{ minWidth: 142 }}>
                          <Select
                            value={anomaly.status}
                            onChange={(event) => handleStatusChange(anomaly, event.target.value as RoadAnomalyStatus)}
                            sx={{
                              bgcolor: anomaly.status === 'repaired' ? '#e8f5e9' : anomaly.status === 'needs_repair' ? '#fff3e0' : '#f5f5f5',
                              color: anomaly.status === 'repaired' ? '#2e7d32' : anomaly.status === 'needs_repair' ? '#e65100' : 'text.primary',
                              fontWeight: 700,
                              '& .MuiSelect-select': { py: 0.75 },
                            }}
                          >
                            <MenuItem value="default">Default</MenuItem>
                            <MenuItem value="needs_repair">Needs Repair</MenuItem>
                            <MenuItem value="repaired">Repaired</MenuItem>
                          </Select>
                        </FormControl>
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

                      <TableCell>
                        <Tooltip title="Delete anomaly" arrow>
                          <IconButton
                            color="error"
                            size="small"
                            onClick={() => handleDeleteAnomaly(anomaly)}
                          >
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
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

        <Dialog open={importOpen} onClose={() => !importing && setImportOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Import Existing Analysis</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <input
              ref={folderInputRef}
              type="file"
              multiple
              onChange={handleFolderSelected}
              style={{ display: 'none' }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                startIcon={<FolderOpenOutlined />}
                onClick={openFolderPicker}
                disabled={importing}
              >
                Choose Folder
              </Button>
              {folderFiles.length > 0 && (
                <Chip
                  icon={<ImageOutlined />}
                  label={`${folderName} · ${folderFiles.length} files`}
                  sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 700, '& .MuiChip-icon': { color: '#2e7d32' } }}
                />
              )}
            </Box>
            <TextField
              label="Backend path"
              value={importPath}
              onChange={(event) => setImportPath(event.target.value)}
              fullWidth
              disabled={folderFiles.length > 0}
            />
            <FormControl fullWidth disabled={driversLoading}>
              <InputLabel id="anomaly-import-driver-label">Driver</InputLabel>
              <Select
                labelId="anomaly-import-driver-label"
                label="Driver"
                value={importDriverId}
                onChange={(event) => setImportDriverId(event.target.value)}
              >
                <MenuItem value="">Infer from folder</MenuItem>
                {drivers.map((driver) => (
                  <MenuItem key={driver.id} value={String(driver.id)}>
                    {driver.full_name || driver.username} #{driver.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Session ID override"
              value={importSessionId}
              onChange={(event) => setImportSessionId(event.target.value)}
              fullWidth
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={copyImages}
                  onChange={(_, checked) => setCopyImages(checked)}
                />
              }
              label="Copy crop images into backend uploads"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setImportOpen(false)} disabled={importing}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleImport}
              disabled={importing || (!importPath.trim() && folderFiles.length === 0)}
              startIcon={importing ? <CircularProgress color="inherit" size={16} /> : <CloudUploadOutlined />}
            >
              Import
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default AnomalyLogsPage;
