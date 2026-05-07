import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Box,
} from '@mui/material';
import { trucksApi } from '../../api/trucksApi';
import type { Truck, TruckCreate, TruckUpdate, TruckStatus } from '../../types/truck';
import type { User } from '../../types/auth';

interface TruckFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  truck?: Truck | null;
  drivers: User[];
  trucks: Truck[];
}

const STATUS_OPTIONS: { value: TruckStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'in_service', label: 'In Service' },
  { value: 'maintenance', label: 'Maintenance' },
];

const TruckFormDialog: React.FC<TruckFormDialogProps> = ({ open, onClose, onSaved, truck, drivers, trucks }) => {
  const isEdit = !!truck;

  const [licensePlate, setLicensePlate] = useState('');
  const [model, setModel] = useState('');
  const [capacityBins, setCapacityBins] = useState<string>('');
  const [status, setStatus] = useState<TruckStatus>('available');
  const [assignedDriverId, setAssignedDriverId] = useState<number | ''>('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLicensePlate(truck?.license_plate ?? '');
      setModel(truck?.model ?? '');
      setCapacityBins(truck?.capacity_bins != null ? String(truck.capacity_bins) : '');
      setStatus(truck?.status ?? 'available');
      setAssignedDriverId(truck?.assigned_driver_id ?? '');
      setError('');
    }
  }, [open, truck]);

  const handleSave = async () => {
    if (!licensePlate.trim()) { setError('License plate is required'); return; }
    if (!model.trim()) { setError('Model is required'); return; }

    setSaving(true);
    setError('');
    try {
      const capacityValue = capacityBins !== '' ? Number(capacityBins) : null;
      const driverId = assignedDriverId !== '' ? Number(assignedDriverId) : null;

      if (isEdit && truck) {
        const payload: TruckUpdate = {
          license_plate: licensePlate.trim(),
          model: model.trim(),
          capacity_bins: capacityValue,
          status,
          assigned_driver_id: driverId,
        };
        await trucksApi.updateTruck(truck.id, payload);
      } else {
        const payload: TruckCreate = {
          license_plate: licensePlate.trim(),
          model: model.trim(),
          capacity_bins: capacityValue,
          status,
          assigned_driver_id: driverId,
        };
        await trucksApi.createTruck(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save truck');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Edit Truck' : 'Add Truck'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="License Plate"
            value={licensePlate}
            onChange={(e) => setLicensePlate(e.target.value)}
            required
            inputProps={{ maxLength: 20 }}
          />
          <TextField
            label="Model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            required
            inputProps={{ maxLength: 100 }}
          />
          <TextField
            label="Capacity (bins, optional)"
            value={capacityBins}
            onChange={(e) => setCapacityBins(e.target.value.replace(/\D/g, ''))}
            type="number"
            inputProps={{ min: 1 }}
          />

          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={status}
              label="Status"
              onChange={(e) => setStatus(e.target.value as TruckStatus)}
            >
              {STATUS_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Assigned Driver (optional)</InputLabel>
            <Select
              value={assignedDriverId}
              label="Assigned Driver (optional)"
              onChange={(e) => setAssignedDriverId(e.target.value as number | '')}
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {(() => {
                const takenIds = new Set(
                  trucks
                    .filter((t) => t.assigned_driver_id != null && t.id !== truck?.id)
                    .map((t) => t.assigned_driver_id!)
                );
                return drivers
                  .filter((d) => d.role === 'truck_driver' && d.is_active && !takenIds.has(d.id))
                  .map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.full_name} (@{d.username})
                    </MenuItem>
                  ));
              })()}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TruckFormDialog;
