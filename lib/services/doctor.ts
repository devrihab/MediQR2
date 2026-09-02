import { supabase } from '../supabase';
import { Doctor, AccessRequest } from '../../types';

const isConfigured = () => {
  return process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';
};

// DEMO CONFIGURATION
const DEMO_DOCTOR_ID = '22222222-2222-2222-2222-222222222222';

const MEMORY_DB = {
  doctors: new Map<string, Doctor>([
    [DEMO_DOCTOR_ID, { id: DEMO_DOCTOR_ID, name: 'Dr. Smith' }]
  ]),
  access_requests: [] as AccessRequest[],
  audit_logs: [] as any[],
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
        return newDoctor;
      }
      if (error) throw error;
      return data;
    } catch (e) {
      // Offline Demo Fallback
      if (MEMORY_DB.doctors.has(doctorId)) {
        return MEMORY_DB.doctors.get(doctorId)!;
      }
      
      const id = doctorId === 'demo@mediqr.com' ? DEMO_DOCTOR_ID : doctorId;
      const doc = { id, name: 'Dr. ' + id.split('-')[0] };
      MEMORY_DB.doctors.set(id, doc);
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
      const req = MEMORY_DB.access_requests.find(r => r.id === id);
      if (!req) throw new Error('Request not found');
      return req;
    }
  },

  subscribeToRequest(id: string, callback: (status: 'pending' | 'approved' | 'expired') => void): () => void {
    if (!isConfigured()) {
      const interval = setInterval(() => {
        const req = MEMORY_DB.access_requests.find(r => r.id === id);
        if (req && req.status !== 'pending') callback(req.status);
      }, 2000);
      return () => clearInterval(interval);
    }

    const channel = supabase.channel(`req_${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'access_requests', filter: `id=eq.${id}` }, 
        (payload) => {
          callback(payload.new.status);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  async requestAccess(patientId: string, doctorId: string): Promise<AccessRequest> {
    try {
      if (!isConfigured()) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase.functions.invoke('request-access', {
        body: { patientId, doctorId }
      });
        
      if (error) throw error;
      return data.request;
    } catch (e) {
      // Local fallback generation
      const otp = Math.floor(10000 + Math.random() * 90000).toString();
      
      // MVP Demo console log fallback
      console.log(`\n\n[HACKATHON MVP BACKUP] 🚨 EMAIL SIMULATION DELAYED 🚨`);
      console.log(`Generated OTP for patient ${patientId}: ${otp}\n\n`);
      
      const fallbackReq: AccessRequest = {
        id: `req-${Date.now()}`,
        doctor_id: doctorId,
        patient_id: patientId,
        status: 'pending',
        otp_code: otp,
        created_at: new Date().toISOString()
      };
      MEMORY_DB.access_requests.push(fallbackReq);

      return fallbackReq;
    }
  },
  
  async verifyOTP(requestId: string, inputOTP: string, doctorId?: string, patientId?: string): Promise<boolean> {
    try {
      if (!isConfigured()) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { requestId, doctorId, patientId, otpInput: inputOTP }
      });
        
      if (error) throw new Error('Verification failed');
      return true;
    } catch (e) {
      const req = MEMORY_DB.access_requests.find(r => r.id === requestId);
      if (req && req.otp_code === inputOTP && req.status === 'pending') {
        req.status = 'approved';
        MEMORY_DB.audit_logs.unshift({
          id: `audit-${Date.now()}`,
          patient_id: req.patient_id,
          doctor_id: req.doctor_id,
          type: 'normal_view',
          timestamp: new Date().toISOString()
        });
        return true;
      }
      return false;
    }
  },

  async logExpiredRequest(patientId: string, doctorId: string, requestId: string): Promise<void> {
    try {
      if (!isConfigured()) throw new Error('Supabase not configured');
      await supabase.functions.invoke('expire-request', {
        body: { requestId, doctorId, patientId }
      });
    } catch (e) {
      MEMORY_DB.audit_logs.unshift({
        id: `audit-${Date.now()}`,
        patient_id: patientId,
        doctor_id: doctorId,
        type: 'request_expired',
        timestamp: new Date().toISOString()
      });
    }
  },

  async triggerEmergencyAccess(patientId: string, doctorId: string, reason: string): Promise<boolean> {
    try {
      if (!isConfigured()) throw new Error('Supabase not configured');
      
      const { error } = await supabase.functions.invoke('emergency-access', {
        body: { patientId, doctorId, reason }
      });
      
      if (error) throw error;
      return true;
    } catch (e) {
      MEMORY_DB.audit_logs.unshift({
        id: `audit-${Date.now()}`,
        patient_id: patientId,
        doctor_id: doctorId,
        type: 'emergency_view',
        reason,
        timestamp: new Date().toISOString()
      });
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
      return MEMORY_DB.access_requests
        .filter(r => r.doctor_id === doctorId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  },

  async resolveRequest(requestId: string, status: 'approved' | 'expired'): Promise<void> {
    try {
      if (!isConfigured()) throw new Error('Supabase not configured');
      
      const { error } = await supabase
        .from('access_requests')
        .update({ status, resolved_at: new Date().toISOString() })
        .eq('id', requestId);
        
      if (error) throw error;
    } catch (e) {
      const reqIndex = MEMORY_DB.access_requests.findIndex(r => r.id === requestId);
      if (reqIndex !== -1) {
        MEMORY_DB.access_requests[reqIndex] = {
          ...MEMORY_DB.access_requests[reqIndex],
          status,
          resolved_at: new Date().toISOString()
        };
      }
    }
  }
};
