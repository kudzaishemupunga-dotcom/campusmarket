import type { Listing, Profile, PurchaseRequest, SellerGroup } from './types';

export class PermissionError extends Error {
  constructor(message = 'You do not have permission to do that.') {
    super(message);
    this.name = 'PermissionError';
  }
}

export function assertApproved(profile: Profile | null): asserts profile is Profile {
  if (!profile || profile.verification_status !== 'approved') {
    throw new PermissionError('Your school must approve your account first.');
  }
}

export function assertAdmin(profile: Profile | null): asserts profile is Profile {
  assertApproved(profile);
  if (profile.role !== 'admin') throw new PermissionError();
}

export function isApprovedSeller(profile: Profile | null): boolean {
  return Boolean(
    profile &&
      profile.verification_status === 'approved' &&
      (profile.seller_approved === true || profile.role === 'admin')
  );
}

export function assertApprovedSeller(profile: Profile | null): asserts profile is Profile {
  assertApproved(profile);
  if (!isApprovedSeller(profile)) {
    throw new PermissionError('School administrator approval is required before using seller tools.');
  }
}

export function assertOwner(profile: Profile | null, listing: Pick<Listing, 'seller_id'> | null): void {
  assertApproved(profile);
  if (!listing || listing.seller_id !== profile.id) throw new PermissionError();
}

export function isApprovedGroupMember(profile: Profile | null, group: Pick<SellerGroup, 'verification_status' | 'members'> | null | undefined): boolean {
  if (!profile || profile.verification_status !== 'approved' || !group || group.verification_status === 'removed') return false;
  return group.members.some((member) => member.user_id === profile.id && member.status === 'approved');
}

export function isGroupOwner(profile: Profile | null, group: Pick<SellerGroup, 'verification_status' | 'members'> | null | undefined): boolean {
  if (!profile || profile.verification_status !== 'approved' || !group || group.verification_status === 'removed') return false;
  return group.members.some(
    (member) => member.user_id === profile.id && member.status === 'approved' && member.member_role === 'owner'
  );
}

export function canManageGroupProducts(profile: Profile | null, group: Pick<SellerGroup, 'verification_status' | 'members'> | null | undefined): boolean {
  if (!profile || profile.verification_status !== 'approved' || !group || group.verification_status !== 'approved') return false;
  return group.members.some(
    (member) =>
      member.user_id === profile.id &&
      member.status === 'approved' &&
      (member.member_role === 'owner' || member.can_manage_products === true)
  );
}

export function canEditProduct(
  profile: Profile | null,
  listing: Pick<Listing, 'seller_id' | 'group_id'> | null,
  groups: Pick<SellerGroup, 'id' | 'verification_status' | 'members'>[] = []
): boolean {
  if (!profile || profile.verification_status !== 'approved' || !listing) return false;
  if (listing.group_id) {
    const group = groups.find((item) => item.id === listing.group_id);
    return canManageGroupProducts(profile, group);
  }
  return isApprovedSeller(profile) && listing.seller_id === profile.id;
}

export function assertCanEditProduct(
  profile: Profile | null,
  listing: Pick<Listing, 'seller_id' | 'group_id'> | null,
  groups: Pick<SellerGroup, 'id' | 'verification_status' | 'members'>[] = []
): asserts profile is Profile {
  assertApproved(profile);
  if (!canEditProduct(profile, listing, groups)) {
    throw new PermissionError('Only the approved seller or an authorized group collaborator may edit this product.');
  }
}

export function canManagePurchaseRequest(
  profile: Profile | null,
  request: Pick<PurchaseRequest, 'seller_id' | 'group_id'> | null,
  groups: Pick<SellerGroup, 'id' | 'verification_status' | 'members'>[] = []
): boolean {
  if (!profile || profile.verification_status !== 'approved' || !request) return false;
  if (profile.role === 'admin') return true;
  if (request.group_id) {
    return canManageGroupProducts(profile, groups.find((item) => item.id === request.group_id));
  }
  return isApprovedSeller(profile) && request.seller_id === profile.id;
}

export function canReadListing(
  profile: Profile | null,
  listing: Pick<Listing, 'seller_id' | 'status'> & { group_id?: string | null },
  groups: Pick<SellerGroup, 'id' | 'verification_status' | 'members'>[] = []
): boolean {
  if (!profile || profile.verification_status !== 'approved') return false;
  if (profile.role === 'admin' || listing.seller_id === profile.id) return true;
  if (listing.group_id && isApprovedGroupMember(profile, groups.find((item) => item.id === listing.group_id))) return true;
  if (listing.status !== 'active' && listing.status !== 'sold') return false;
  if (listing.group_id) {
    const group = groups.find((item) => item.id === listing.group_id);
    if (!group || group.verification_status !== 'approved') return false;
  }
  return true;
}
