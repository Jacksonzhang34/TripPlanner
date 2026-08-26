import { assertEquals, assertMatch, assertNotMatch } from 'jsr:@std/assert@1';

import { generateInviteCode, handler } from './index.ts';

// These tests only cover paths that return before touching Supabase (auth
// header check, body validation) — no mocking, just real code exercised via
// its real early-return branches. The success path and the RLS-rejection
// path both need a live Postgres to be meaningful and were verified
// manually instead, via curl against local Supabase (see the plan's Task 6
// Steps 4-5): owner gets a 200 with a valid code, a non-member gets a
// clean 403, and a second call returns a different code, confirming the
// first is invalidated.

Deno.test('generateInviteCode generates an 8-character code', () => {
  assertEquals(generateInviteCode().length, 8);
});

Deno.test('generateInviteCode only uses unambiguous uppercase letters and digits', () => {
  assertMatch(generateInviteCode(), /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
});

Deno.test('generateInviteCode excludes visually ambiguous characters', () => {
  for (let i = 0; i < 50; i++) {
    assertNotMatch(generateInviteCode(), /[0O1IL]/);
  }
});

Deno.test('handler rejects a request with no Authorization header', async () => {
  const req = new Request('http://localhost/create-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trip_id: '33333333-3333-3333-3333-333333333333', role: 'editor' }),
  });

  const res = await handler(req);

  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, 'missing_authorization');
});

Deno.test('handler rejects a request missing trip_id', async () => {
  const req = new Request('http://localhost/create-invite', {
    method: 'POST',
    headers: { Authorization: 'Bearer fake-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'editor' }),
  });

  const res = await handler(req);

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, 'invalid_request');
});

Deno.test('handler rejects a request with an invalid role', async () => {
  const req = new Request('http://localhost/create-invite', {
    method: 'POST',
    headers: { Authorization: 'Bearer fake-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ trip_id: '33333333-3333-3333-3333-333333333333', role: 'owner' }),
  });

  const res = await handler(req);

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, 'invalid_request');
});

Deno.test('handler responds to CORS preflight without needing auth', async () => {
  const req = new Request('http://localhost/create-invite', { method: 'OPTIONS' });

  const res = await handler(req);

  assertEquals(res.status, 200);
});
