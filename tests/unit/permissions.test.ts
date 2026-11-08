import { describe, expect, it } from 'vitest';
import { assertAdmin, assertApproved, assertOwner, canReadListing, PermissionError } from '@/lib/permissions';
import type { ListingStatus, Profile, VerificationStatus } from '@/lib/types';

const student: Profile = {
  id: '20000000-0000-4000-8000-000000000001', display_name: 'Fictional Student', avatar_path: null,
  role: 'student', verification_status: 'approved', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};
const otherId = '20000000-0000-4000-8000-000000000002';

describe('school membership boundary', () => {
  it('rejects an unauthenticated account', () => {
    expect(() => assertApproved(null)).toThrow(PermissionError);
    expect(canReadListing(null, { seller_id: otherId, status: 'active' })).toBe(false);
  });
  it.each<VerificationStatus>(['pending', 'rejected', 'suspended'])('denies %s accounts even if they own a listing or have an admin role', (verification_status) => {
    const profile: Profile = { ...student, verification_status };
    expect(() => assertApproved(profile)).toThrow(PermissionError);
    expect(() => assertOwner(profile, { seller_id: profile.id })).toThrow(PermissionError);
    expect(() => assertAdmin({ ...profile, role: 'admin' })).toThrow(PermissionError);
    expect(canReadListing(profile, { seller_id: profile.id, status: 'active' })).toBe(false);
    expect(canReadListing({ ...profile, role: 'admin' }, { seller_id: otherId, status: 'pending_review' })).toBe(false);
  });
});

describe('role and ownership boundary', () => {
  it('does not authorize students to approve users or access admin operations', () => {
    expect(() => assertAdmin(student)).toThrow(PermissionError);
    expect(() => assertAdmin({ ...student, role: 'admin' })).not.toThrow();
  });
  it('prevents User A from editing or deleting User B’s listing', () => {
    expect(() => assertOwner(student, { seller_id: otherId })).toThrow(PermissionError);
    expect(() => assertOwner(student, { seller_id: student.id })).not.toThrow();
    expect(() => assertOwner(student, null)).toThrow(PermissionError);
  });
  it('does not grant administrators owner editing rights over another seller’s content', () => {
    expect(() => assertOwner({ ...student, role: 'admin' }, { seller_id: otherId })).toThrow(PermissionError);
  });
  it.each<ListingStatus>(['draft', 'pending_review', 'removed'])('hides another seller’s %s listing from approved students', (status) => {
    expect(canReadListing(student, { seller_id: otherId, status })).toBe(false);
    expect(canReadListing(student, { seller_id: student.id, status })).toBe(true);
    expect(canReadListing({ ...student, role: 'admin' }, { seller_id: otherId, status })).toBe(true);
  });
  it.each<ListingStatus>(['active', 'sold'])('allows approved members to read a %s listing', (status) => {
    expect(canReadListing(student, { seller_id: otherId, status })).toBe(true);
  });
});
