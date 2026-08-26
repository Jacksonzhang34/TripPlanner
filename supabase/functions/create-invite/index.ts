import { createClient } from 'npm:@supabase/supabase-js@2';
import { customAlphabet } from 'npm:nanoid@3';

import { corsHeaders } from '../_shared/cors.ts';

// Same charset as src/features/trips/invite-code.ts's isValidInviteCodeFormat
// (the client-side format check) — excludes 0/O/1/I/L, characters that are
// easy to mistype or misread. Deno has crypto.getRandomValues natively, so
// unlike the React Native app, no polyfill is needed for nanoid here.
const CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const DEFAULT_EXPIRY_HOURS = 24 * 7; // 7 days

export const generateInviteCode = customAlphabet(CODE_CHARSET, CODE_LENGTH);

type RequestBody = {
  trip_id: string;
  role: 'editor' | 'viewer';
  // Omit this field entirely for the 7-day default. Pass `null` explicitly
  // to request a code that never expires.
  expires_in_hours?: number | null;
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Validates the request, generates an invite code, and writes it onto the
// trip (RLS decides whether the caller may). Exported separately from
// Deno.serve() below so it's directly unit-testable without a running server.
export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'missing_authorization' }, 401);
  }

  const body: Partial<RequestBody> = await req.json();
  if (!body.trip_id || !body.role || !['editor', 'viewer'].includes(body.role)) {
    return jsonResponse({ error: 'invalid_request' }, 400);
  }

  // A user-scoped client (forwards the caller's own JWT) so the update
  // below is subject to the real RLS policy — this function does not
  // duplicate the owner/editor role check, RLS is the single source of truth.
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

  const expiresInHours = body.expires_in_hours === undefined ? DEFAULT_EXPIRY_HOURS : body.expires_in_hours;
  const expiresAt = expiresInHours === null ? null : new Date(Date.now() + expiresInHours * 3600_000).toISOString();

  // Retry a few times on the (astronomically unlikely) chance of a code
  // collision against the unique constraint on trips.invite_code.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const { data, error } = await supabase
      .from('trips')
      .update({ invite_code: code, invite_role: body.role, invite_expires_at: expiresAt })
      .eq('id', body.trip_id)
      .select('invite_code, invite_expires_at')
      .single();

    if (!error) {
      return jsonResponse({ code: data.invite_code, expires_at: data.invite_expires_at }, 200);
    }

    if (error.code === '23505') {
      continue; // code collision — retry with a new one
    }

    // Any other outcome, including PGRST116 ("0 rows returned" — what an
    // RLS-blocked update looks like here, since a blocked UPDATE in
    // Postgres silently affects 0 rows rather than raising 42501, and
    // .single() then fails on its own terms for getting 0 instead of 1),
    // means the caller isn't allowed to update this trip, or it doesn't
    // exist. Treat both the same: a clean 403, never leak the raw
    // PostgREST error text to the client.
    return jsonResponse({ error: 'forbidden' }, 403);
  }

  return jsonResponse({ error: 'could_not_generate_unique_code' }, 500);
}

// import.meta.main is only true when this file is run directly (as Supabase
// does to actually serve the function) — false when another module (like
// index.test.ts) merely imports it, so testing doesn't start a real server.
if (import.meta.main) {
  Deno.serve(handler);
}
