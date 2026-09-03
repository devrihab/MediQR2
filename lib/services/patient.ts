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

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const PatientService = {
  async login(email: string, password: string): Promise<{ patient: Patient | null, isNew: boolean }> {
    const cleanEmail = email.toLowerCase().trim();

    // 1. Direct email lookup in Supabase patients table
    try {
      if (isConfigured()) {
        const { data: existingByEmail, error: emailErr } = await supabase
          .from('patients')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (!emailErr && existingByEmail) {
          SHARED_DB.setPatient(existingByEmail);
          await setLocalPatient(existingByEmail.id, existingByEmail);
          return { patient: existingByEmail, isNew: false };
        }
      }
    } catch (e) {}

    // 2. Try Supabase Auth
    let patientId = generateUUID();
    try {
      if (isConfigured()) {
        let user = null;
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        
        if (signInError) {
          const { data: signUpData } = await supabase.auth.signUp({ email: cleanEmail, password });
          if (signUpData?.user) {
            user = signUpData.user;
          }
        } else {
          user = signInData?.user;
        }

        if (user?.id) {
          patientId = user.id;
          const { data: existingById } = await supabase
            .from('patients')
            .select('*')
            .eq('id', patientId)
            .maybeSingle();

          if (existingById) {
            SHARED_DB.setPatient(existingById);
            await setLocalPatient(existingById.id, existingById);
            return { patient: existingById, isNew: false };
          }
        }
      }
    } catch (e) {}

    // 3. Check local patient cache
    const localP = await getLocalPatient(patientId);
    if (localP) {
      return { patient: localP, isNew: false };
    }

    // 4. Return new patient with valid UUID
    const newP: Patient = { 
      id: patientId, 
      email: cleanEmail, 
      name: '',
      blood_group: '',
      allergies: [],
      conditions: [],
      medications: [],
      prescriptions: [],
      emergency_contact: { name: '', phone: '', relation: '' },
      last_updated: new Date().toISOString(),
      data_source: 'self-reported'
    };
    return { patient: newP, isNew: true };
  },

  async createPatient(patient: Omit<Patient, 'last_updated' | 'data_source'>): Promise<Patient> {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patient.id);
    const validId = isUUID ? patient.id : generateUUID();

    const newPatient: Patient = {
      ...patient,
      id: validId,
      data_source: 'self-reported',
      last_updated: new Date().toISOString(),
    };
    
    await setLocalPatient(newPatient.id, newPatient);
    SHARED_DB.setPatient(newPatient);

    try {
      if (isConfigured()) {
        const { data, error } = await supabase
          .from('patients')
          .upsert(newPatient)
          .select()
          .single();
          
        if (!error && data) {
          // Log QR into Supabase qrs table
          await supabase.from('qrs').upsert({
            patient_id: data.id,
            code_value: data.id,
            is_active: true
          });

          // Log registration in audit_logs
          await supabase.from('audit_logs').insert({
            patient_id: data.id,
            type: 'edit_data',
            reason: 'Account profile registered',
            timestamp: new Date().toISOString()
          });

          return data;
        } else if (error) {
          console.error('Supabase patient upsert error:', error);
        }
      }
    } catch (e) {
      console.error('Supabase createPatient error:', e);
    }

    await this.regenerateQR(newPatient.id);
    return newPatient;
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
    const interval = setInterval(callback, 1500);

    let unsubSupabase = () => {};
    try {
      if (isConfigured()) {
        const channel = supabase.channel(`hist_${patientId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, 
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
