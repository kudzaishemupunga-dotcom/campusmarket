import { z } from 'zod';

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const phonePattern = /(?:\+?263|07[1378])(?:[\s-]?\d){7,9}\b/;
export function containsContactInfo(value: string): boolean {
  return emailPattern.test(value) || phonePattern.test(value);
}

export const uuidSchema = z.string().uuid('Choose a valid item.');
export const displayNameSchema = z.string().trim().min(2, 'Use at least 2 characters.').max(60, 'Use 60 characters or fewer.').refine((value) => !/[<>\x00-\x1f]/.test(value), 'Use plain text for your display name.').refine((value) => !containsContactInfo(value), 'Do not include email addresses or phone numbers in your display name.');
export const emailSchema = z.string().trim().email('Enter a valid email address.').max(254);
export const passwordSchema = z.string().min(12, 'Use a password with at least 12 characters.').max(128, 'Use 128 characters or fewer.');
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password.').max(128) });
export const signupSchema = z.object({ email: emailSchema, password: passwordSchema, display_name: displayNameSchema });
export const listingSchema = z.object({
  id: uuidSchema.optional(),
  title: z.string().trim().min(4, 'Use at least 4 characters for the title.').max(100).refine((value) => !containsContactInfo(value), 'Keep email addresses and phone numbers out of listing titles.'),
  description: z.string().trim().min(20, 'Describe your item in at least 20 characters.').max(3000).refine((value) => !containsContactInfo(value), 'Keep email addresses and phone numbers out of listing descriptions.'),
  price: z.string().trim().regex(/^(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?$/, 'Enter a USD amount with at most two decimal places.').refine((value) => Number(value) >= 0.50 && Number(value) <= 5000, 'Price must be between $0.50 and $5,000.'),
  category_id: uuidSchema,
  condition: z.enum(['New', 'Like New', 'Good', 'Fair']),
  status: z.enum(['draft', 'pending_review']).default('pending_review'),
});
export const reportSchema = z.object({
  listing_id: uuidSchema,
  reason: z.enum(['Prohibited item', 'Misleading listing', 'Personal information', 'Other concern']),
  details: z.string().trim().min(10, 'Please add at least 10 characters.').max(1000),
});
export const userModerationSchema = z.object({ id: uuidSchema, status: z.enum(['approved', 'rejected', 'suspended']) });
export const listingModerationSchema = z.object({ id: uuidSchema, status: z.enum(['active', 'removed']) });
export const reportResolutionSchema = z.object({ id: uuidSchema, status: z.enum(['resolved', 'dismissed']) });

export function safeRedirect(value: unknown, fallback = '/pending-approval'): string {
  return value === '/reset-password' || value === '/pending-approval' || value === '/dashboard' ? value : fallback;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES = 5;
export function imageKind(bytes: Uint8Array): 'jpeg' | 'png' | 'webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return 'png';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'webp';
  return null;
}
export function validateImageHeader(bytes: Uint8Array, size: number, mime: string): void {
  if (!Number.isInteger(size) || size <= 0 || size > MAX_IMAGE_BYTES) throw new Error('Each image must be between 1 byte and 5 MB.');
  const kind = imageKind(bytes);
  if (!kind || mime !== `image/${kind}`) throw new Error('Choose a valid JPEG, PNG, or WebP image.');
}
