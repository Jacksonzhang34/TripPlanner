-- Atomically redeems an invite code. An existing member always succeeds as
-- a no-op, returning their real current role, regardless of whether the
-- code has since expired or the trip is at capacity — those checks only
-- ever gate a NEW join. For a new join: validates the code isn't expired,
-- enforces editor capacity (skipped entirely for viewer invites), and adds
-- the caller as a member. The FOR UPDATE row lock on trips is what makes
-- the capacity check race-safe — two concurrent redemptions of the last
-- editor slot can't both pass the count check, because the second
-- transaction blocks on the lock until the first commits its insert.
create function public.redeem_invite(p_code text)
returns table(trip_id uuid, role text)
language plpgsql
security definer
set search_path = public
as $$
-- The `returns table(trip_id uuid, role text)` above declares OUT
-- parameters named trip_id/role, which plpgsql treats as variables in
-- scope for the whole function body — colliding with trip_members'
-- own trip_id/role columns used throughout below. This pragma resolves
-- any such clash in favor of the table column, not the OUT variable.
#variable_conflict use_column
declare
  v_trip public.trips%rowtype;
  v_existing_role text;
  v_editor_count integer;
begin
  -- Look up by code alone first — no expiry filter yet. Expiry should
  -- only ever gate a NEW join; an existing member must be recognized as
  -- already-joined regardless of whether the code has since expired.
  select * into v_trip
  from public.trips
  where invite_code = p_code
  for update;

  if not found then
    raise exception 'invalid_or_expired_invite';
  end if;

  -- Already a member? This redemption is a no-op no matter what state the
  -- code is in (expired or not) — return their actual current role (which
  -- may differ from what this invite currently grants) and stop here,
  -- before expiry or capacity ever come into play.
  select tm.role into v_existing_role
  from public.trip_members tm
  where tm.trip_id = v_trip.id and tm.user_id = auth.uid();

  if v_existing_role is not null then
    return query select v_trip.id, v_existing_role;
    return;
  end if;

  -- Not yet a member: NOW expiry actually matters.
  if v_trip.invite_expires_at is not null and v_trip.invite_expires_at <= now() then
    raise exception 'invalid_or_expired_invite';
  end if;

  if v_trip.invite_role = 'editor' and v_trip.capacity is not null then
    select count(*) into v_editor_count
    from public.trip_members
    where trip_id = v_trip.id and role = 'editor';

    if v_editor_count >= v_trip.capacity then
      raise exception 'trip_at_capacity';
    end if;
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (v_trip.id, auth.uid(), v_trip.invite_role)
  on conflict (trip_id, user_id) do nothing;

  return query select v_trip.id, v_trip.invite_role;
end;
$$;

grant execute on function public.redeem_invite(text) to authenticated;
