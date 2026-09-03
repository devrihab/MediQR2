import { AccessRequest, AuditLog, Patient, QR, Doctor } from '../../types';

export const DEMO_PATIENT_ID = '11111111-1111-1111-1111-111111111111';
export const DEMO_DOCTOR_ID = '22222222-2222-2222-2222-222222222222';

const DEFAULT_PATIENT: Patient = {
  id: DEMO_PATIENT_ID,
  email: 'alex.rivera@example.com',
  name: 'Alex Rivera',
  blood_group: 'O+',
  allergies: [
    { name: 'Penicillin', severity: 'severe' },
    { name: 'Peanuts', severity: 'moderate' }
  ],
  conditions: ['Asthma (Mild)', 'Hypertension'],
  medications: ['Albuterol Inhaler (90mcg, As needed)', 'Lisinopril (10mg, Daily)'],
  prescriptions: [
    {
      name: 'Albuterol Inhaler',
      dosage: '90mcg (As needed)',
      date: '2026-02-15',
      prescribing_doctor: 'Dr. Sarah Adams',
      is_current: false
    }
  ],
  emergency_contact: {
    name: 'Sarah Rivera',
    phone: '555-0199',
    relation: 'Spouse'
  },
  last_updated: new Date().toISOString(),
  data_source: 'self-reported'
};

const DEFAULT_DOCTOR: Doctor = {
  id: DEMO_DOCTOR_ID,
  name: 'Dr. Sarah Adams'
};

class SharedDatabase {
  patients = new Map<string, Patient>([
    [DEMO_PATIENT_ID, DEFAULT_PATIENT],
  ]);

  doctors = new Map<string, Doctor>([
    [DEMO_DOCTOR_ID, DEFAULT_DOCTOR],
    ['demo@mediqr.com', DEFAULT_DOCTOR]
  ]);

  qrs = new Map<string, QR>([
    [DEMO_PATIENT_ID, {
      patient_id: DEMO_PATIENT_ID,
      code_value: DEMO_PATIENT_ID,
      is_active: true
    }]
  ]);

  access_requests: AccessRequest[] = [];
  audit_logs: AuditLog[] = [];
  private listeners = new Set<() => void>();

  constructor() {
    // Seed default patient
    this.patients.set(DEMO_PATIENT_ID, DEFAULT_PATIENT);
  }

  notifyChange() {
    this.listeners.forEach(cb => {
      try { cb(); } catch (e) { console.error('Listener error:', e); }
    });
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  getPatient(id: string): Patient | undefined {
    return this.patients.get(id);
  }

  setPatient(patient: Patient) {
    this.patients.set(patient.id, patient);
    this.notifyChange();
  }
}

export const SHARED_DB = new SharedDatabase();
