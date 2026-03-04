import { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, LinearProgress } from '@mui/material';
import { binApi } from '../../api/binApi';
import type { BinPoint } from '../../types/bin';

interface BinStats {
  totalBins: number;
  avgFill: number;
  fullBins: number;
  emptyBins: number;
  fillRanges: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<BinStats>({
    totalBins: 0,
    avgFill: 0,
    fullBins: 0,
    emptyBins: 0,
    fillRanges: { low: 0, medium: 0, high: 0, critical: 0 },
  });

  useEffect(() => {
    const fetchBins = async () => {
      try {
        const data = await binApi.fetchAll();
        calculateStats(data);
      } catch (error) {
        console.error('Error fetching bins:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchBins();
  }, []);

  const calculateStats = (binsData: BinPoint[]) => {
    const total = binsData.length;
    const avg = total > 0 ? binsData.reduce((sum, b) => sum + b.fill, 0) / total : 0;
    const full = binsData.filter(b => b.fill >= 75).length;
    const empty = binsData.filter(b => b.fill === 0).length;

    const fillRanges = {
      low: binsData.filter(b => b.fill >= 0 && b.fill < 25).length,
      medium: binsData.filter(b => b.fill >= 25 && b.fill < 50).length,
      high: binsData.filter(b => b.fill >= 50 && b.fill < 75).length,
      critical: binsData.filter(b => b.fill >= 75 && b.fill <= 100).length,
    };

    setStats({
      totalBins: total,
      avgFill: avg,
      fullBins: full,
      emptyBins: empty,
      fillRanges,
    });
  };

  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  const getPercentage = (count: number) => {
    return stats.totalBins > 0 ? (count / stats.totalBins) * 100 : 0;
  };

  const cardStyle = {
    flex: '1 1 200px',
    minWidth: '200px',
  };

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      {/* Stats Cards */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
        <Card sx={cardStyle}>
          <CardContent>
            <Typography color="text.secondary" gutterBottom>
              Total Bins
            </Typography>
            <Typography variant="h3" fontWeight="bold">
              {stats.totalBins}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={cardStyle}>
          <CardContent>
            <Typography color="text.secondary" gutterBottom>
              Average Fill
            </Typography>
            <Typography variant="h3" fontWeight="bold" color="primary">
              {stats.avgFill.toFixed(1)}%
            </Typography>
          </CardContent>
        </Card>

        <Card sx={cardStyle}>
          <CardContent>
            <Typography color="text.secondary" gutterBottom>
              Full Bins (75%+)
            </Typography>
            <Typography variant="h3" fontWeight="bold" color="error">
              {stats.fullBins}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={cardStyle}>
          <CardContent>
            <Typography color="text.secondary" gutterBottom>
              Empty Bins
            </Typography>
            <Typography variant="h3" fontWeight="bold" color="success">
              {stats.emptyBins}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Fill Level Distribution */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Fill Level Distribution
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2">0-25% (Empty)</Typography>
              <Typography variant="body2">{stats.fillRanges.low} bins ({getPercentage(stats.fillRanges.low).toFixed(1)}%)</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={getPercentage(stats.fillRanges.low)}
              sx={{ height: 12, borderRadius: 6, bgcolor: '#e0e0e0', '& .MuiLinearProgress-bar': { bgcolor: '#2ed573' } }}
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2">25-50% (Low)</Typography>
              <Typography variant="body2">{stats.fillRanges.medium} bins ({getPercentage(stats.fillRanges.medium).toFixed(1)}%)</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={getPercentage(stats.fillRanges.medium)}
              sx={{ height: 12, borderRadius: 6, bgcolor: '#e0e0e0', '& .MuiLinearProgress-bar': { bgcolor: '#ffa502' } }}
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2">50-75% (Medium)</Typography>
              <Typography variant="body2">{stats.fillRanges.high} bins ({getPercentage(stats.fillRanges.high).toFixed(1)}%)</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={getPercentage(stats.fillRanges.high)}
              sx={{ height: 12, borderRadius: 6, bgcolor: '#e0e0e0', '& .MuiLinearProgress-bar': { bgcolor: '#ff7f50' } }}
            />
          </Box>

          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2">75-100% (Full)</Typography>
              <Typography variant="body2">{stats.fillRanges.critical} bins ({getPercentage(stats.fillRanges.critical).toFixed(1)}%)</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={getPercentage(stats.fillRanges.critical)}
              sx={{ height: 12, borderRadius: 6, bgcolor: '#e0e0e0', '& .MuiLinearProgress-bar': { bgcolor: '#ff4757' } }}
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Dashboard;
