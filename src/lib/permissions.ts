import type { Listing, Profile } from './types';

export class PermissionError extends Error {
  constructor(message = 'You do not have permission to do that.') { super(message); this.name = 'PermissionError'; }
}
export function assertApproved(profile: Profile | null): asserts profile is Profile {
  if (!profile || profile.verification_status !== 'approved') throw new PermissionError('Your school must approve your account first.');
}
export function assertAdmin(profile: Profile | null): asserts profile is Profile {
  assertApproved(profile);
  if (profile.role !== 'admin') throw new PermissionError();
}
export function assertOwner(profile: Profile | null, listing: Pick<Listing, 'seller_id'> | null): void {
  assertApproved(profile);
  if (!listing || listing.seller_id !== profile.id) throw new PermissionError();
}
export function canReadListing(profile: Profile | null, listing: Pick<Listing, 'seller_id' | 'status'>): boolean {
  return profile?.verification_status === 'approved' && (profile.role === 'admin' || listing.seller_id === profile.id || listing.status === 'active' || listing.status === 'sold');
}
