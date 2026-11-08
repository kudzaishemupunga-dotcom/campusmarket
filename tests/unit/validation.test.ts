import { describe, expect, it } from 'vitest';
import {
  displayNameSchema, emailSchema, imageKind, listingModerationSchema, listingSchema,
  loginSchema, MAX_IMAGE_BYTES, passwordSchema, reportSchema, safeRedirect,
  signupSchema, userModerationSchema, validateImageHeader,
} from '@/lib/validation';

const categoryId = '10000000-0000-4000-8000-000000000001';
const listing = {
  title: 'Mathematics textbook', description: 'A clean mathematics textbook with all pages intact.',
  price: '8.00', category_id: categoryId, condition: 'Good', status: 'pending_review',
};

describe('listing input boundaries', () => {
  it('accepts valid USD amounts without converting the persisted representation to float', () => {
    expect(listingSchema.parse(listing).price).toBe('8.00');
    expect(listingSchema.parse({ ...listing, price: '0.50' }).price).toBe('0.50');
    expect(listingSchema.parse({ ...listing, price: '5000.00' }).price).toBe('5000.00');
  });
  it.each(['-1', '0', '0.49', '5000.01', '10000', '1.001', '1e2', 'NaN', 'Infinity', '$5', '05', ''])('rejects malformed or out-of-bounds price %s', (price) => {
    expect(listingSchema.safeParse({ ...listing, price }).success).toBe(false);
  });
  it('does not let a seller approve their own listing through a status field', () => {
    for (const status of ['active', 'sold', 'removed']) {
      expect(listingSchema.safeParse({ ...listing, status }).success).toBe(false);
    }
  });
  it('defaults new submissions to pending review and accepts explicit drafts', () => {
    const { status: _status, ...input } = listing;
    expect(listingSchema.parse(input).status).toBe('pending_review');
    expect(listingSchema.parse({ ...input, status: 'draft' }).status).toBe('draft');
  });
  it('rejects malformed identifiers, short descriptions and unrecognized conditions', () => {
    expect(listingSchema.safeParse({ ...listing, id: '../other-user' }).success).toBe(false);
    expect(listingSchema.safeParse({ ...listing, category_id: 'textbooks' }).success).toBe(false);
    expect(listingSchema.safeParse({ ...listing, description: 'Fine' }).success).toBe(false);
    expect(listingSchema.safeParse({ ...listing, condition: 'Perfect' }).success).toBe(false);
    expect(listingSchema.safeParse({ ...listing, title: 'x'.repeat(101) }).success).toBe(false);
    expect(listingSchema.safeParse({ ...listing, description: 'x'.repeat(3001) }).success).toBe(false);
  });
});

describe('account and moderation validation', () => {
  it('accepts signup details and enforces password length', () => {
    const input = { display_name: '  Demo Student  ', email: 'student@example.test', password: 'fictional-password-123' };
    expect(signupSchema.parse(input).display_name).toBe('Demo Student');
    expect(signupSchema.safeParse({ ...input, password: 'short' }).success).toBe(false);
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });
  it('does not weaken existing-user login by imposing a changed signup policy', () => {
    expect(loginSchema.safeParse({ email: 'student@example.test', password: 'older-pass' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'student@example.test', password: '' }).success).toBe(false);
  });
  it('rejects invalid email addresses and unsafe display names', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    expect(displayNameSchema.safeParse('<script>name</script>').success).toBe(false);
    expect(displayNameSchema.safeParse('A\u0000B').success).toBe(false);
  });
  it('limits moderation and report inputs to supported actions', () => {
    expect(listingModerationSchema.safeParse({ id: categoryId, status: 'active' }).success).toBe(true);
    expect(listingModerationSchema.safeParse({ id: categoryId, status: 'sold' }).success).toBe(false);
    expect(userModerationSchema.safeParse({ id: categoryId, status: 'admin' }).success).toBe(false);
    expect(reportSchema.safeParse({ listing_id: categoryId, reason: 'Other concern', details: 'Please review this product.' }).success).toBe(true);
    expect(reportSchema.safeParse({ listing_id: categoryId, reason: 'Whatever', details: 'Please review this product.' }).success).toBe(false);
  });
});

describe('redirect restrictions', () => {
  it.each(['/reset-password', '/pending-approval', '/dashboard'])('allows the intended destination %s', (path) => {
    expect(safeRedirect(path)).toBe(path);
  });
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/admin', '/dashboard?next=https://evil.example', null, 12])('rejects unsupported destination %s', (path) => {
    expect(safeRedirect(path)).toBe('/pending-approval');
  });
});

describe('upload file signatures', () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const webp = new TextEncoder().encode('RIFF0000WEBP');
  it('recognizes only supported image signatures', () => {
    expect(imageKind(jpeg)).toBe('jpeg');
    expect(imageKind(png)).toBe('png');
    expect(imageKind(webp)).toBe('webp');
    expect(imageKind(new TextEncoder().encode('<svg onload="alert(1)">'))).toBeNull();
    expect(imageKind(new TextEncoder().encode('GIF89a'))).toBeNull();
  });
  it('rejects content-type spoofing and empty/truncated headers', () => {
    expect(() => validateImageHeader(jpeg, 100, 'image/png')).toThrow();
    expect(() => validateImageHeader(new TextEncoder().encode('<html>'), 100, 'image/jpeg')).toThrow();
    expect(() => validateImageHeader(Uint8Array.from([0xff, 0xd8]), 100, 'image/jpeg')).toThrow();
  });
  it('enforces inclusive 5 MB limit and positive integer sizes', () => {
    expect(() => validateImageHeader(png, MAX_IMAGE_BYTES, 'image/png')).not.toThrow();
    for (const size of [0, -1, 1.5, MAX_IMAGE_BYTES + 1]) {
      expect(() => validateImageHeader(png, size, 'image/png')).toThrow();
    }
  });
});
