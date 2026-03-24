import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, LinearProgress,
  Fade, Divider, Chip, Skeleton, Alert,
} from '@mui/material';
import {
  DeleteOutline, TrendingUp, WarningAmber,
  CheckCircleOutline, RefreshOutlined,
} from '@mui/icons-material';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { binApi } from '../../api/binApi';
import type { BinPoint } from '../../types/bin';

interface BinStats {
  totalBins: number;
  avgFill: number;
  fullBins: number;
  operationalBins: number;
  fillRanges: { label: string; count: number; color: string }[];
  attentionBins: BinPoint[];
}

const FILL_COLORS = ['#22c55e', '#f59e0b', '#f97316', '#ef4444'];

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [stats, setStats] = useState<BinStats>({
    totalBins: 0,
    avgFill: 0,
    fullBins: 0,
    operationalBins: 0,
    fillRanges: [],
    attentionBins: [],
  });

  const fetchAndCalculate = async () => {
    setLoading(true);
    try {
      const data = await binApi.fetchAll();
      const total = data.length;
      const avg = total > 0 ? data.reduce((s, b) => s + b.fill, 0) / total : 0;
      const full = data.filter(b => b.fill >= 75).length;
      const operative = data.filter(b => b.fill < 75).length;

      const fillRanges = [
        { label: '0–25% Empty',  count: data.filter(b => b.fill < 25).length,                       color: FILL_COLORS[0] },
        { label: '25–50% Low',   count: data.filter(b => b.fill >= 25 && b.fill < 50).length,       color: FILL_COLORS[1] },
        { label: '50–75% Med',   count: data.filter(b => b.fill >= 50 && b.fill < 75).length,       color: FILL_COLORS[2] },
        { label: '75–100% Full', count: data.filter(b => b.fill >= 75).length,                       color: FILL_COLORS[3] },
      ];

      const attentionBins = data
        .filter(b => b.fill >= 75)
        .sort((a, b) => b.fill - a.fill);

      setStats({ totalBins: total, avgFill: avg, fullBins: full, operationalBins: operative, fillRanges, attentionBins });
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAndCalculate(); }, []);

  const avgFillColor = stats.avgFill < 50 ? 'success.main' : stats.avgFill < 75 ? 'warning.main' : 'error.main';

  const StatCard = ({
    icon, label, value, sub, accent, pulse,
  }: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    sub?: string;
    accent: string;
    pulse?: boolean;
  }) => (
    <Card
      sx={{
        flex: '1 1 200px', minWidth: 210, borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        transition: 'transform .2s, box-shadow .2s',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 28px rgba(0,0,0,0.12)' },
        position: 'relative', overflow: 'visible',
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box
            sx={{
              width: 44, height: 44, borderRadius: 2,
              bgcolor: accent, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#fff', mb: 1.5,
            }}
          >
            {icon}
          </Box>
          {pulse && (
            <Box
              sx={{
                width: 10, height: 10, borderRadius: '50%', bgcolor: 'error.main',
                animation: 'pulse 1.4s infinite',
                '@keyframes pulse': {
                  '0%': { boxShadow: '0 0 0 0 rgba(239,68,68,.6)' },
                  '70%': { boxShadow: '0 0 0 8px rgba(239,68,68,0)' },
                  '100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0)' },
                },
              }}
            />
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" fontWeight={500} gutterBottom>
          {label}
        </Typography>
        <Typography variant="h3" fontWeight="bold" lineHeight={1}>
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.disabled" mt={0.5} display="block">
            {sub}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  const getFillBarColor = (fill: number) => {
    if (fill < 25) return '#22c55e';
    if (fill < 50) return '#f59e0b';
    if (fill < 75) return '#f97316';
    return '#ef4444';
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      return (
        <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 1.5, borderRadius: 2, boxShadow: 3 }}>
          <Typography variant="body2" fontWeight={600}>{payload[0].name}</Typography>
          <Typography variant="body2" color="text.secondary">{payload[0].value} bins</Typography>
        </Box>
      );
    }
    return null;
  };

  return (
    <Fade in timeout={600}>
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 4 }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Smart waste bin monitoring overview
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {lastUpdated && (
              <Typography variant="caption" color="text.disabled">
                Updated {lastUpdated.toLocaleTimeString()}
              </Typography>
            )}
            <RefreshOutlined
              sx={{ color: 'text.disabled', cursor: 'pointer', fontSize: 18, '&:hover': { color: 'primary.main' } }}
              onClick={fetchAndCalculate}
            />
          </Box>
        </Box>

        {/* KPI Cards */}
        {loading ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} variant="rounded" sx={{ flex: '1 1 200px', minWidth: 210, height: 130, borderRadius: 3 }} />
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
            <StatCard
              icon={<DeleteOutline />}
              label="Total Bins"
              value={stats.totalBins}
              sub="monitored locations"
              accent="#6366f1"
            />
            <StatCard
              icon={<TrendingUp />}
              label="Average Fill"
              value={
                <Box component="span" sx={{ color: avgFillColor }}>
                  {stats.avgFill.toFixed(1)}%
                </Box>
              }
              sub="across all bins"
              accent="#0ea5e9"
            />
            <StatCard
              icon={<WarningAmber />}
              label="Need Attention"
              value={stats.fullBins}
              sub="bins ≥ 75% full"
              accent="#ef4444"
              pulse={stats.fullBins > 0}
            />
            <StatCard
              icon={<CheckCircleOutline />}
              label="Operational"
              value={stats.operationalBins}
              sub="bins < 75% full"
              accent="#22c55e"
            />
          </Box>
        )}

        {/* Charts + Attention row */}
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>

          {/* Donut Chart */}
          <Card sx={{ flex: '1 1 300px', minWidth: 300, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Fill Distribution
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Bins grouped by fill level
              </Typography>
              {loading ? (
                <Skeleton variant="circular" width={200} height={200} sx={{ mx: 'auto' }} />
              ) : stats.totalBins === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={4}>No data</Typography>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={stats.fillRanges.filter(r => r.count > 0)}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={100}
                      paddingAngle={3}
                    >
                      {stats.fillRanges.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      formatter={(value) => (
                        <Typography component="span" variant="caption" color="text.secondary">{value}</Typography>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Attention Panel */}
          <Card sx={{ flex: '1 1 300px', minWidth: 300, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                  Bins Needing Attention
                </Typography>
                {!loading && stats.fullBins > 0 && (
                  <Chip label={`${stats.fullBins} bins`} color="error" size="small" />
                )}
              </Box>

              {loading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {[...Array(3)].map((_, i) => <Skeleton key={i} variant="rounded" height={50} sx={{ borderRadius: 2 }} />)}
                </Box>
              ) : stats.attentionBins.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CheckCircleOutline sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                  <Typography variant="body1" color="text.secondary">
                    All bins are within normal levels!
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 300, overflowY: 'auto' }}>
                  {stats.attentionBins.map((bin, i) => (
                    <Box key={bin.id}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: '65%' }}>
                          {bin.title}
                        </Typography>
                        <Typography variant="body2" fontWeight="bold" sx={{ color: getFillBarColor(bin.fill) }}>
                          {bin.fill}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={bin.fill}
                        sx={{
                          height: 8, borderRadius: 4,
                          bgcolor: 'grey.100',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: getFillBarColor(bin.fill), borderRadius: 4,
                          },
                        }}
                      />
                      {i < stats.attentionBins.length - 1 && <Divider sx={{ mt: 1.5 }} />}
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Fill Level Bar Breakdown */}
        <Card sx={{ mt: 3, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Fill Level Breakdown
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[...Array(4)].map((_, i) => <Skeleton key={i} variant="rounded" height={40} sx={{ borderRadius: 2 }} />)}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 2 }}>
                {stats.fillRanges.map((range) => (
                  <Box key={range.label}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: range.color }} />
                        <Typography variant="body2" fontWeight={500} color="text.secondary">
                          {range.label}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight="bold">
                          {range.count} bins
                        </Typography>
                        <Chip
                          label={`${stats.totalBins > 0 ? ((range.count / stats.totalBins) * 100).toFixed(0) : 0}%`}
                          size="small"
                          sx={{ height: 20, fontSize: 11, bgcolor: range.color + '22', color: range.color, fontWeight: 600 }}
                        />
                      </Box>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={stats.totalBins > 0 ? (range.count / stats.totalBins) * 100 : 0}
                      sx={{
                        height: 12, borderRadius: 6,
                        bgcolor: range.color + '22',
                        '& .MuiLinearProgress-bar': { bgcolor: range.color, borderRadius: 6 },
                      }}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Alert banner for critical bins */}
        {!loading && stats.fullBins > 0 && (
          <Alert
            severity="warning"
            sx={{ mt: 3, borderRadius: 3 }}
            icon={<WarningAmber />}
          >
            <strong>{stats.fullBins} bin{stats.fullBins > 1 ? 's' : ''}</strong> {stats.fullBins > 1 ? 'are' : 'is'} at or above 75% capacity and should be collected soon.
          </Alert>
        )}
      </Box>
    </Fade>
  );
};

export default Dashboard;
