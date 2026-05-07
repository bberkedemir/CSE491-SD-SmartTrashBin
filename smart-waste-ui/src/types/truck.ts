export type TruckStatus = "available" | "in_service" | "maintenance";

export interface TruckDriver {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface Truck {
  id: number;
  license_plate: string;
  model: string;
  capacity_bins: number | null;
  status: TruckStatus;
  assigned_driver_id: number | null;
  assigned_driver: TruckDriver | null;
}

export interface TruckCreate {
  license_plate: string;
  model: string;
  capacity_bins?: number | null;
  status?: TruckStatus;
  assigned_driver_id?: number | null;
}

export interface TruckUpdate {
  license_plate?: string;
  model?: string;
  capacity_bins?: number | null;
  status?: TruckStatus;
  assigned_driver_id?: number | null;
}
