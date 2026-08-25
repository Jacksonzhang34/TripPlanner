-- Atomically hands ownership of a trip to another existing member. A trip
-- always has exactly one owner — this flips the caller to 'editor' and the
-- target to 'owner' in the same transaction, so there's no window where the
-- trip has zero or two owners. This is also the only way trip_members.role
-- is ever changed after initial creation (there is no general-purpose
-- "update a member's role" client path in Phase 1).
create function public.transfer_trip_ownership(p_trip_id uuid, p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_new_owner_role text;
begin
  if p_new_owner_id = auth.uid() then
    raise exception 'cannot_transfer_to_self';
  end if;

  select role into v_caller_role
  from public.trip_members
  where trip_id = p_trip_id and user_id = auth.uid();

  if v_caller_role is distinct from 'owner' then
    raise exception 'only_owner_can_transfer_ownership';
  end if;

  -- FOR UPDATE locks the target's row: without it, this read and the
  -- promotion below aren't atomic, and a concurrent "leave" on this exact
  -- row can slip in between them — the leave commits, then this still
  -- proceeds to "promote" a row that's already gone (a no-op UPDATE,
  -- matching zero rows, no error), while the caller still gets demoted.
  -- Net result: the trip ends up with zero owners. Locking here forces
  -- whichever of the two concurrent operations arrives first to fully
  -- complete before the other re-reads current state, so the other side
  -- either fails cleanly (this exception, row gone) or is itself correctly
  -- blocked by the leave policy (target is now owner, not alone) — never
  -- a silent, uncaught path to an ownerless trip.
  select role into v_new_owner_role
  from public.trip_members
  where trip_id = p_trip_id and user_id = p_new_owner_id
  for update;

  if v_new_owner_role is null then
    raise exception 'new_owner_must_be_existing_member';
  end if;

  update public.trip_members set role = 'owner' where trip_id = p_trip_id and user_id = p_new_owner_id;
  update public.trip_members set role = 'editor' where trip_id = p_trip_id and user_id = auth.uid();
end;
$$;

grant execute on function public.transfer_trip_ownership(uuid, uuid) to authenticated;
