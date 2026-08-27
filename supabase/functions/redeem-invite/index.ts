import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';

type RequestBody = {
  invite_code: string;
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Redeems an invite code via the redeem_invite() RPC (all the real logic —
// capacity, expiry, idempotent re-redemption — lives there, already
// pgTAP-tested). Exported separately from Deno.serve() below so it's
// directly unit-testable without a running server.
export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'missing_authorization' }, 401);
  }

  const body: Partial<RequestBody> = await req.json();
  if (typeof body.invite_code !== 'string' || body.invite_code.trim().length === 0) {
    return jsonResponse({ error: 'invalid_request' }, 400);
  }

  // User-scoped client — redeem_invite() reads auth.uid() internally, so
  // this must run as the calling user, not the service role.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonResponse({ error: 'invalid_session' }, 401);
  }

  const { data, error } = await supabase.rpc('redeem_invite', { p_code: body.invite_code.trim().toUpperCase() }).single();

  if (error) {
    // Both of these are real RAISE EXCEPTION messages from redeem_invite()
    // itself (Task 2), not RLS silently no-op'ing a blocked write — so
    // error.message is exactly the raised text, verified directly against
    // local Supabase before writing this.
    const status = error.message === 'invalid_or_expired_invite' ? 404 : error.message === 'trip_at_capacity' ? 409 : 400;
    return jsonResponse({ error: error.message }, status);
  }

  return jsonResponse(data, 200);
}

// import.meta.main is only true when this file is run directly (as Supabase
// does to actually serve the function) — false when another module (like
// index.test.ts) merely imports it, so testing doesn't start a real server.
if (import.meta.main) {
  Deno.serve(handler);
}
