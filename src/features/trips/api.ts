import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert } from '@/types/database';

export type Trip = Tables<'trips'>;
export type TripMember = Tables<'trip_members'>;

/** Lists all trips the caller is a member of, newest first. */
export async function listTrips() {
  const { data, error } = await supabase.from('trips').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Fetches a single trip by id. */
export async function getTrip(tripId: string) {
  const { data, error } = await supabase.from('trips').select('*').eq('id', tripId).single();
  if (error) throw error;
  return data;
}

/** Creates a new trip owned by the signed-in caller. */
export async function createTrip(input: Pick<TablesInsert<'trips'>, 'name' | 'destination' | 'start_date' | 'end_date'>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('trips')
    .insert({ ...input, created_by: user.id })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Lists a trip's members with their profile info (display name, avatar). */
export async function listTripMembers(tripId: string) {
  const { data, error } = await supabase
    .from('trip_members')
    .select('*, profiles(display_name, avatar_url)')
    .eq('trip_id', tripId);
  if (error) throw error;
  return data;
}

/** Generates a new invite code for a trip via the create-invite Edge Function. */
export async function createInvite(input: { tripId: string; role: 'editor' | 'viewer'; expiresInHours?: number | null }) {
  const { data, error } = await supabase.functions.invoke('create-invite', {
    body: {
      trip_id: input.tripId,
      role: input.role,
      expires_in_hours: input.expiresInHours,
    },
  });
  if (error) throw error;
  return data as { code: string; expires_at: string | null };
}

/** Clears a trip's active invite code, so it can no longer be redeemed. */
export async function revokeInvite(tripId: string) {
  const { error } = await supabase
    .from('trips')
    .update({ invite_code: null, invite_role: null, invite_expires_at: null })
    .eq('id', tripId);
  if (error) throw error;
}

/** Sets a trip's editor capacity cap (null = uncapped). */
export async function updateTripCapacity(tripId: string, capacity: number | null) {
  const { error } = await supabase.from('trips').update({ capacity }).eq('id', tripId);
  if (error) throw error;
}

/** Joins a trip by redeeming an invite code via the redeem-invite Edge Function. */
export async function redeemInvite(code: string) {
  // Field is `invite_code`, not `code` — the deployed redeem-invite function
  // (Task 7) renamed it to avoid ambiguity with `error.code` (an unrelated
  // Postgres/PostgREST error code) used elsewhere in that function.
  const { data, error } = await supabase.functions.invoke('redeem-invite', {
    body: { invite_code: code },
  });
  if (error) throw error;
  return data as { trip_id: string; role: string };
}

/** Removes a member from a trip. */
export async function removeMember(tripId: string, userId: string) {
  const { error } = await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', userId);
  if (error) throw error;
}

/** Atomically hands trip ownership to another existing member. */
export async function transferOwnership(tripId: string, newOwnerId: string) {
  const { error } = await supabase.rpc('transfer_trip_ownership', {
    p_trip_id: tripId,
    p_new_owner_id: newOwnerId,
  });
  if (error) throw error;
}

/** Removes the signed-in caller from a trip; throws if the leave silently no-ops (see below). */
export async function leaveTrip(tripId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  // transfer_trip_ownership() has a race (Task 3's ledger): if the owner
  // transfers ownership to this same user in the same moment they try to
  // leave, this DELETE can silently affect 0 rows — not a Postgres/PostgREST
  // error, just a no-op. Chaining .select() makes Supabase return the
  // deleted rows so we can tell a real leave apart from that silent no-op
  // and surface it as a real failure instead of succeeding at nothing.
  const { data, error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('not_a_member');
}
