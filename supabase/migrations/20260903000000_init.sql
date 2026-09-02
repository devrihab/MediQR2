-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PATIENTS
CREATE TABLE patients (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  blood_group TEXT,
  allergies JSONB DEFAULT '[]'::jsonb,
  conditions TEXT[] DEFAULT '{}'::text[],
  medications TEXT[] DEFAULT '{}'::text[],
  prescriptions JSONB DEFAULT '[]'::jsonb,
  emergency_contact JSONB,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  data_source TEXT DEFAULT 'self-reported'
);

-- DOCTORS
CREATE TABLE doctors (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL
);

-- QRS
CREATE TABLE qrs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  code_value TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ACCESS REQUESTS
CREATE TABLE access_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'expired')),
  otp_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '60 seconds'),
  otp_consumed_at TIMESTAMPTZ
);

-- AUDIT LOGS
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID REFERENCES doctors(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  type TEXT NOT NULL CHECK (type IN ('normal_view', 'emergency_view', 'request_expired', 'edit_data')),
  reason TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  is_reported BOOLEAN DEFAULT false
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE qrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- PATIENT POLICIES
CREATE POLICY "Patient can manage own profile" ON patients FOR ALL USING (auth.uid() = id);
CREATE POLICY "Patient can manage own qrs" ON qrs FOR ALL USING (auth.uid() = patient_id);
CREATE POLICY "Patient can view own access requests" ON access_requests FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "Patient can view own audit logs" ON audit_logs FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "Patient can insert edit_data audit" ON audit_logs FOR INSERT WITH CHECK (auth.uid() = patient_id AND type = 'edit_data');
CREATE POLICY "Patient can report audit log" ON audit_logs FOR UPDATE USING (auth.uid() = patient_id) WITH CHECK (auth.uid() = patient_id);

-- DOCTOR POLICIES
CREATE POLICY "Doctor can manage own profile" ON doctors FOR ALL USING (auth.uid() = id);
CREATE POLICY "Doctor can view own access requests" ON access_requests FOR SELECT USING (auth.uid() = doctor_id);
CREATE POLICY "Doctor can view own audit logs" ON audit_logs FOR SELECT USING (auth.uid() = doctor_id);

-- STRICT MEDICAL DATA EXPOSURE CONTROL
-- Doctors can only query patient data if they have valid authorization via request or emergency
CREATE POLICY "Doctor can access patient data conditionally" ON patients FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM access_requests
    WHERE doctor_id = auth.uid()
    AND patient_id = patients.id
    AND status = 'approved'
    AND resolved_at > NOW() - INTERVAL '12 hours'
  ) OR
  EXISTS (
    SELECT 1 FROM audit_logs
    WHERE doctor_id = auth.uid()
    AND patient_id = patients.id
    AND type = 'emergency_view'
    AND timestamp > NOW() - INTERVAL '12 hours'
  )
);

-- QR SCANNER RESOLUTION
-- ANY authenticated doctor can fetch active QRs to find the patient ID for the scan step
CREATE POLICY "Anyone can resolve active qrs" ON qrs FOR SELECT TO authenticated USING (is_active = true);

-- SYSTEM INDEXES
CREATE UNIQUE INDEX idx_qrs_active_patient ON qrs (patient_id) WHERE is_active = true;
CREATE INDEX idx_audit_logs_patient ON audit_logs(patient_id);
CREATE INDEX idx_audit_logs_doctor ON audit_logs(doctor_id);
CREATE INDEX idx_access_requests_doctor ON access_requests(doctor_id);
CREATE INDEX idx_access_requests_patient ON access_requests(patient_id);
