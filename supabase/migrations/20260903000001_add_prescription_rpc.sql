CREATE OR REPLACE FUNCTION add_prescription(
  target_patient_id UUID, 
  new_prescription JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_prescriptions JSONB;
BEGIN
  -- Validate the doctor has access to this patient (they must have an approved access request)
  IF NOT EXISTS (
    SELECT 1 FROM access_requests
    WHERE doctor_id = auth.uid()
    AND patient_id = target_patient_id
    AND status = 'approved'
    AND resolved_at > NOW() - INTERVAL '12 hours'
  ) THEN
    RAISE EXCEPTION 'Doctor does not have active authorization to prescribe for this patient';
  END IF;

  SELECT prescriptions INTO current_prescriptions 
  FROM patients 
  WHERE id = target_patient_id;

  IF current_prescriptions IS NULL THEN
    current_prescriptions := '[]'::JSONB;
  END IF;

  current_prescriptions := current_prescriptions || new_prescription;

  UPDATE patients 
  SET prescriptions = current_prescriptions, last_updated = NOW() 
  WHERE id = target_patient_id;

  RETURN current_prescriptions;
END;
$$;
