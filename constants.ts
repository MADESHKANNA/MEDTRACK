
import { Bed, BedStatus, Department, OccupancyLog, DischargedPatient } from './types';

export const INITIAL_BEDS: Bed[] = [
  { 
    id: '1', 
    number: 'ER-101', 
    department: Department.EMERGENCY, 
    status: BedStatus.OCCUPIED, 
    dailyRate: 1500,
    patient: {
      id: 'P-1001',
      name: 'John Doe',
      diagnosis: 'Acute Appendicitis',
      medications: ['Ceftriaxone', 'Metronidazole', 'Paracetamol'],
      admissionDate: '2023-10-24',
      currentBill: 4500
    }
  },
  { id: '2', number: 'ER-102', department: Department.EMERGENCY, status: BedStatus.AVAILABLE, dailyRate: 1200 },
  { 
    id: '3', 
    number: 'ICU-201', 
    department: Department.ICU, 
    status: BedStatus.OCCUPIED, 
    dailyRate: 5000,
    patient: {
      id: 'P-1002',
      name: 'Jane Smith',
      diagnosis: 'Respiratory Distress',
      medications: ['Albuterol', 'Dexamethasone'],
      admissionDate: '2023-10-22',
      currentBill: 15000
    }
  },
  { id: '4', number: 'ICU-202', department: Department.ICU, status: BedStatus.MAINTENANCE, dailyRate: 5000 },
  { id: '5', number: 'GW-301', department: Department.GENERAL, status: BedStatus.AVAILABLE, dailyRate: 800 },
  { 
    id: '6', 
    number: 'GW-302', 
    department: Department.GENERAL, 
    status: BedStatus.OCCUPIED, 
    dailyRate: 800,
    patient: {
      id: 'P-1003',
      name: 'Robert Brown',
      diagnosis: 'Fractured Femur',
      medications: ['Morphine', 'Enoxaparin'],
      admissionDate: '2023-10-23',
      currentBill: 2400
    }
  },
  { id: '7', number: 'PED-401', department: Department.PEDIATRICS, status: BedStatus.CLEANING, dailyRate: 1000 },
  { id: '8', number: 'PED-402', department: Department.PEDIATRICS, status: BedStatus.AVAILABLE, dailyRate: 1000 },
  { 
    id: '9', 
    number: 'SUR-501', 
    department: Department.SURGERY, 
    status: BedStatus.OCCUPIED, 
    dailyRate: 3500,
    patient: {
      id: 'P-1004',
      name: 'Alice Wilson',
      diagnosis: 'Cholecystectomy',
      medications: ['Ketorolac', 'Ondansetron'],
      admissionDate: '2023-10-25',
      currentBill: 3500
    }
  },
  { id: '10', number: 'SUR-502', department: Department.SURGERY, status: BedStatus.AVAILABLE, dailyRate: 3500 },
];

export const MOCK_HISTORY: OccupancyLog[] = [
  { timestamp: 'Oct 20', occupied: 5, available: 7, total: 12, revenue: 42000 },
  { timestamp: 'Oct 21', occupied: 7, available: 5, total: 12, revenue: 58000 },
  { timestamp: 'Oct 22', occupied: 9, available: 3, total: 12, revenue: 35000 },
  { timestamp: 'Oct 23', occupied: 8, available: 4, total: 12, revenue: 72000 },
  { timestamp: 'Oct 24', occupied: 10, available: 2, total: 12, revenue: 95000 },
  { timestamp: 'Oct 25', occupied: 6, available: 6, total: 12, revenue: 120000 },
  { timestamp: 'Oct 26', occupied: 11, available: 1, total: 12, revenue: 145000 },
];

export const MOCK_DISCHARGE_HISTORY: DischargedPatient[] = [
  {
    id: 'P-8801',
    name: 'Sarah Jenkins',
    diagnosis: 'Post-Op Recovery',
    medications: ['Oxycodone', 'Docusate'],
    admissionDate: '2023-10-18',
    dischargeDate: '2023-10-25',
    currentBill: 28500,
    dischargeSummary: "Patient recovered well after abdominal surgery. No complications noted during the 7-day stay.",
    stayDuration: 7
  },
  {
    id: 'P-8802',
    name: 'Michael Scott',
    diagnosis: 'Severe Burn',
    medications: ['Silver Sulfadiazine', 'Morphine'],
    admissionDate: '2023-10-15',
    dischargeDate: '2023-10-24',
    currentBill: 52000,
    dischargeSummary: "Successfully treated for 2nd-degree burns. Skin grafts stable. Advised 2 weeks outpatient care.",
    stayDuration: 9
  }
];
