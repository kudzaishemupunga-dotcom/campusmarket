import { z } from 'zod';

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const phonePattern = /(?:\+?263|07[1378])(?:[\s-]?\d){7,9}\b/;
export function containsContactInfo(value: string): boolean {
  return emailPattern.test(value) || phonePattern.test(value);
}

const safePlainText = (label: string) =>
  z
    .string()
    .refine((value) => !/[<>\x00-\x1f]/.test(value), `Use plain text for ${label}.`)
    .refine((value) => !containsContactInfo(value), `Do not include email addresses or phone numbers in ${label}.`);

function optionalSafeText(max: number, label: string, min = 1) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value == null ? null : value),
    safePlainText(label)
      .transform((value) => value.trim())
      .pipe(z.string().min(min, `Use at least ${min} characters for ${label}.`).max(max, `Use ${max} characters or fewer for ${label}.`))
      .nullable()
      .default(null)
  );
}

const nonNegativeStockSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === '') return 1;
    if (typeof value === 'string' && /^\d{1,5}$/.test(value.trim())) return Number.parseInt(value.trim(), 10);
    return value;
  },
  z.number({ message: 'Enter a whole-number stock quantity.' }).int('Stock quantity must be a whole number.').min(0, 'Stock quantity cannot be negative.').max(10000, 'Stock quantity must be 10,000 or fewer.')
);

const strictStockSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string' && /^\d{1,5}$/.test(value.trim())) return Number.parseInt(value.trim(), 10);
    return value;
  },
  z.number({ message: 'Enter a whole-number stock quantity.' }).int('Stock quantity must be a whole number.').min(0, 'Stock quantity cannot be negative.').max(10000, 'Stock quantity must be 10,000 or fewer.')
);

const booleanFieldSchema = z.preprocess(
  (value) => value === true || value === 'true' || value === 'on' || value === '1',
  z.boolean()
);

export function slugifyGroupName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

export const uuidSchema = z.string().uuid('Choose a valid item.');
export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters.')
  .max(60, 'Use 60 characters or fewer.')
  .refine((value) => !/[<>\x00-\x1f]/.test(value), 'Use plain text for your display name.')
  .refine((value) => !containsContactInfo(value), 'Do not include email addresses or phone numbers in your display name.');

export const emailSchema = z.string().trim().email('Enter a valid email address.').max(254);
export const passwordSchema = z.string().min(12, 'Use a password with at least 12 characters.').max(128, 'Use 128 characters or fewer.');
export const sellerTypeSchema = z.enum(['none', 'individual', 'group']);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(128),
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  display_name: displayNameSchema,
  seller_type: sellerTypeSchema.optional().default('none'),
  project_summary: optionalSafeText(500, 'your project summary', 4),
});

export const profileUpdateSchema = z.object({
  display_name: displayNameSchema,
  seller_type: sellerTypeSchema.optional(),
  project_summary: optionalSafeText(500, 'your project summary', 4),
});

export const sellerRegistrationSchema = z.object({
  seller_type: z.enum(['individual', 'group'], { message: 'Choose individual or group seller registration.' }),
  project_summary: safePlainText('your project summary')
    .transform((value) => value.trim())
    .pipe(z.string().min(10, 'Briefly describe your school project in at least 10 characters.').max(500, 'Keep your project summary within 500 characters.')),
});

const optionalUuidSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value ?? null),
  uuidSchema.nullable().default(null)
);

export const priceSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?$/, 'Enter a USD amount with at most two decimal places.')
  .refine((value) => Number(value) >= 0.50 && Number(value) <= 5000, 'Price must be between $0.50 and $5,000.');

export const listingSchema = z.object({
  id: uuidSchema.optional(),
  group_id: optionalUuidSchema,
  title: z
    .string()
    .trim()
    .min(4, 'Use at least 4 characters for the product name.')
    .max(100, 'Keep the product name within 100 characters.')
    .refine((value) => !/[<>\x00-\x1f]/.test(value), 'Use plain text for the product name.')
    .refine((value) => !containsContactInfo(value), 'Keep email addresses and phone numbers out of product titles.'),
  description: z
    .string()
    .trim()
    .min(20, 'Describe your product in at least 20 characters.')
    .max(3000, 'Keep the description within 3,000 characters.')
    .refine((value) => !containsContactInfo(value), 'Keep email addresses and phone numbers out of product descriptions.'),
  price: priceSchema,
  stock_quantity: nonNegativeStockSchema,
  category_id: uuidSchema,
  condition: z.enum(['New', 'Like New', 'Good', 'Fair']).default('New'),
  availability: z.enum(['available', 'sold_out', 'unavailable']).default('available'),
  project_name: optionalSafeText(120, 'the project name', 2),
  materials: optionalSafeText(500, 'materials used', 2),
  dimensions: optionalSafeText(160, 'dimensions', 2),
  production_method: optionalSafeText(500, 'production method', 2),
  learning_area: optionalSafeText(100, 'learning area', 2),
  made_to_order: booleanFieldSchema.default(false),
  status: z.enum(['draft', 'pending_review']).default('pending_review'),
});

export const stockUpdateSchema = z.object({
  id: uuidSchema,
  stock_quantity: strictStockSchema,
  availability: z.enum(['available', 'sold_out', 'unavailable']).optional(),
});

export const primaryImageSchema = z.object({
  listing_id: uuidSchema,
  image_id: uuidSchema,
});

export const groupCreateSchema = z.object({
  name: safePlainText('the group name')
    .transform((value) => value.trim())
    .pipe(z.string().min(3, 'Use at least 3 characters for the group name.').max(80, 'Use 80 characters or fewer.')),
  project_description: safePlainText('the project description')
    .transform((value) => value.trim())
    .pipe(z.string().min(20, 'Describe the collaborative project in at least 20 characters.').max(2000, 'Keep the description within 2,000 characters.')),
  learning_area: optionalSafeText(100, 'learning area', 2),
});

export const groupUpdateSchema = groupCreateSchema.extend({
  id: uuidSchema,
});

export const groupInviteSchema = z.object({
  group_id: uuidSchema,
  user_id: uuidSchema,
  can_manage_products: booleanFieldSchema.default(false),
});

export const groupRespondSchema = z.object({
  group_id: uuidSchema,
  accept: booleanFieldSchema,
});

export const groupMemberManageSchema = z.object({
  group_id: uuidSchema,
  user_id: uuidSchema,
  status: z.enum(['approved', 'removed']),
  can_manage_products: booleanFieldSchema.default(false),
});

export const purchaseRequestSchema = z.object({
  listing_id: uuidSchema,
  quantity: z.preprocess(
    (value) => (typeof value === 'string' && /^\d{1,3}$/.test(value.trim()) ? Number.parseInt(value.trim(), 10) : value),
    z.number({ message: 'Choose a valid quantity.' }).int('Quantity must be a whole number.').min(1, 'Request at least 1 unit.').max(500, 'Request 500 units or fewer.')
  ),
  note: optionalSafeText(500, 'your note', 2),
});

export const purchaseRequestStatusSchema = z.object({
  id: uuidSchema,
  status: z.enum(['accepted', 'declined', 'fulfilled', 'cancelled']),
});

export const reportSchema = z.object({
  listing_id: uuidSchema,
  reason: z.enum(['Prohibited item', 'Misleading listing', 'Personal information', 'Other concern']),
  details: z
    .string()
    .trim()
    .min(10, 'Please add at least 10 characters.')
    .max(1000)
    .refine((value) => !containsContactInfo(value), 'Do not share personal email addresses or phone numbers in reports.'),
});

export const userModerationSchema = z.object({ id: uuidSchema, status: z.enum(['approved', 'rejected', 'suspended']) });
export const sellerAccessSchema = z.object({ id: uuidSchema, approved: booleanFieldSchema });
export const groupModerationSchema = z.object({ id: uuidSchema, status: z.enum(['approved', 'rejected', 'removed']) });
export const listingModerationSchema = z.object({ id: uuidSchema, status: z.enum(['active', 'removed']) });
export const reportResolutionSchema = z.object({ id: uuidSchema, status: z.enum(['resolved', 'dismissed']) });

export const adminProductSchema = z.object({
  owner_id: uuidSchema,
  group_id: optionalUuidSchema,
  title: listingSchema.shape.title,
  description: listingSchema.shape.description,
  price: priceSchema,
  stock_quantity: strictStockSchema,
  category_id: uuidSchema,
  project_name: optionalSafeText(120, 'the project name', 2),
  materials: optionalSafeText(500, 'materials used', 2),
  dimensions: optionalSafeText(160, 'dimensions', 2),
  production_method: optionalSafeText(500, 'production method', 2),
  learning_area: optionalSafeText(100, 'learning area', 2),
  made_to_order: booleanFieldSchema.default(false),
});

const allowedRedirects = new Set([
  '/',
  '/reset-password',
  '/pending-approval',
  '/dashboard',
  '/seller/dashboard',
  '/seller/register',
  '/seller/products',
  '/seller/products/new',
  '/seller/group',
  '/marketplace',
  '/projects',
  '/account',
]);
export function safeRedirect(value: unknown, fallback = '/pending-approval'): string {
  return typeof value === 'string' && allowedRedirects.has(value) ? value : fallback;
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
