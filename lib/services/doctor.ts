import { supabase } from '../supabase';
import { Doctor, AccessRequest, AccessRequestStatus } from '../../types';
import { SHARED_DB, DEMO_DOCTOR_ID } from './sharedDb';

const isConfigured = () => {
  return process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';
};

export const DoctorService = {
  async login(doctorId: string): Promise<Doctor> {
    try {
      if (!isConfigured()) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('id', doctorId)
        .single();
        
      if (error && error.code === 'PGRST116') {
        const id = doctorId === 'demo@mediqr.com' ? DEMO_DOCTOR_ID : doctorId;
        const newDoctor = { id, name: `Dr. ${id.substring(0, 4)}` };
        await supabase.from('doctors').insert(newDoctor);
        SHARED_DB.doctors.set(id, newDoctor);
        return newDoctor;
      }
      if (error) throw error;
      SHARED_DB.doctors.set(data.id, data);
      return data;
    } catch (e) {
      if (SHARED_DB.doctors.has(doctorId)) {
        return SHARED_DB.doctors.get(doctorId)!;
      }
      
      const id = doctorId === 'demo@mediqr.com' ? DEMO_DOCTOR_ID : doctorId;
      const doc = { id, name: 'Dr. ' + id.split('-')[0] };
      SHARED_DB.doctors.set(id, doc);
      return doc;
    }
  },

  async getRequest(id: string): Promise<AccessRequest> {
    try {
      if (!isConfigured()) throw new Error('Supabase not configured');
      const { data, error } = await supabase.from('access_requests').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    } catch (e) {
      const req = SHARED_DB.access_requests.find(r => r.id === id);
      if (!req) throw new Error('Request not found');
      return req;
    }
  },

  subscribeToRequest(requestId: string, callback: (status: AccessRequestStatus) => void): () => void {
    const checkStatus = () => {
      const req = SHARED_DB.access_requests.find(r => r.id === requestId);
      if (req) callback(req.status);
    };

    const unsubShared = SHARED_DB.subscribe(checkStatus);
    const interval = setInterval(checkStatus, 1500);

    let unsubSupabase = () => {};
    try {
      if (isConfigured()) {
        const channel = supabase.channel(`req_${requestId}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'access_requests', filter: `id=eq.${requestId}` }, 
            payload => callback(payload.new.status)
          )
          .subscribe();
        unsubSupabase = () => { supabase.removeChannel(channel); };
      }
    } catch (err) {}

    return () => {
      unsubShared();
      clearInterval(interval);
      unsubSupabase();
    };
  },

  async requestAccess(patientId: string, doctorId: string): Promise<AccessRequest> {
    const otp = Math.floor(10000 + Math.random() * 90000).toString();
    const fallbackReq: AccessRequest = {
      id: `req-${Date.now()}`,
      doctor_id: doctorId,
      patient_id: patientId,
      status: 'pending',
      otp_code: otp,
      otp_hash: otp,
      created_at: new Date().toISOString()
    };

    // Always store in shared DB first for instantaneous local & demo response
    SHARED_DB.access_requests.unshift(fallbackReq);
    SHARED_DB.notifyChange();

    try {
      if (!isConfigured()) return fallbackReq;
      
      const { data, error } = await supabase.functions.invoke('request-access', {
        body: { patientId, doctorId }
      });
        
      if (error) throw error;
      return data.request;
    } catch (e) {
      return fallbackReq;
    }
  },
  
  async verifyOTP(requestId: string, inputOTP: string, doctorId?: string, patientId?: string): Promise<boolean> {
    const req = SHARED_DB.access_requests.find(r => r.id === requestId);
    if (req && (req.otp_code === inputOTP || req.otp_hash === inputOTP) && req.status === 'pending') {
      req.status = 'approved';
      SHARED_DB.audit_logs.unshift({
        id: `audit-${Date.now()}`,
        patient_id: req.patient_id,
        doctor_id: req.doctor_id,
        type: 'normal_view',
        timestamp: new Date().toISOString()
      });
      SHARED_DB.notifyChange();
      return true;
    }

    try {
      if (!isConfigured()) return false;
      
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { requestId, doctorId, patientId, otpInput: inputOTP }
      });
        
      if (error) throw new Error('Verification failed');
      return true;
    } catch (e) {
      return false;
    }
  },

  async logExpiredRequest(patientId: string, doctorId: string, requestId: string): Promise<void> {
    const req = SHARED_DB.access_requests.find(r => r.id === requestId);
    if (req) {
      req.status = 'expired';
      SHARED_DB.audit_logs.unshift({
        id: `audit-${Date.now()}`,
        patient_id: patientId,
        doctor_id: doctorId,
        type: 'request_expired',
        timestamp: new Date().toISOString()
      });
      SHARED_DB.notifyChange();
    }

    try {
      if (!isConfigured()) return;
      await supabase.functions.invoke('expire-request', {
        body: { requestId, doctorId, patientId }
      });
    } catch (e) {}
  },

  async triggerEmergencyAccess(patientId: string, doctorId: string, reason: string): Promise<boolean> {
    SHARED_DB.audit_logs.unshift({
      id: `audit-${Date.now()}`,
      patient_id: patientId,
      doctor_id: doctorId,
      type: 'emergency_view',
      reason,
      timestamp: new Date().toISOString()
    });
    SHARED_DB.notifyChange();

    try {
      if (!isConfigured()) return true;
      
      const { error } = await supabase.functions.invoke('emergency-access', {
        body: { patientId, doctorId, reason }
      });
      
      if (error) throw error;
      return true;
    } catch (e) {
      return true;
    }
  },

  async getRequests(doctorId: string): Promise<AccessRequest[]> {
    try {
      if (!isConfigured()) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase
        .from('access_requests')
        .select('*')
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data || [];
    } catch (e) {
      return SHARED_DB.access_requests
        .filter(r => r.doctor_id === doctorId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  },

  async resolveRequest(requestId: string, status: 'approved' | 'expired'): Promise<void> {
    const req = SHARED_DB.access_requests.find(r => r.id === requestId);
    if (req) {
      req.status = status;
      SHARED_DB.notifyChange();
    }

    try {
      if (!isConfigured()) return;
      
      const { error } = await supabase
        .from('access_requests')
        .update({ status, resolved_at: new Date().toISOString() })
        .eq('id', requestId);
        
      if (error) throw error;
    } catch (e) {}
  },

  async addPrescription(patientId: string, doctorId: string, prescription: any): Promise<void> {
    const patient = SHARED_DB.getPatient(patientId);
    if (patient) {
      patient.prescriptions = [...(patient.prescriptions || []), prescription];
      SHARED_DB.notifyChange();
    }

    try {
      if (!isConfigured()) return;
      
      const { error } = await supabase.rpc('add_prescription', {
        target_patient_id: patientId,
        new_prescription: prescription
      });
      
      if (error) throw error;
    } catch (e) {
      import('./patient').then(({ PatientService }) => {
        PatientService.getPatientData(patientId).then(p => {
          const updated = {
            ...p,
            prescriptions: [...(p.prescriptions || []), prescription]
          };
          PatientService.updatePatient(updated).catch(console.error);
        }).catch(console.error);
      }).catch(console.error);
    }
  }
};
