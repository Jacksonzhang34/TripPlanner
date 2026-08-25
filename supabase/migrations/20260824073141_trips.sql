-- Trips: the top-level container a group plans together. Also carries the
-- current invite state (code/role/expiry) and editor capacity — see
-- docs/design/phase-1-trip-crud-membership.md "Design History" for why
-- these live here instead of a separate invites table.
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination text,
  start_date date,
  end_date date,
  status text not null default 'planning' check (status in ('planning', 'active', 'completed', 'archived')),
  cover_photo_url text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  capacity integer check (capacity is null or capacity >= 0),
  invite_code text unique,
  invite_role text check (invite_role in ('editor', 'viewer')),
  invite_expires_at timestamptz
);

-- Trip membership: who can see/edit a trip, and at what role.
create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;

-- Helper functions. security definer so they can read trip_members
-- regardless of the calling role's own RLS visibility into that table,
-- avoiding the recursive-policy trap of a trip_members policy that itself
-- queries trip_members under RLS.
create function public.is_trip_member(p_trip_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = p_uid
  );
$$;

create function public.trip_role(p_trip_id uuid, p_uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.trip_members
  where trip_id = p_trip_id and user_id = p_uid;
$$;

grant execute on function public.is_trip_member(uuid, uuid) to authenticated;
grant execute on function public.trip_role(uuid, uuid) to authenticated;

-- Base table privileges for authenticated users (required for RLS policies to work)
grant select on table public.trips to authenticated;
grant insert on table public.trips to authenticated;
grant update on table public.trips to authenticated;
grant select on table public.trip_members to authenticated;
grant delete on table public.trip_members to authenticated;

-- trips policies
create policy "members can view their trips"
  on public.trips for select
  to authenticated
  using (public.is_trip_member(id, auth.uid()));

create policy "authenticated users can create trips"
  on public.trips for insert
  to authenticated
  with check (created_by = auth.uid());

-- Covers editing trip fields, generating/revoking the invite code, and
-- changing capacity — all just column updates on this same row.
create policy "owner or editor can update trip"
  on public.trips for update
  to authenticated
  using (public.trip_role(id, auth.uid()) in ('owner', 'editor'))
  with check (public.trip_role(id, auth.uid()) in ('owner', 'editor'));

-- trip_members policies
create policy "members can view fellow members"
  on public.trip_members for select
  to authenticated
  using (public.is_trip_member(trip_id, auth.uid()));

-- A member can delete their own row (leave) UNLESS they're the owner and
-- someone else is still in the trip — in that case this policy simply
-- doesn't match, so the delete is rejected with the usual RLS error. The
-- owner's only path out of a non-empty trip is transfer_trip_ownership()
-- (see the next migration), which flips their role to 'editor' first,
-- after which this same policy allows them to leave normally.
create policy "members can leave a trip"
  on public.trip_members for delete
  to authenticated
  using (
    user_id = auth.uid()
    and (
      role <> 'owner'
      or not exists (
        select 1 from public.trip_members other
        where other.trip_id = trip_members.trip_id and other.user_id <> trip_members.user_id
      )
    )
  );

-- The user_id <> auth.uid() guard is required, not cosmetic: without it, an
-- owner could delete their OWN row through this policy (it only checks the
-- caller's role, not the target), completely bypassing the transfer-first
-- restriction in "members can leave a trip" above — RLS policies for the
-- same command are OR'd, so either one matching is enough to permit a delete.
create policy "owner can remove another member"
  on public.trip_members for delete
  to authenticated
  using (public.trip_role(trip_id, auth.uid()) = 'owner' and user_id <> auth.uid());

-- Auto-add the creator as owner. security definer so it can insert into
-- trip_members even though there's no INSERT policy for regular users.
create function public.handle_new_trip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_trip_created
  after insert on public.trips
  for each row execute function public.handle_new_trip();

-- Guards against lowering capacity below the trip's current editor count.
-- Only fires when capacity is actually changing, and only compares against
-- editors — owner and viewers never count against capacity.
create function public.enforce_capacity_floor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_editor_count integer;
begin
  if new.capacity is not null and new.capacity is distinct from old.capacity then
    select count(*) into v_editor_count
    from public.trip_members
    where trip_id = new.id and role = 'editor';

    if new.capacity < v_editor_count then
      raise exception 'capacity_below_current_editor_count';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_trip_capacity_floor
  before update on public.trips
  for each row execute function public.enforce_capacity_floor();

-- If a trip_members delete leaves a trip with zero members (only reachable
-- by a solo owner leaving — see the policy comment above), archive it
-- instead of leaving it in whatever status it was in with nobody able to
-- see or act on it again. This is a fallback for data hygiene, not
-- user-visible behavior: is_trip_member already hides a trip from everyone
-- once it has no members, regardless of status.
create function public.archive_trip_if_empty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.trip_members where trip_id = old.trip_id) then
    update public.trips set status = 'archived' where id = old.trip_id and status <> 'archived';
  end if;
  return old;
end;
$$;

create trigger on_trip_member_removed
  after delete on public.trip_members
  for each row execute function public.archive_trip_if_empty();
