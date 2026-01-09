
export enum BedStatus {
  AVAILABLE = 'Available',
  OCCUPIED = 'Occupied',
  CLEANING = 'Cleaning',
  MAINTENANCE = 'Maintenance'
}

export enum Department {
  EMERGENCY = 'Emergency',
  ICU = 'ICU',
  GENERAL = 'General Ward',
  PEDIATRICS = 'Pediatrics',
  SURGERY = 'Surgery'
}

export interface Patient {
  id: string;
  name: string;
  diagnosis: string;
  medications: string[];
  admissionDate: string;
  currentBill: number;
}

export interface DischargedPatient extends Patient {
  dischargeDate: string;
  dischargeSummary?: string;
  stayDuration?: number; // days
}

export interface Bed {
  id: string;
  number: string;
  department: Department;
  status: BedStatus;
  patient?: Patient;
  dailyRate: number;
  lastCleaned?: string;
}

export interface OccupancyLog {
  timestamp: string;
  occupied: number;
  available: number;
  total: number;
  revenue: number; // Profit collected from discharges
}

export interface ReportInsight {
  title: string;
  content: string;
  recommendation: string;
  priority: 'Low' | 'Medium' | 'High';
}

export type UserRole = 'Admin' | 'Staff';

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  fullName: string;
}
