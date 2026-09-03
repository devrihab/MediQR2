import { supabase } from '../supabase';
import { Patient, AccessRequest, QR, AuditLog } from '../../types';
import * as SecureStore from 'expo-secure-store';
import { SHARED_DB, DEMO_PATIENT_ID } from './sharedDb';

const isConfigured = () => {
  return process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';
};

// Helpers for persisting fallback data across app reloads
async function getLocalPatient(id: string): Promise<Patient | null> {
  const inMem = SHARED_DB.getPatient(id);
  if (inMem) return inMem;

  try {
    const stored = await SecureStore.getItemAsync(`patient_${id}`);
    if (stored) {
      const p = JSON.parse(stored);
      SHARED_DB.setPatient(p);
      return p;
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

async function setLocalPatient(id: string, patient: Patient) {
  SHARED_DB.setPatient(patient);
  try {
    await SecureStore.setItemAsync(`patient_${id}`, JSON.stringify(patient));
  } catch (e) {
    console.error(e);
  }
}

export const PatientService = {
  async login(email: string, password: string): Promise<{ patient: Patient | null, isNew: boolean }> {
    const id = email === 'patient@demo.com' 
      ? DEMO_PATIENT_ID 
      : `p-${email.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    try {
      if (!isConfigured()) throw new Error('Supabase not configured');
      
      let user = null;
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      
      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
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
      SHARED_DB.setPatient(data);
      return { patient: data, isNew: false };
    } catch (e: any) {
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
    
    await setLocalPatient(newPatient.id, newPatient);
    await this.regenerateQR(newPatient.id);

    try {
      if (!isConfigured()) return newPatient;
      
      const { data, error } = await supabase
        .from('patients')
        .insert(newPatient)
        .select()
        .single();
        
      if (error) return newPatient;
      return data;
    } catch (e) {
      return newPatient;
    }
  },

  async updatePatient(patient: Patient): Promise<Patient> {
    const updatedPatient = {
      ...patient,
      last_updated: new Date().toISOString(),
    };

    await setLocalPatient(updatedPatient.id, updatedPatient);

    SHARED_DB.audit_logs.unshift({
      id: `audit-${Date.now()}`,
      patient_id: updatedPatient.id,
      type: 'edit_data',
      timestamp: new Date().toISOString()
    });
    SHARED_DB.notifyChange();

    try {
      if (!isConfigured()) return updatedPatient;
      
      const { data, error } = await supabase
        .from('patients')
        .update(updatedPatient)
        .eq('id', patient.id)
        .select()
        .single();

      if (error) return updatedPatient;

      await supabase.from('audit_logs').insert({
        patient_id: patient.id,
        type: 'edit_data',
        timestamp: new Date().toISOString()
      });

      return data;
    } catch (e) {
      return updatedPatient;
    }
  },

  async getPatientData(patientId: string): Promise<Patient> {
    try {
      if (isConfigured()) {
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('id', patientId)
          .single();

        if (!error && data) {
          SHARED_DB.setPatient(data);
          return data;
        }
      }
    } catch (e) {}

    const inMem = SHARED_DB.getPatient(patientId);
    if (inMem) return inMem;

    const local = await getLocalPatient(patientId);
    if (local) return local;

    const fallbackP: Patient = {
      id: patientId,
      name: 'Rihab KV',
      email: 'kvrihab@gmail.com',
      blood_group: 'A+',
      allergies: [],
      conditions: ['Color blindness'],
      medications: [],
      prescriptions: [],
      emergency_contact: {
        name: 'Afnan',
        phone: '+916282374857',
        relation: 'Contact'
      },
      last_updated: new Date().toISOString(),
      data_source: 'self-reported'
    };
    SHARED_DB.setPatient(fallbackP);
    return fallbackP;
  },

  async getActiveQR(patientId: string): Promise<QR | null> {
    const existing = SHARED_DB.qrs.get(patientId);
    if (existing && existing.is_active) return existing;

    try {
      if (!isConfigured()) return existing || null;
      
      const { data, error } = await supabase
        .from('qrs')
        .select('*')
        .eq('patient_id', patientId)
        .eq('is_active', true)
        .single();
        
      if (error && error.code === 'PGRST116') return existing || null;
      if (error) return existing || null;
      return data;
    } catch (e) {
      return existing || null;
    }
  },

  async regenerateQR(patientId: string): Promise<QR> {
    const newQR: QR = {
      patient_id: patientId,
      code_value: patientId,
      is_active: true
    };

    SHARED_DB.qrs.set(patientId, newQR);
    SHARED_DB.notifyChange();

    try {
      if (!isConfigured()) return newQR;
      
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

      if (error) return newQR;
      return data;
    } catch (e) {
      return newQR;
    }
  },

  async getAccessHistory(patientId: string): Promise<AuditLog[]> {
    const localLogs = SHARED_DB.audit_logs.filter(l => l.patient_id === patientId);
    try {
      if (!isConfigured()) return localLogs;
      
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('patient_id', patientId)
        .order('timestamp', { ascending: false });

      if (error) return localLogs;
      return data && data.length > 0 ? data : localLogs;
    } catch (e) {
      return localLogs;
    }
  },

  async getPendingRequests(patientId: string): Promise<AccessRequest[]> {
    try {
      if (isConfigured()) {
        const { data, error } = await supabase
          .from('access_requests')
          .select('*')
          .eq('patient_id', patientId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data;
        }
      }
    } catch (e) {}

    return SHARED_DB.access_requests.filter(
      r => r.patient_id === patientId && r.status === 'pending'
    );
  },

  subscribeToPendingRequests(patientId: string, callback: () => void): () => void {
    const unsubShared = SHARED_DB.subscribe(callback);
    const interval = setInterval(callback, 1000);

    let unsubSupabase = () => {};
    try {
      if (isConfigured()) {
        const channel = supabase.channel(`pending_reqs_${patientId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'access_requests' }, 
            () => callback()
          )
          .subscribe();
        unsubSupabase = () => { supabase.removeChannel(channel); };
      }
    } catch (e) {}

    return () => {
      unsubShared();
      clearInterval(interval);
      unsubSupabase();
    };
  },

  subscribeToHistory(patientId: string, callback: () => void): () => void {
    const unsubShared = SHARED_DB.subscribe(callback);

    let unsubSupabase = () => {};
    try {
      if (isConfigured()) {
        const channel = supabase.channel(`hist_${patientId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs', filter: `patient_id=eq.${patientId}` }, 
            () => callback()
          )
          .subscribe();
        unsubSupabase = () => { supabase.removeChannel(channel); };
      }
    } catch (e) {}

    return () => {
      unsubShared();
      unsubSupabase();
    };
  },

  async reportAccess(auditId: string): Promise<void> {
    try {
      if (!isConfigured()) return;
      
      const { error } = await supabase
        .from('audit_logs')
        .update({ is_reported: true })
        .eq('id', auditId);

      if (error) throw error;
    } catch (e) {}
  }
};
