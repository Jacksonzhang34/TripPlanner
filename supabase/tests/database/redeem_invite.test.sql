begin;
select plan(7);

insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'inviter@example.com'),
  ('55555555-5555-5555-5555-555555555555', 'joiner@example.com'),
  ('77777777-7777-7777-7777-777777777777', 'second-joiner@example.com');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444444')::text, true);

insert into public.trips (id, name, created_by, capacity, invite_code, invite_role)
values ('66666666-6666-6666-6666-666666666666', 'Lisbon Trip', '44444444-4444-4444-4444-444444444444', 1, 'JOINME1', 'editor');

insert into public.trips (id, name, created_by, invite_code, invite_role, invite_expires_at)
values ('88888888-8888-8888-8888-888888888888', 'Expired Trip', '44444444-4444-4444-4444-444444444444', 'EXPIRED1', 'viewer', now() - interval '1 day');

-- Redeem as the first joiner: capacity is 1, zero editors so far.
select set_config('request.jwt.claims', json_build_object('sub', '55555555-5555-5555-5555-555555555555')::text, true);

select is(
  (select role from public.redeem_invite('JOINME1')),
  'editor',
  '[redeem] redeeming a valid editor invite returns the granted role'
);

select is(
  (select role from public.trip_members where trip_id = '66666666-6666-6666-6666-666666666666' and user_id = '55555555-5555-5555-5555-555555555555'),
  'editor',
  '[redeem] redeeming adds the joiner to trip_members with the invite role'
);

-- Second joiner tries the same still-valid code, but capacity is now full.
select set_config('request.jwt.claims', json_build_object('sub', '77777777-7777-7777-7777-777777777777')::text, true);

select throws_ok(
  $$select * from public.redeem_invite('JOINME1')$$,
  'P0001',
  'trip_at_capacity',
  '[redeem] redeeming when the trip is at editor capacity raises an error'
);

select throws_ok(
  $$select * from public.redeem_invite('EXPIRED1')$$,
  'P0001',
  'invalid_or_expired_invite',
  '[redeem] redeeming an expired invite raises an error'
);

-- The inviter is already a member of "Expired Trip" (auto-added as owner
-- when they created it) — even though its code is expired, redeeming it
-- should succeed as a no-op for them, since expiry only gates NEW joins.
select set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444444')::text, true);

select is(
  (select role from public.redeem_invite('EXPIRED1')),
  'owner',
  '[redeem] an existing member can re-redeem even an expired code, returning their real role'
);

-- Re-redeeming the same code as an already-joined user is idempotent, not an error.
select set_config('request.jwt.claims', json_build_object('sub', '55555555-5555-5555-5555-555555555555')::text, true);

select lives_ok(
  $$select * from public.redeem_invite('JOINME1')$$,
  '[redeem] redeeming a code you already used again does not error (ON CONFLICT DO NOTHING)'
);

select is(
  (select count(*)::int from public.trip_members where trip_id = '66666666-6666-6666-6666-666666666666' and user_id = '55555555-5555-5555-5555-555555555555'),
  1,
  '[redeem] idempotent re-redemption does not create a duplicate membership row'
);

select * from finish();
rollback;
