import { describe, expect, it } from 'vitest';
import {
  assertAdmin,
  assertApproved,
  assertApprovedSeller,
  assertCanEditProduct,
  assertOwner,
  canEditProduct,
  canManageGroupProducts,
  canManagePurchaseRequest,
  canReadListing,
  isApprovedGroupMember,
  isApprovedSeller,
  isGroupOwner,
  PermissionError,
} from '@/lib/permissions';
import type { ListingStatus, Profile, SellerGroup, VerificationStatus } from '@/lib/types';

const student: Profile = {
  id: '20000000-0000-4000-8000-000000000001',
  display_name: 'Test Learner',
  avatar_path: null,
  role: 'student',
  verification_status: 'approved',
  seller_type: 'individual',
  seller_approved: true,
  project_summary: 'Woodwork practical inquiry',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
const otherId = '20000000-0000-4000-8000-000000000002';
const groupId = '50000000-0000-4000-8000-000000000001';

const approvedGroup: SellerGroup = {
  id: groupId,
  name: 'Robotics Team',
  slug: 'robotics-team',
  project_description: 'Automated irrigation prototype',
  learning_area: 'STEM, Robotics & Electronics',
  image_path: null,
  created_by: otherId,
  creator_name: 'Group Lead',
  verification_status: 'approved',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  members: [
    {
      group_id: groupId,
      user_id: otherId,
      display_name: 'Group Lead',
      member_role: 'owner',
      status: 'approved',
      can_manage_products: true,
      invited_by: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      group_id: groupId,
      user_id: student.id,
      display_name: student.display_name,
      member_role: 'member',
      status: 'approved',
      can_manage_products: true,
      invited_by: otherId,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ],
};

describe('school membership boundary', () => {
  it('rejects an unauthenticated account', () => {
    expect(() => assertApproved(null)).toThrow(PermissionError);
    expect(canReadListing(null, { seller_id: otherId, status: 'active' })).toBe(false);
  });
  it.each<VerificationStatus>(['pending', 'rejected', 'suspended'])(
    'denies %s accounts even if they own a listing or have an admin role',
    (verification_status) => {
      const profile: Profile = { ...student, verification_status };
      expect(() => assertApproved(profile)).toThrow(PermissionError);
      expect(() => assertOwner(profile, { seller_id: profile.id })).toThrow(PermissionError);
      expect(() => assertAdmin({ ...profile, role: 'admin' })).toThrow(PermissionError);
      expect(canReadListing(profile, { seller_id: profile.id, status: 'active' })).toBe(false);
      expect(canReadListing({ ...profile, role: 'admin' }, { seller_id: otherId, status: 'pending_review' })).toBe(false);
    }
  );
});

describe('seller, group, and ownership boundaries', () => {
  it('does not make missing group eligibility public', () => {
    expect(canReadListing(student, { seller_id: otherId, group_id: groupId, status: 'active' })).toBe(false);
    expect(canReadListing(student, { seller_id: otherId, group_id: groupId, status: 'active' }, [{ ...approvedGroup, verification_status: 'removed', members: [] }])).toBe(false);
  });
  it('does not coerce malformed collaborator permission flags to true', () => {
    const malformedGroup = { ...approvedGroup, members: approvedGroup.members.map((member) => ({ ...member, can_manage_products: 'false' as unknown as boolean })) };
    expect(canManageGroupProducts(student, malformedGroup)).toBe(false);
  });
  it('requires seller_approved before independent product creation', () => {
    expect(isApprovedSeller({ ...student, seller_approved: false })).toBe(false);
    expect(() => assertApprovedSeller({ ...student, seller_approved: false })).toThrow(PermissionError);
    expect(isApprovedSeller(student)).toBe(true);
    expect(isApprovedSeller({ ...student, seller_approved: false, role: 'admin' })).toBe(true);
  });

  it('does not authorize students to approve users or access admin operations', () => {
    expect(() => assertAdmin(student)).toThrow(PermissionError);
    expect(() => assertAdmin({ ...student, role: 'admin' })).not.toThrow();
  });

  it('prevents User A from editing or deleting User B’s individual listing', () => {
    expect(() => assertOwner(student, { seller_id: otherId })).toThrow(PermissionError);
    expect(() => assertOwner(student, { seller_id: student.id })).not.toThrow();
    expect(() => assertCanEditProduct(student, { seller_id: otherId, group_id: null }, [])).toThrow(PermissionError);
  });

  it('grants collaborative editing only to approved group members with product rights in an approved group', () => {
    expect(isApprovedGroupMember(student, approvedGroup)).toBe(true);
    expect(isGroupOwner(student, approvedGroup)).toBe(false);
    expect(canManageGroupProducts(student, approvedGroup)).toBe(true);
    expect(canEditProduct({ ...student, seller_approved: false }, { seller_id: otherId, group_id: groupId }, [approvedGroup])).toBe(true);

    const pendingGroup: SellerGroup = { ...approvedGroup, verification_status: 'pending' };
    expect(canManageGroupProducts(student, pendingGroup)).toBe(false);

    const readOnlyGroup: SellerGroup = {
      ...approvedGroup,
      members: approvedGroup.members?.map((m) => (m.user_id === student.id ? { ...m, can_manage_products: false } : m)),
    };
    expect(canManageGroupProducts(student, readOnlyGroup)).toBe(false);
    expect(() => assertCanEditProduct(student, { seller_id: otherId, group_id: groupId }, [readOnlyGroup])).toThrow(PermissionError);
  });

  it('enforces purchase request management permissions across individual sellers, group members, and admins', () => {
    expect(canManagePurchaseRequest(student, { seller_id: student.id, group_id: null }, [])).toBe(true);
    expect(canManagePurchaseRequest(student, { seller_id: otherId, group_id: null }, [])).toBe(false);
    expect(canManagePurchaseRequest(student, { seller_id: otherId, group_id: groupId }, [approvedGroup])).toBe(true);
    expect(canManagePurchaseRequest({ ...student, role: 'admin' }, { seller_id: otherId, group_id: null }, [])).toBe(true);
  });

  it.each<ListingStatus>(['draft', 'pending_review', 'removed'])(
    'hides another seller’s %s listing from unrelated students while allowing group collaborators and admins',
    (status) => {
      expect(canReadListing(student, { seller_id: otherId, status })).toBe(false);
      expect(canReadListing(student, { seller_id: student.id, status })).toBe(true);
      expect(canReadListing(student, { seller_id: otherId, group_id: groupId, status }, [approvedGroup])).toBe(true);
      expect(canReadListing({ ...student, role: 'admin' }, { seller_id: otherId, status })).toBe(true);
    }
  );

  it.each<ListingStatus>(['active', 'sold'])('allows approved members to read a %s listing', (status) => {
    expect(canReadListing(student, { seller_id: otherId, status })).toBe(true);
  });
});
