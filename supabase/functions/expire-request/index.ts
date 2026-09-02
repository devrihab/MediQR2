import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { requestId, doctorId, patientId } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: request } = await supabase
      .from('access_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (request && request.status === 'pending') {
      const now = new Date().getTime();
      const created = new Date(request.created_at).getTime();

      // If older than 60 seconds, expire it
      if (now - created > 60000) {
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
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Client doesn't need to know it failed
    });
  }
});
