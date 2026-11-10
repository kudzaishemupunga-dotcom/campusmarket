import { describe, expect, it } from 'vitest';
import {
  adminProductSchema,
  displayNameSchema,
  emailSchema,
  groupCreateSchema,
  groupRespondSchema,
  imageKind,
  listingModerationSchema,
  listingSchema,
  loginSchema,
  MAX_IMAGE_BYTES,
  passwordSchema,
  purchaseRequestSchema,
  purchaseRequestStatusSchema,
  reportSchema,
  safeRedirect,
  sellerRegistrationSchema,
  sellerAccessSchema,
  signupSchema,
  stockUpdateSchema,
  userModerationSchema,
  validateImageHeader,
} from '@/lib/validation';

const categoryId = '10000000-0000-4000-8000-000000000001';
const ownerId = '20000000-0000-4000-8000-000000000001';

describe('explicit permission decision inputs', () => {
  it.each([undefined, null, '', 'yes', 'truthy', 1, 0, {}])('rejects an ambiguous approval or invitation decision: %j', (value) => {
    expect(sellerAccessSchema.safeParse({ id: ownerId, approved: value }).success).toBe(false);
    expect(groupRespondSchema.safeParse({ group_id: ownerId, accept: value }).success).toBe(false);
  });
  it('accepts explicit booleans and known HTML form boolean values', () => {
    expect(sellerAccessSchema.parse({ id: ownerId, approved: false }).approved).toBe(false);
    expect(sellerAccessSchema.parse({ id: ownerId, approved: 'true' }).approved).toBe(true);
    expect(groupRespondSchema.parse({ group_id: ownerId, accept: 'false' }).accept).toBe(false);
  });
});
const listing = {
  title: 'Solar study desk lamp',
  description: 'A rechargeable study lamp constructed during our Form 4 STEM practical project.',
  price: '12.50',
  stock_quantity: 4,
  availability: 'available',
  category_id: categoryId,
  condition: 'New',
  status: 'pending_review',
  project_name: 'Clean Energy Lab',
  learning_area: 'STEM, Robotics & Electronics',
};

describe('product listing input boundaries', () => {
  it('accepts valid USD amounts and integer stock quantities without float coercion', () => {
    const parsed = listingSchema.parse(listing);
    expect(parsed.price).toBe('12.50');
    expect(parsed.stock_quantity).toBe(4);
    expect(listingSchema.parse({ ...listing, price: '0.50', stock_quantity: '0' }).stock_quantity).toBe(0);
    expect(listingSchema.parse({ ...listing, price: '5000.00', stock_quantity: 10000 }).price).toBe('5000.00');
  });

  it.each(['-1', '0', '0.49', '5000.01', '10000', '1.001', '1e2', 'NaN', 'Infinity', '$5', '05', ''])(
    'rejects malformed or out-of-bounds price %s',
    (price) => {
      expect(listingSchema.safeParse({ ...listing, price }).success).toBe(false);
    }
  );

  it.each([-1, 1.5, 10001, 'abc'])('rejects invalid stock quantity %s', (stock_quantity) => {
    expect(listingSchema.safeParse({ ...listing, stock_quantity }).success).toBe(false);
    expect(stockUpdateSchema.safeParse({ id: categoryId, stock_quantity }).success).toBe(false);
  });

  it('does not let a seller approve their own product through a status field', () => {
    for (const status of ['active', 'sold', 'removed']) {
      expect(listingSchema.safeParse({ ...listing, status }).success).toBe(false);
    }
  });

  it('defaults new submissions to pending review, New condition, and 1 stock unit', () => {
    const parsed = listingSchema.parse({
      title: listing.title,
      description: listing.description,
      price: listing.price,
      category_id: listing.category_id,
    });
    expect(parsed.status).toBe('pending_review');
    expect(parsed.condition).toBe('New');
    expect(parsed.stock_quantity).toBe(1);
  });

  it('blocks student email addresses and phone numbers across all product and project fields', () => {
    expect(listingSchema.safeParse({ ...listing, title: 'Lamp email student@school.ac.zw' }).success).toBe(false);
    expect(listingSchema.safeParse({ ...listing, description: 'Handmade lamp, message me on +263 77 123 4567.' }).success).toBe(false);
    expect(listingSchema.safeParse({ ...listing, materials: 'Pine wood, call 0772 345 678 after class.' }).success).toBe(false);
  });
});

describe('seller, group, purchase request, and admin schemas', () => {
  it('validates seller registration pathways and project group creation', () => {
    expect(
      sellerRegistrationSchema.parse({
        seller_type: 'individual',
        project_summary: 'Designing hand-stitched textile satchels for Design & Technology.',
      }).seller_type
    ).toBe('individual');

    expect(
      groupCreateSchema.parse({
        name: 'Westgate Agro Processing Team',
        project_description: 'Producing dried orchard fruit packs from our agriculture practical plot.',
        learning_area: 'Agriculture & Food Production',
      }).name
    ).toBe('Westgate Agro Processing Team');

    expect(
      groupCreateSchema.safeParse({
        name: 'Team 0772 123 456',
        project_description: 'Producing dried orchard fruit packs from our agriculture practical plot.',
      }).success
    ).toBe(false);
  });

  it('validates safe purchase requests and blocks contact info in buyer notes', () => {
    expect(
      purchaseRequestSchema.parse({
        listing_id: categoryId,
        quantity: 2,
        note: 'Available to collect during Tuesday break supervision.',
      }).quantity
    ).toBe(2);

    expect(purchaseRequestSchema.safeParse({ listing_id: categoryId, quantity: 0 }).success).toBe(false);
    expect(
      purchaseRequestSchema.safeParse({
        listing_id: categoryId,
        quantity: 1,
        note: 'WhatsApp me on +263 77 999 0000',
      }).success
    ).toBe(false);
    expect(purchaseRequestStatusSchema.safeParse({ id: categoryId, status: 'fulfilled' }).success).toBe(true);
    expect(purchaseRequestStatusSchema.safeParse({ id: categoryId, status: 'pending' }).success).toBe(false);
  });

  it('validates admin verified product creation', () => {
    expect(
      adminProductSchema.parse({
        owner_id: ownerId,
        title: listing.title,
        description: listing.description,
        price: '15.00',
        stock_quantity: 3,
        category_id: categoryId,
      }).owner_id
    ).toBe(ownerId);
  });

  it('accepts signup details, preserves login compatibility, and enforces moderation schemas', () => {
    const input = { display_name: '  Test Learner  ', email: 'student@example.test', password: 'fictional-password-123' };
    expect(signupSchema.parse(input).display_name).toBe('Test Learner');
    expect(signupSchema.safeParse({ ...input, password: 'short' }).success).toBe(false);
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'student@example.test', password: 'older-pass' }).success).toBe(true);
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    expect(displayNameSchema.safeParse('<script>name</script>').success).toBe(false);
    expect(listingModerationSchema.safeParse({ id: categoryId, status: 'active' }).success).toBe(true);
    expect(listingModerationSchema.safeParse({ id: categoryId, status: 'sold' }).success).toBe(false);
    expect(userModerationSchema.safeParse({ id: categoryId, status: 'admin' }).success).toBe(false);
    expect(reportSchema.safeParse({ listing_id: categoryId, reason: 'Other concern', details: 'Please review this product.' }).success).toBe(true);
  });
});

describe('redirect restrictions', () => {
  it.each(['/reset-password', '/pending-approval', '/seller/dashboard', '/seller/register', '/marketplace'])(
    'allows intended destination %s',
    (path) => {
      expect(safeRedirect(path)).toBe(path);
    }
  );
  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    '/admin',
    '/seller/dashboard?next=https://evil.example',
    null,
    12,
  ])('rejects unsupported destination %s', (path) => {
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
