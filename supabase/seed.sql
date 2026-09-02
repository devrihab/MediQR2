-- Seed Demo Patient (auth.users)
-- Note: 'demo123' is the password for these seed accounts.
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
  '11111111-1111-1111-1111-111111111111', 
  '00000000-0000-0000-0000-000000000000', 
  'patient@demo.com', 
  crypt('demo123', gen_salt('bf')), 
  NOW(), 
  '{"provider":"email","providers":["email"]}', 
  '{}', 
  NOW(), 
  NOW(), 
  'authenticated', 
  '', 
  '', 
  '', 
  ''
) ON CONFLICT DO NOTHING;

-- Seed Demo Patient (public.patients)
INSERT INTO public.patients (id, name, email, blood_group, allergies, conditions, medications, prescriptions, emergency_contact, data_source)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Alex Demo',
  'patient@demo.com',
  'O+',
  '[{"name": "Penicillin", "severity": "severe"}]'::jsonb,
  '{"Asthma"}',
  '{"Albuterol Inhaler"}',
  '[{"name": "Amoxicillin", "dosage": "500mg", "date": "2025-11-10", "prescribing_doctor": "Dr. Sarah Adams"}, {"name": "Ibuprofen", "dosage": "400mg", "date": "2026-01-15", "prescribing_doctor": "Dr. Smith"}]'::jsonb,
  '{"name": "Sarah Demo", "phone": "555-0199", "relation": "Spouse"}'::jsonb,
  'self-reported'
) ON CONFLICT DO NOTHING;

-- Seed Demo QR Code
INSERT INTO public.qrs (patient_id, code_value, is_active)
VALUES (
  '11111111-1111-1111-1111-111111111111', 
  'demo-qr-12345', 
  true
) ON CONFLICT DO NOTHING;

-- Seed Demo Doctor (auth.users)
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
  '22222222-2222-2222-2222-222222222222', 
  '00000000-0000-0000-0000-000000000000', 
  'doctor@demo.com', 
  crypt('demo123', gen_salt('bf')), 
  NOW(), 
  '{"provider":"email","providers":["email"]}', 
  '{}', 
  NOW(), 
  NOW(), 
  'authenticated', 
  '', 
  '', 
  '', 
  ''
) ON CONFLICT DO NOTHING;

-- Seed Demo Doctor (public.doctors)
INSERT INTO public.doctors (id, name)
VALUES (
  '22222222-2222-2222-2222-222222222222', 
  'Dr. Smith'
) ON CONFLICT DO NOTHING;
