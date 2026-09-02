import { supabase } from '../supabase';
import { Patient, AccessRequest, QR, AuditLog } from '../../types';
import * as SecureStore from 'expo-secure-store';

// In-memory fallback for Hackathon MVP when Supabase isn't configured
// DEMO CONFIGURATION
const DEMO_PATIENT_ID = '11111111-1111-1111-1111-111111111111';

const MEMORY_DB = {
  patients: new Map<string, Patient>([
    [DEMO_PATIENT_ID, {
      id: DEMO_PATIENT_ID,
      name: 'Alex Demo',
      email: 'patient@demo.com',
      blood_group: 'O+',
      allergies: [{ name: 'Penicillin', severity: 'severe' }],
      conditions: ['Asthma'],
      medications: ['Albuterol Inhaler'],
      prescriptions: [
        { name: 'Amoxicillin', dosage: '500mg', date: '2025-11-10', prescribing_doctor: 'Dr. Sarah Adams' },
        { name: 'Ibuprofen', dosage: '400mg', date: '2026-01-15', prescribing_doctor: 'Dr. Smith' }
      ],
      emergency_contact: { name: 'Sarah Demo', phone: '555-0199', relation: 'Spouse' },
      last_updated: new Date().toISOString(),
      data_source: 'self-reported'
    }]
  ]),
  qrs: new Map<string, QR>([
    [DEMO_PATIENT_ID, { patient_id: DEMO_PATIENT_ID, code_value: 'demo-qr-12345', is_active: true }]
  ]),
  audit_logs: [] as AuditLog[],
  access_requests: [] as AccessRequest[],
};

const isConfigured = () => {
  return process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';
};

// Helpers for persisting fallback data across app reloads
async function getLocalPatient(id: string): Promise<Patient | null> {
  if (MEMORY_DB.patients.has(id)) return MEMORY_DB.patients.get(id)!;
  try {
    const stored = await SecureStore.getItemAsync(`patient_${id}`);
    if (stored) {
      const p = JSON.parse(stored);
      MEMORY_DB.patients.set(id, p);
      return p;
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

async function setLocalPatient(id: string, patient: Patient) {
  MEMORY_DB.patients.set(id, patient);
  try {
    await SecureStore.setItemAsync(`patient_${id}`, JSON.stringify(patient));
  } catch (e) {
    console.error(e);
  }
}

export const PatientService = {
  async login(email: string, password: string): Promise<{ patient: Patient | null, isNew: boolean }> {
    // Deterministic fallback ID
    const id = email === 'patient@demo.com' 
      ? DEMO_PATIENT_ID 
      : `p-${email.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    try {
      if (!isConfigured()) throw new Error('Supabase not configured');
      
      let user = null;
      // Try real Supabase Auth
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      
      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          // Auto sign-up for hackathon MVP experience
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
          if (signUpError) throw signUpError;
          user = signUpData.user;
          if (!user) throw new Error("Signup failed");
        } else {
          throw signInError;
        }
      } else {
        user = signInData.user;
      }

      if (!user) throw new Error("Auth failed");

      // Use the real authenticated user's ID
      const patientId = user.id;
      
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (error && error.code === 'PGRST116') {
        return { patient: { id: patientId, email, name: '' } as Patient, isNew: true };
      }
      
      if (error) throw error;
      return { patient: data, isNew: false };
    } catch (e: any) {
      // Fallback for unconfigured/network issues
      const localP = await getLocalPatient(id);
      if (localP) {
        return { patient: localP, isNew: false };
      }
      return { patient: { id, email, name: '' } as Patient, isNew: true };
    }
  },

  async createPatient(patient: Omit<Patient, 'last_updated' | 'data_source'>): Promise<Patient> {
    const newPatient: Patient = {
      ...patient,
      data_source: 'self-reported',
      last_updated: new Date().toISOString(),
    };
    
    try {
      if (!isConfigured()) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase
        .from('patients')
        .insert(newPatient)
        .select()
        .single();
        
      if (error) throw error;
      await this.regenerateQR(patient.id);
      return data;
    } catch (e) {
      // Fallback
      await setLocalPatient(newPatient.id, newPatient);
      await this.regenerateQR(newPatient.id);
      return newPatient;
    }
  },

  async updatePatient(patient: Patient): Promise<Patient> {
    const updatedPatient = {
      ...patient,
      last_updated: new Date().toISOString(),
    };

    try {
      if (!isConfigured()) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase
        .from('patients')
        .update(updatedPatient)
        .eq('id', patient.id)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        patient_id: patient.id,
        type: 'edit_data',
        timestamp: new Date().toISOString()
      });

      return data;
    } catch (e) {
      // Fallback
      await setLocalPatient(updatedPatient.id, updatedPatient);
      MEMORY_DB.audit_logs.unshift({
        id: `audit-${Date.now()}`,
        patient_id: updatedPatient.id,
        type: 'edit_data',
        timestamp: new Date().toISOString()
      });
      return updatedPatient;
    }
  },

  async getPatientData(patientId: string): Promise<Patient> {
    try {
      if (!isConfigured()) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (error) throw error;
      return data;
    } catch (e) {
      const p = await getLocalPatient(patientId);
      if (p) return p;
      throw new Error('Patient not found');
    }
  },

  async getActiveQR(patientId: string): Promise<QR | null> {
    try {
      if (!isConfigured()) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase
        .from('qrs')
        .select('*')
        .eq('patient_id', patientId)
        .eq('is_active', true)
        .single();
        
      if (error && error.code === 'PGRST116') return null;
      if (error) throw error;
      return data;
    } catch (e) {
      const qrs = Array.from(MEMORY_DB.qrs.values());
      const active = qrs.find(q => q.patient_id === patientId && q.is_active);
      return active || null;
    }
  },

  async regenerateQR(patientId: string): Promise<QR> {
    const newQR: QR = {
      patient_id: patientId,
      code_value: `qr-${patientId}-${Date.now()}`,
      is_active: true
    };

    try {
      if (!isConfigured()) throw new Error('Supabase not configured');
      
      await supabase
        .from('qrs')
        .update({ is_active: false })
        .eq('patient_id', patientId)
        .eq('is_active', true);

      const { data, error } = await supabase
        .from('qrs')
        .insert(newQR)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (e) {
      // Invalidate old in memory
      for (const [k, v] of MEMORY_DB.qrs.entries()) {
        if (v.patient_id === patientId && v.is_active) {
          MEMORY_DB.qrs.set(k, { ...v, is_active: false });
        }
      }
      MEMORY_DB.qrs.set(newQR.code_value, newQR);
      return newQR;
    }
  },

  async getAccessHistory(patientId: string): Promise<AuditLog[]> {
    try {
      if (!isConfigured()) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('patient_id', patientId)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (e) {
      return MEMORY_DB.audit_logs.filter(l => l.patient_id === patientId);
    }
  },

  async getPendingRequests(patientId: string): Promise<AccessRequest[]> {
    try {
      if (!isConfigured()) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase
        .from('access_requests')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'pending');

      if (error) throw error;
      return data || [];
    } catch (e) {
      return MEMORY_DB.access_requests?.filter(r => r.patient_id === patientId && r.status === 'pending') || [];
    }
  },

  subscribeToPendingRequests(patientId: string, callback: () => void): () => void {
    if (!isConfigured()) {
      const interval = setInterval(() => callback(), 2000);
      return () => clearInterval(interval);
    }
    
    const channel = supabase.channel(`pending_reqs_${patientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'access_requests', filter: `patient_id=eq.${patientId}` }, 
        () => callback()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToHistory(patientId: string, callback: () => void): () => void {
    if (!isConfigured()) return () => {};
    
    const channel = supabase.channel(`hist_${patientId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs', filter: `patient_id=eq.${patientId}` }, 
        () => callback()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  async reportAccess(auditId: string): Promise<void> {
    try {
      if (!isConfigured()) throw new Error('Supabase not configured');
      
      const { error } = await supabase
        .from('audit_logs')
        .update({ is_reported: true })
        .eq('id', auditId);
        
      if (error) throw error;
    } catch (e) {
      const idx = MEMORY_DB.audit_logs.findIndex(l => l.id === auditId);
      if (idx !== -1) {
        MEMORY_DB.audit_logs[idx].is_reported = true;
      }
    }
  }
};
