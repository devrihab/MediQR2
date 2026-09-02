import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { requestId, doctorId, patientId, otpInput } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: request, error: requestError } = await supabase
      .from('access_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    // Do not leak existence context, generic error
    if (requestError || !request) {
      throw new Error('Verification failed');
    }

    // Verify ownership and targets
    if (request.doctor_id !== doctorId || request.patient_id !== patientId) {
      throw new Error('Verification failed');
    }

    if (request.status !== 'pending') {
      throw new Error('Verification failed');
    }

    // Expiration check (deterministic)
    const now = new Date().getTime();
    const created = new Date(request.created_at).getTime();

    if (now - created > 60000) {
      // Mark as expired
      await supabase
        .from('access_requests')
        .update({ status: 'expired', resolved_at: new Date().toISOString() })
        .eq('id', requestId);

      await supabase
        .from('audit_logs')
        .insert({
          patient_id: patientId,
          doctor_id: doctorId,
          type: 'request_expired',
          timestamp: new Date().toISOString()
        });
        
      throw new Error('Verification failed');
    }

    // Verify OTP
    if (request.otp_hash === otpInput) {
      // Approve and consume
      await supabase
        .from('access_requests')
        .update({ status: 'approved', resolved_at: new Date().toISOString(), otp_consumed_at: new Date().toISOString() })
        .eq('id', requestId);

      await supabase
        .from('audit_logs')
        .insert({
          patient_id: patientId,
          doctor_id: doctorId,
          type: 'normal_view',
          timestamp: new Date().toISOString()
        });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      throw new Error('Verification failed');
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Verification failed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
