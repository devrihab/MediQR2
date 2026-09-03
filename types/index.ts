export type Role = 'patient' | 'doctor';

export interface Patient {
  id: string;
  name: string;
  email: string;
  blood_group: string;
  allergies: Allergy[];
  conditions: string[];
  medications: string[];
  prescriptions: Prescription[];
  emergency_contact: {
    name: string;
    phone: string;
    relation: string;
  };
  last_updated: string;
  data_source: string;
}

export interface Allergy {
  name: string;
  severity: 'mild' | 'moderate' | 'severe';
}

export interface PrescribedMedicine {
  name: string;
  dosage: string;
  frequency?: string;
}

export interface Prescription {
  date: string;
  prescribing_doctor: string;
  is_current?: boolean;
  medicines?: PrescribedMedicine[];
  // Legacy fields
  name?: string;
  dosage?: string;
}

export interface Doctor {
  id: string;
  name: string;
}

export type AccessRequestStatus = 'pending' | 'approved' | 'expired';

export interface AccessRequest {
  id: string;
  doctor_id: string;
  patient_id: string;
  status: AccessRequestStatus;
  otp_hash?: string;
  otp_code?: string; // Fallback
  created_at: string;
  resolved_at?: string;
  expires_at?: string;
  otp_consumed_at?: string;
}

export interface QR {
  patient_id: string;
  code_value: string;
  is_active: boolean;
}

export type AuditType = 'normal_view' | 'emergency_view' | 'request_expired' | 'edit_data';

export interface AuditLog {
  id: string;
  doctor_id?: string;
  patient_id: string;
  type: AuditType;
  reason?: string;
  timestamp: string;
  is_reported?: boolean;
}
