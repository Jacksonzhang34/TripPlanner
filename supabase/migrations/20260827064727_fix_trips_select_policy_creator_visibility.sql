-- Fixes a real bug: `createTrip()` does `INSERT ... RETURNING *`, and
-- Postgres requires the SELECT policy to pass on the returned row. The
-- previous SELECT policy only allowed visibility via `is_trip_member()`,
-- which depends on the `on_trip_created` trigger's `trip_members` insert —
-- but `is_trip_member()` is `stable`, so it cannot see writes made earlier
-- within the SAME command (even by that command's own trigger). Net effect:
-- creating a trip always failed with "new row violates row-level security
-- policy for table trips", and the whole INSERT rolled back — no trip could
-- ever actually be created.
--
-- Fix: let a trip's own creator see it directly via `created_by = auth.uid()`,
-- which doesn't depend on the trigger at all. This is also more correct as a
-- policy on its own merits (a creator should always be able to see their own
-- trip), not just a workaround for the RETURNING timing issue.
drop policy "members can view their trips" on public.trips;

create policy "members can view their trips"
  on public.trips for select
  to authenticated
  using (public.is_trip_member(id, auth.uid()) or created_by = auth.uid());
