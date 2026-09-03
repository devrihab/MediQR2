import { AccessRequest, AuditLog, Patient, QR, Doctor } from '../../types';

export const DEMO_PATIENT_ID = '03ad499c-0c48-4832-8bbc-2779651a9a73';
export const LEGACY_DEMO_ID = '11111111-1111-1111-1111-111111111111';
export const DEMO_DOCTOR_ID = '22222222-2222-2222-2222-222222222222';

const RIHAB_PATIENT: Patient = {
  id: DEMO_PATIENT_ID,
  email: 'rihab@mediqr.app',
  name: 'Rihab KV',
  blood_group: 'O+',
  allergies: [
    { name: 'Penicillin', severity: 'severe' }
  ],
  conditions: ['Asthma (Mild)'],
  medications: ['Albuterol Inhaler (90mcg, As needed)'],
  prescriptions: [
    {
      name: 'Albuterol Inhaler',
      dosage: '90mcg (As needed)',
      date: '2026-02-15',
      prescribing_doctor: 'Dr. Sarah Adams',
      is_current: true
    }
  ],
  emergency_contact: {
    name: 'Family Contact',
    phone: '555-0199',
    relation: 'Family'
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
    [DEMO_PATIENT_ID, RIHAB_PATIENT],
    [LEGACY_DEMO_ID, { ...RIHAB_PATIENT, id: LEGACY_DEMO_ID }]
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
    }],
    [LEGACY_DEMO_ID, {
      patient_id: LEGACY_DEMO_ID,
      code_value: LEGACY_DEMO_ID,
      is_active: true
    }]
  ]);

  access_requests: AccessRequest[] = [];
  audit_logs: AuditLog[] = [];
  private listeners = new Set<() => void>();

  constructor() {
    this.patients.set(DEMO_PATIENT_ID, RIHAB_PATIENT);
    this.patients.set(LEGACY_DEMO_ID, { ...RIHAB_PATIENT, id: LEGACY_DEMO_ID });
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

  getLatestPatient(): Patient {
    const list = Array.from(this.patients.values());
    return list[list.length - 1] || RIHAB_PATIENT;
  }

  setPatient(patient: Patient) {
    this.patients.set(patient.id, patient);
    this.notifyChange();
  }
}

export const SHARED_DB = new SharedDatabase();
