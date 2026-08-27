import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as api from './api';

/** Cached list of trips the caller belongs to. */
export function useTrips() {
  return useQuery({ queryKey: ['trips'], queryFn: api.listTrips });
}

/** Cached single trip; skips fetching until tripId is set. */
export function useTrip(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId], queryFn: () => api.getTrip(tripId), enabled: !!tripId });
}

/** Cached member list for a trip. */
export function useTripMembers(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'members'],
    queryFn: () => api.listTripMembers(tripId),
    enabled: !!tripId,
  });
}

/** Creates a trip; refetches the trip list on success. */
export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createTrip,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips'] }),
  });
}

/** Generates an invite code; refetches this trip on success. */
export function useCreateInvite(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createInvite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips', tripId] }),
  });
}

/** Revokes the active invite code; refetches this trip on success. */
export function useRevokeInvite(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.revokeInvite(tripId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips', tripId] }),
  });
}

/** Updates the editor capacity cap; refetches this trip on success. */
export function useUpdateTripCapacity(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (capacity: number | null) => api.updateTripCapacity(tripId, capacity),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips', tripId] }),
  });
}

/** Joins a trip via invite code; refetches the trip list on success. */
export function useRedeemInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.redeemInvite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips'] }),
  });
}

/** Removes a member; refetches this trip's member list on success. */
export function useRemoveMember(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.removeMember(tripId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'members'] }),
  });
}

/** Hands ownership to another member; refetches this trip's member list on success. */
export function useTransferOwnership(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newOwnerId: string) => api.transferOwnership(tripId, newOwnerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'members'] }),
  });
}

/** Leaves a trip; refetches the trip list on success. */
export function useLeaveTrip(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.leaveTrip(tripId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips'] }),
  });
}
