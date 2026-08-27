import { assertEquals } from 'jsr:@std/assert@1';

import { handler } from './index.ts';

// Same scope as create-invite's tests: only paths that return before
// touching Supabase (auth header check, body validation). The actual
// redemption behavior (success, invalid/expired code, at-capacity) needs a
// live Postgres to be meaningful and was verified manually via curl against
// local Supabase instead — see the plan's Task 7 Steps 2-3.

Deno.test('handler responds to CORS preflight without needing auth', async () => {
  const req = new Request('http://localhost/redeem-invite', { method: 'OPTIONS' });

  const res = await handler(req);

  assertEquals(res.status, 200);
});

Deno.test('handler rejects a request with no Authorization header', async () => {
  const req = new Request('http://localhost/redeem-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invite_code: 'ABCD2345' }),
  });

  const res = await handler(req);

  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, 'missing_authorization');
});

Deno.test('handler rejects a request with a non-string code', async () => {
  const req = new Request('http://localhost/redeem-invite', {
    method: 'POST',
    headers: { Authorization: 'Bearer fake-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ invite_code: 12345 }),
  });

  const res = await handler(req);

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, 'invalid_request');
});

Deno.test('handler rejects a request with an empty or whitespace-only code', async () => {
  for (const inviteCode of ['', '   ']) {
    const req = new Request('http://localhost/redeem-invite', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: inviteCode }),
    });

    const res = await handler(req);

    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error, 'invalid_request');
  }
});
