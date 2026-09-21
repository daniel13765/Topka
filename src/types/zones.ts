export type ZoneStatus = 'active' | 'inactive';

export interface Landmark {
  id: string;
  name: string;
}

export interface ManagerZone {
  id: string;
  name: string;
  status: ZoneStatus;
  managers: number;
  drivers: number;
  deliveryFee: number;
  managerName: string;
  description: string;
  landmarks: Landmark[];
  polygon: string;
  labelX: number;
  labelY: number;
}
