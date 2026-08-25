begin;
select plan(5);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner2@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'editor2@example.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'nonmember@example.com');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::text, true);

insert into public.trips (id, name, created_by)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Porto Trip', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Add a second member directly as a fixture. Run as postgres: by design
-- trip_members has no client-facing INSERT policy at all, so this write
-- can't go through as `authenticated` (same reasoning as trips_rls.test.sql).
set local role postgres;
insert into public.trip_members (trip_id, user_id, role)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'editor');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::text, true);

select throws_ok(
  $$select public.transfer_trip_ownership('dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc')$$,
  'P0001',
  'new_owner_must_be_existing_member',
  '[transfer] cannot transfer ownership to someone who is not a member of the trip'
);

select throws_ok(
  $$select public.transfer_trip_ownership('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'P0001',
  'cannot_transfer_to_self',
  '[transfer] cannot transfer ownership to yourself'
);

select lives_ok(
  $$select public.transfer_trip_ownership('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$$,
  '[transfer] owner can transfer ownership to an existing member'
);

select is(
  (select role from public.trip_members where trip_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' and user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'owner',
  '[transfer] the target member becomes owner'
);

select is(
  (select role from public.trip_members where trip_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' and user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'editor',
  '[transfer] the former owner becomes editor, not removed'
);

select * from finish();
rollback;
