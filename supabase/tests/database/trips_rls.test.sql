begin;
select plan(18);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'outsider@example.com'),
  ('66666666-6666-6666-6666-666666666666', 'editor1@example.com'),
  ('88888888-8888-8888-8888-888888888888', 'editor2@example.com');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

-- ===================================================================
-- Ownership: creating a trip
-- ===================================================================

insert into public.trips (id, name, created_by)
values ('33333333-3333-3333-3333-333333333333', 'Kyoto Trip', '11111111-1111-1111-1111-111111111111');

select is(
  (select role from public.trip_members where trip_id = '33333333-3333-3333-3333-333333333333' and user_id = '11111111-1111-1111-1111-111111111111'),
  'owner',
  '[ownership] creating a trip auto-adds the creator as owner'
);

select is(
  (select count(*)::int from public.trips where id = '33333333-3333-3333-3333-333333333333'),
  1,
  '[ownership] owner can see their own trip'
);

-- Regression test: the app (PostgREST via `.select().single()`) does
-- `INSERT ... RETURNING`, not a separate INSERT then SELECT like the
-- fixture above. RETURNING is subject to the SELECT policy on the row it
-- just inserted, and `is_trip_member()` is `stable` — stable functions
-- can't see writes made earlier within the SAME command, including this
-- INSERT's own `on_trip_created` trigger. Without the `created_by =
-- auth.uid()` clause on the SELECT policy, this exact statement shape
-- fails with "new row violates row-level security policy" and the whole
-- INSERT rolls back — no trip is ever created, for anyone. The two
-- assertions above never caught this because they insert and select in
-- separate statements, which sidesteps the bug entirely.
select lives_ok(
  $$insert into public.trips (id, name, created_by) values ('44444444-4444-4444-4444-444444444444', 'RETURNING Regression Trip', '11111111-1111-1111-1111-111111111111') returning *$$,
  '[ownership] creating a trip via INSERT...RETURNING (what the app actually does) succeeds'
);

-- ===================================================================
-- Invite code & capacity
-- ===================================================================

select lives_ok(
  $$update public.trips set invite_code = 'OWNERCODE', invite_role = 'viewer' where id = '33333333-3333-3333-3333-333333333333'$$,
  '[invite] owner can generate an invite code'
);

select lives_ok(
  $$update public.trips set capacity = 3 where id = '33333333-3333-3333-3333-333333333333'$$,
  '[capacity] owner can set capacity with zero current editors'
);

-- ===================================================================
-- Capacity floor trigger
-- ===================================================================

-- Add one editor directly (bypassing redemption, which is tested separately
-- in redeem_invite.test.sql) so we can test the capacity floor trigger and
-- the owner-cannot-leave-a-non-empty-trip guard. Run as postgres: by design
-- trip_members has no client-facing INSERT policy at all (see the
-- migration), so this fixture write can't go through as `authenticated`.
set local role postgres;
insert into public.trip_members (trip_id, user_id, role)
values ('33333333-3333-3333-3333-333333333333', '66666666-6666-6666-6666-666666666666', 'editor');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

select throws_ok(
  $$update public.trips set capacity = 0 where id = '33333333-3333-3333-3333-333333333333'$$,
  'P0001',
  'capacity_below_current_editor_count',
  '[capacity] cannot lower capacity below the current editor count'
);

select lives_ok(
  $$update public.trips set capacity = 1 where id = '33333333-3333-3333-3333-333333333333'$$,
  '[capacity] can set capacity exactly equal to the current editor count'
);

-- ===================================================================
-- Owner cannot abandon a non-empty trip
-- ===================================================================

-- RLS policies for UPDATE/DELETE filter rows via their USING clause rather
-- than raising an error: a delete that matches zero visible rows just
-- succeeds having deleted nothing (`DELETE 0`), it doesn't throw 42501.
-- So the only way to actually prove this delete was blocked is lives_ok
-- (no unrelated error) plus asserting the row is still there.
select lives_ok(
  $$delete from public.trip_members where trip_id = '33333333-3333-3333-3333-333333333333' and user_id = '11111111-1111-1111-1111-111111111111'$$,
  '[leave] owner attempting to leave while another member exists does not error'
);

select is(
  (select count(*)::int from public.trip_members where trip_id = '33333333-3333-3333-3333-333333333333' and user_id = '11111111-1111-1111-1111-111111111111'),
  1,
  '[leave] owner cannot leave while another member still exists (delete was silently filtered by RLS, not applied)'
);

-- Confirms the "owner can remove another member" policy still works for
-- its actual intended purpose after adding the user_id <> auth.uid() guard
-- — a second editor, distinct from the one used in the test above, so the
-- later "non-owner cannot remove another member" assertion still has
-- editor1 available to target. Run as postgres for the same reason as the
-- editor1 fixture above: no client-facing INSERT policy on trip_members.
set local role postgres;
insert into public.trip_members (trip_id, user_id, role)
values ('33333333-3333-3333-3333-333333333333', '88888888-8888-8888-8888-888888888888', 'editor');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

select lives_ok(
  $$delete from public.trip_members where trip_id = '33333333-3333-3333-3333-333333333333' and user_id = '88888888-8888-8888-8888-888888888888'$$,
  '[leave] owner can still remove a DIFFERENT member (the self-exclusion guard only blocks removing yourself)'
);

-- ===================================================================
-- Non-member has no access
-- ===================================================================

-- Switch to the outsider: not a member of the trip at all.
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);

select is(
  (select count(*)::int from public.trips where id = '33333333-3333-3333-3333-333333333333'),
  0,
  '[non-member] cannot see the trip (RLS SELECT blocked)'
);

select is(
  (select count(*)::int from public.trip_members where trip_id = '33333333-3333-3333-3333-333333333333'),
  0,
  '[non-member] cannot see trip_members rows for a trip they are not in'
);

select lives_ok(
  $$update public.trips set name = 'Hijacked' where id = '33333333-3333-3333-3333-333333333333'$$,
  '[non-member] update does not error'
);

select lives_ok(
  $$delete from public.trip_members where trip_id = '33333333-3333-3333-3333-333333333333' and user_id = '66666666-6666-6666-6666-666666666666'$$,
  '[non-member] attempting to remove another member does not error'
);

-- A non-member/non-owner has zero SELECT visibility into this trip at all
-- (verified separately above), so reading back through their own session
-- can't tell "blocked" from "invisible" — it always reads as gone/unchanged
-- either way. Verifying the write was actually blocked (not just that no
-- error was thrown) requires a role that can actually see the row.
set local role postgres;

select isnt(
  (select name from public.trips where id = '33333333-3333-3333-3333-333333333333'),
  'Hijacked',
  '[non-member] update is blocked by RLS (silently filtered, name unchanged)'
);

select is(
  (select count(*)::int from public.trip_members where trip_id = '33333333-3333-3333-3333-333333333333' and user_id = '66666666-6666-6666-6666-666666666666'),
  1,
  '[non-member] cannot remove another member (delete was silently filtered by RLS, not applied)'
);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);

-- ===================================================================
-- Solo owner can leave; trip auto-archives
-- ===================================================================

-- A solo owner (no other members) can still leave — their own trip, alone.
insert into public.trips (id, name, created_by)
values ('99999999-9999-9999-9999-999999999999', 'Solo Trip', '22222222-2222-2222-2222-222222222222');

select lives_ok(
  $$delete from public.trip_members where trip_id = '99999999-9999-9999-9999-999999999999' and user_id = '22222222-2222-2222-2222-222222222222'$$,
  '[archive] owner can leave when they are the only member left'
);

-- Same visibility problem as above: having just left, the outsider is no
-- longer a member and can no longer see this trip via RLS at all — reading
-- back through their session would find nothing regardless of `status`.
set local role postgres;

select is(
  (select status from public.trips where id = '99999999-9999-9999-9999-999999999999'),
  'archived',
  '[archive] a trip is auto-archived once its last member leaves'
);

select * from finish();
rollback;
