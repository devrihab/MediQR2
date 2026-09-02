import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { patientId, doctorId, reason } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify patient and doctor exist
    const { data: patient, error: patientError } = await supabase.from('patients').select('id').eq('id', patientId).single();
    if (patientError || !patient) throw new Error('Patient not found');
    
    const { data: doctor, error: doctorError } = await supabase.from('doctors').select('id').eq('id', doctorId).single();
    if (doctorError || !doctor) throw new Error('Doctor not found');

    // Securely write the emergency audit log via Service Role Key (bypassing client insertion limits)
    const { error: auditError } = await supabase.from('audit_logs').insert({
      patient_id: patientId,
      doctor_id: doctorId,
      type: 'emergency_view',
      reason: reason,
      timestamp: new Date().toISOString()
    });

    if (auditError) throw auditError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
