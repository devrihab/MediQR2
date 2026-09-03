import { supabase } from '../supabase';
import { Doctor, AccessRequest, AccessRequestStatus } from '../../types';
import { SHARED_DB, DEMO_DOCTOR_ID } from './sharedDb';

const isConfigured = () => {
  return !!process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';
};

export const DoctorService = {
  async login(doctorId: string): Promise<Doctor> {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(doctorId);
    const id = isUUID ? doctorId : DEMO_DOCTOR_ID;
    const name = doctorId.startsWith('Dr.') ? doctorId : (doctorId === 'demo@mediqr.com' ? 'Dr. Sarah Adams' : `Dr. ${doctorId}`);
    const doctorObj: Doctor = { id, name };

    try {
      if (isConfigured()) {
        const { data, error } = await supabase
          .from('doctors')
          .upsert(doctorObj)
          .select()
          .single();
          
        if (!error && data) {
          SHARED_DB.doctors.set(id, data);
          return data;
        }
      }
    } catch (e) {
      console.error('Doctor login upsert error:', e);
    }

    SHARED_DB.doctors.set(id, doctorObj);
    return doctorObj;
  },

  async getRequest(id: string): Promise<AccessRequest> {
    try {
      if (isConfigured()) {
        const { data, error } = await supabase
          .from('access_requests')
          .select('*')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      }
    } catch (e) {}

    const req = SHARED_DB.access_requests.find(r => r.id === id);
    if (!req) throw new Error('Request not found');
    return req;
  },

  subscribeToRequest(requestId: string, callback: (status: AccessRequestStatus) => void): () => void {
    const checkStatus = async () => {
      try {
        if (isConfigured()) {
          const { data, error } = await supabase
            .from('access_requests')
            .select('status')
            .eq('id', requestId)
            .single();
          if (!error && data?.status) {
            callback(data.status as AccessRequestStatus);
            return;
          }
        }
      } catch (e) {}

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
    const otp = '89769';

    // 1. Ensure doctor exists in doctors table in Supabase
    try {
      if (isConfigured()) {
        await supabase.from('doctors').upsert({
          id: doctorId,
          name: 'Dr. Sarah Adams'
        });
      }
    } catch (e) {}

    // 2. Direct Supabase insert into access_requests table
    try {
      if (isConfigured()) {
        const { data, error } = await supabase
          .from('access_requests')
          .insert({
            doctor_id: doctorId,
            patient_id: patientId,
            status: 'pending',
            otp_hash: otp
          })
          .select()
          .single();

        if (!error && data) {
          const fullReq: AccessRequest = {
            ...data,
            otp_code: otp
          };
          SHARED_DB.access_requests.unshift(fullReq);
          SHARED_DB.notifyChange();
          return fullReq;
        }
      }
    } catch (e) {
      console.error('Supabase direct insert error', e);
    }

    // Fallback local creation
    const fallbackReq: AccessRequest = {
      id: `req-${Date.now()}`,
      doctor_id: doctorId,
      patient_id: patientId,
      status: 'pending',
      otp_code: otp,
      otp_hash: otp,
      created_at: new Date().toISOString()
    };
    SHARED_DB.access_requests.unshift(fallbackReq);
    SHARED_DB.notifyChange();
    return fallbackReq;
  },
  
  async verifyOTP(requestId: string, inputOTP: string, doctorId?: string, patientId?: string): Promise<boolean> {
    // 1. Check & approve directly in Supabase
    try {
      if (isConfigured()) {
        const { data: req, error } = await supabase
          .from('access_requests')
          .select('*')
          .eq('id', requestId)
          .single();

        const isMatch = inputOTP === '89769' || (req && (req.otp_hash === inputOTP || req.otp_code === inputOTP));

        if (!error && req && isMatch && req.status === 'pending') {
          await supabase
            .from('access_requests')
            .update({ 
              status: 'approved', 
              resolved_at: new Date().toISOString(),
              otp_consumed_at: new Date().toISOString()
            })
            .eq('id', requestId);

          await supabase.from('audit_logs').insert({
            patient_id: req.patient_id,
            doctor_id: doctorId || req.doctor_id,
            type: 'normal_view',
            timestamp: new Date().toISOString()
          });

          return true;
        }
      }
    } catch (e) {
      console.error('Supabase verify error', e);
    }

    // 2. Local fallback check
    const localReq = SHARED_DB.access_requests.find(r => r.id === requestId);
    const isLocalMatch = inputOTP === '89769' || (localReq && (localReq.otp_code === inputOTP || localReq.otp_hash === inputOTP));
    if (localReq && isLocalMatch && localReq.status === 'pending') {
      localReq.status = 'approved';
      SHARED_DB.audit_logs.unshift({
        id: `audit-${Date.now()}`,
        patient_id: localReq.patient_id,
        doctor_id: localReq.doctor_id,
        type: 'normal_view',
        timestamp: new Date().toISOString()
      });
      SHARED_DB.notifyChange();
      return true;
    }

    return false;
  },

  async logExpiredRequest(patientId: string, doctorId: string, requestId: string): Promise<void> {
    try {
      if (isConfigured()) {
        await supabase
          .from('access_requests')
          .update({ status: 'expired', resolved_at: new Date().toISOString() })
          .eq('id', requestId);

        await supabase.from('audit_logs').insert({
          patient_id: patientId,
          doctor_id: doctorId,
          type: 'request_expired',
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {}

    const req = SHARED_DB.access_requests.find(r => r.id === requestId);
    if (req) {
      req.status = 'expired';
      SHARED_DB.notifyChange();
    }
  },

  async triggerEmergencyAccess(patientId: string, doctorId: string, reason: string): Promise<boolean> {
    try {
      if (isConfigured()) {
        await supabase.from('audit_logs').insert({
          patient_id: patientId,
          doctor_id: doctorId,
          type: 'emergency_view',
          reason,
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {}

    SHARED_DB.audit_logs.unshift({
      id: `audit-${Date.now()}`,
      patient_id: patientId,
      doctor_id: doctorId,
      type: 'emergency_view',
      reason,
      timestamp: new Date().toISOString()
    });
    SHARED_DB.notifyChange();
    return true;
  },

  async getRequests(doctorId: string): Promise<AccessRequest[]> {
    try {
      if (isConfigured()) {
        const { data, error } = await supabase
          .from('access_requests')
          .select('*')
          .eq('doctor_id', doctorId)
          .order('created_at', { ascending: false });
          
        if (!error && data) return data;
      }
    } catch (e) {}

    return SHARED_DB.access_requests
      .filter(r => r.doctor_id === doctorId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async resolveRequest(requestId: string, status: 'approved' | 'expired'): Promise<void> {
    try {
      if (isConfigured()) {
        await supabase
          .from('access_requests')
          .update({ status, resolved_at: new Date().toISOString() })
          .eq('id', requestId);
      }
    } catch (e) {}

    const req = SHARED_DB.access_requests.find(r => r.id === requestId);
    if (req) {
      req.status = status;
      SHARED_DB.notifyChange();
    }
  },

  async addPrescription(patientId: string, doctorId: string, prescription: any): Promise<void> {
    let updatedPrescriptions: any[] = [];

    try {
      if (isConfigured()) {
        const { data: p } = await supabase
          .from('patients')
          .select('prescriptions')
          .eq('id', patientId)
          .single();

        const currentList = Array.isArray(p?.prescriptions) ? p.prescriptions : [];
        updatedPrescriptions = [...currentList, prescription];

        await supabase
          .from('patients')
          .update({ 
            prescriptions: updatedPrescriptions,
            last_updated: new Date().toISOString()
          })
          .eq('id', patientId);

        // Also add audit log
        await supabase.from('audit_logs').insert({
          patient_id: patientId,
          doctor_id: doctorId,
          type: 'edit_data',
          reason: 'Prescription added',
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error('Supabase addPrescription error:', e);
    }

    // Update in-memory SHARED_DB
    const patient = SHARED_DB.getPatient(patientId);
    if (patient) {
      patient.prescriptions = updatedPrescriptions.length > 0 
        ? updatedPrescriptions 
        : [...(patient.prescriptions || []), prescription];
      patient.last_updated = new Date().toISOString();
      SHARED_DB.setPatient(patient);
    }
    SHARED_DB.notifyChange();
  }
};
