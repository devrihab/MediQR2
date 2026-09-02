import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { patientId, doctorId } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Verify patient exists
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('email')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      throw new Error('Patient not found');
    }

    // 2. Generate cryptographically secure 5-digit OTP
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const otp = (array[0] % 90000 + 10000).toString();

    // 3. Store OTP in DB (Plaintext for MVP per instructions, server-side only)
    const { data: request, error: requestError } = await supabase
      .from('access_requests')
      .insert({
        patient_id: patientId,
        doctor_id: doctorId,
        status: 'pending',
        otp_hash: otp,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (requestError || !request) {
      throw new Error('Failed to create request');
    }

    // Return request info WITHOUT the OTP
    return new Response(JSON.stringify({
      request: {
        id: request.id,
        status: request.status,
        created_at: request.created_at,
        patient_id: request.patient_id,
        doctor_id: request.doctor_id
      }
    }), {
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
