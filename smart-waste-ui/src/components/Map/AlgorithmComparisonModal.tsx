import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress, Typography, Box, Table, TableBody, TableCell, TableHead, TableRow, Chip, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { binApi } from '../../api/binApi';
import type { RouteResponse } from '../../types/bin';

interface Props {
  open: boolean;
  onClose: () => void;
  threshold: number;
  startLat: number;
  startLng: number;
}

interface Result {
  name: string;
  isBest: boolean;
  data: RouteResponse | null;
  execTime: number;
  error: string | null;
}

const AlgorithmComparisonModal: React.FC<Props> = ({ open, onClose, threshold, startLat, startLng }) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    if (open) {
      runComparison();
    } else {
      setResults([]);
    }
  }, [open]);

  const runComparison = async () => {
    setLoading(true);
    setResults([]);

    const algos = [
      { id: 'default', name: 'NN + 2-opt + Or-Opt', apiCall: binApi.optimizeRoute },
      { id: 'greedy', name: 'Greedy Nearest Neighbor', apiCall: binApi.optimizeRouteGreedy },
    ];

    const currentResults: Result[] = [];

    for (const algo of algos) {
      const start = performance.now();
      try {
        const data = await algo.apiCall(threshold, startLat, startLng);
        const end = performance.now();
        currentResults.push({
          name: algo.name,
          isBest: false,
          data,
          execTime: Math.round(end - start),
          error: null
        });
      } catch (err: any) {
        currentResults.push({
          name: algo.name,
          isBest: false,
          data: null,
          execTime: 0,
          error: err.message || 'Failed'
        });
      }
    }

    // Determine Best (shortest distance, then time)
    const validResults = currentResults.filter(r => r.data);
    if (validResults.length > 0) {
      validResults.sort((a, b) => {
        if (a.data!.total_distance_km !== b.data!.total_distance_km) {
          return a.data!.total_distance_km - b.data!.total_distance_km;
        }
        return a.data!.estimated_time_minutes - b.data!.estimated_time_minutes;
      });
      // Mark the first one as best
      const bestName = validResults[0].name;
      currentResults.forEach(r => {
        if (r.name === bestName) r.isBest = true;
      });
    }

    setResults(currentResults);
    setLoading(false);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: 'rgba(235, 240, 245, 0.5)',
          backdropFilter: 'blur(12px)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          color: '#333',
        }
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pb: 1,
        pt: 3,
        px: 4,
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h6" fontWeight="600" color="#4a5568">
            Algorithm Comparison
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          sx={{
            bgcolor: 'rgba(0,0,0,0.05)',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' }
          }}
          size="small"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 4 }}>
        <Typography variant="body2" sx={{ color: '#718096', mb: 3 }}>
          All algorithms tested with threshold={threshold}% on the same bin data.
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
            <CircularProgress sx={{ color: '#4a5568' }} />
            <Typography color="#718096">Simulating optimizations...</Typography>
          </Box>
        ) : (
          <Box sx={{
            borderRadius: '12px',
            overflow: 'hidden',
            bgcolor: 'rgba(255,255,255,0.4)',
            border: '1px solid rgba(255,255,255,0.6)'
          }}>
            <Table>
              <TableHead>
                <TableRow sx={{ '& th': { color: '#718096', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.8)', fontSize: '0.8rem' } }}>
                  <TableCell>ALGORITHM</TableCell>
                  <TableCell align="right">DISTANCE</TableCell>
                  <TableCell align="right">TIME</TableCell>
                  <TableCell align="right">STOPS</TableCell>
                  <TableCell align="right">EXEC.</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((row) => (
                  <TableRow key={row.name} sx={{
                    '& td': { color: '#4a5568', borderBottom: '1px solid rgba(255,255,255,0.5)' },
                    ...(row.isBest ? { bgcolor: 'rgba(255, 255, 255, 0.7)' } : { bgcolor: 'rgba(255, 255, 255, 0.2)' })
                  }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography fontWeight={row.isBest ? 700 : 600} color="#2d3748">{row.name}</Typography>
                        {row.isBest && (
                          <Chip
                            label="BEST"
                            size="small"
                            sx={{
                              bgcolor: '#68d391',
                              color: '#fff',
                              fontWeight: 'bold',
                              height: 22,
                              fontSize: '0.7rem'
                            }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    {row.data ? (
                      <>
                        <TableCell align="right">
                          <Typography fontWeight="700" color="#2d3748">{row.data.total_distance_km.toFixed(2)} km</Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ color: '#718096' }}>{Math.round(row.data.estimated_time_minutes)} min</TableCell>
                        <TableCell align="right" sx={{ color: '#718096' }}>{row.data.total_stops}</TableCell>
                        <TableCell align="right" sx={{ color: '#718096' }}>{row.execTime}ms</TableCell>
                      </>
                    ) : (
                      <TableCell colSpan={4} align="center" sx={{ color: '#e53e3e !important' }}>
                        Error: {row.error}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button
          onClick={onClose}
          variant="contained"
          disableElevation
          sx={{
            bgcolor: 'rgba(0,0,0,0.06)',
            color: '#4a5568',
            fontWeight: 600,
            borderRadius: '8px',
            textTransform: 'none',
            px: 3,
            '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' }
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AlgorithmComparisonModal;
