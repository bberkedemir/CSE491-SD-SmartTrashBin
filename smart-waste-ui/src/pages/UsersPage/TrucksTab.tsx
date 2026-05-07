import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { trucksApi } from '../../api/trucksApi';
import { usersApi } from '../../api/usersApi';
import TruckFormDialog from './TruckFormDialog';
import type { Truck, TruckStatus } from '../../types/truck';
import type { User } from '../../types/auth';

const STATUS_COLOR: Record<TruckStatus, 'success' | 'primary' | 'warning'> = {
  available: 'success',
  in_service: 'primary',
  maintenance: 'warning',
};

const STATUS_LABEL: Record<TruckStatus, string> = {
  available: 'Available',
  in_service: 'In Service',
  maintenance: 'Maintenance',
};

const TrucksTab: React.FC = () => {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editTruck, setEditTruck] = useState<Truck | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Truck | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [truckData, userData] = await Promise.all([
        trucksApi.getTrucks(),
        usersApi.getUsers(),
      ]);
      setTrucks(truckData);
      setDrivers(userData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await trucksApi.deleteTruck(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to delete truck');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setEditTruck(null); setFormOpen(true); }}
        >
          Add Truck
        </Button>
      </Box>

      <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead sx={{ bgcolor: '#f1f5f9' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>ID</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>License Plate</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Model</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Capacity</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Assigned Driver</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {trucks.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary">No trucks yet</Typography>
                </TableCell>
              </TableRow>
            )}
            {trucks.map((truck) => (
              <TableRow
                key={truck.id}
                sx={{ '&:last-child td, &:last-child th': { border: 0 }, '&:hover': { bgcolor: '#f8fafc' } }}
              >
                <TableCell>{truck.id}</TableCell>
                <TableCell>{truck.license_plate}</TableCell>
                <TableCell>{truck.model}</TableCell>
                <TableCell>{truck.capacity_bins != null ? truck.capacity_bins : 'No limit'}</TableCell>
                <TableCell>
                  <Chip
                    label={STATUS_LABEL[truck.status]}
                    color={STATUS_COLOR[truck.status]}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {truck.assigned_driver
                    ? `${truck.assigned_driver.full_name} (@${truck.assigned_driver.username})`
                    : <Typography variant="body2" color="text.secondary">Unassigned</Typography>
                  }
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => { setEditTruck(truck); setFormOpen(true); }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => setDeleteTarget(truck)}
                    >
                      Delete
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TruckFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        truck={editTruck}
        drivers={drivers}
        trucks={trucks}
      />

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Truck</DialogTitle>
        <DialogContent>
          Are you sure you want to delete truck <strong>{deleteTarget?.license_plate}</strong>?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TrucksTab;
