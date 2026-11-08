export type Role = 'student' | 'admin';
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type SellerType = 'none' | 'individual' | 'group';
export type GroupStatus = 'pending' | 'approved' | 'rejected' | 'removed';
export type GroupRole = 'owner' | 'member';
export type MembershipStatus = 'invited' | 'requested' | 'approved' | 'removed';
export type ListingStatus = 'draft' | 'pending_review' | 'active' | 'sold' | 'removed';
export type ProductAvailability = 'available' | 'sold_out' | 'unavailable';
export type PurchaseRequestStatus = 'pending' | 'accepted' | 'declined' | 'fulfilled' | 'cancelled';
export type Condition = 'New' | 'Like New' | 'Good' | 'Fair';

export interface Profile {
  id: string;
  display_name: string;
  avatar_path: string | null;
  role: Role;
  verification_status: VerificationStatus;
  seller_type: SellerType;
  seller_approved: boolean;
  project_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  display_order: number;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  display_name: string;
  member_role: GroupRole;
  can_manage_products: boolean;
  status: MembershipStatus;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SellerGroup {
  id: string;
  name: string;
  slug: string;
  project_description: string;
  learning_area: string | null;
  image_path: string | null;
  created_by: string;
  creator_name: string;
  verification_status: GroupStatus;
  created_at: string;
  updated_at: string;
  members: GroupMember[];
}

export interface ListingImage {
  id: string;
  listing_id: string;
  storage_path: string;
  display_order: number;
  url?: string;
}

export interface Listing {
  id: string;
  seller_id: string;
  group_id: string | null;
  title: string;
  description: string;
  price: string;
  category_id: string;
  condition: Condition;
  status: ListingStatus;
  project_name: string | null;
  stock_quantity: number;
  availability: ProductAvailability;
  materials: string | null;
  dimensions: string | null;
  production_method: string | null;
  learning_area: string | null;
  made_to_order: boolean;
  created_by_admin: string | null;
  created_at: string;
  updated_at: string;
  images: ListingImage[];
  seller_name: string;
  group_name: string | null;
  group_slug: string | null;
}

export interface PurchaseRequest {
  id: string;
  buyer_id: string;
  buyer_name: string;
  listing_id: string;
  listing_title: string;
  listing_price: string;
  seller_id: string;
  seller_name: string;
  group_id: string | null;
  group_name: string | null;
  quantity: number;
  note: string | null;
  status: PurchaseRequestStatus;
  created_at: string;
  updated_at: string;
  fulfilled_at: string | null;
  fulfilled_by: string | null;
}

export interface Report {
  id: string;
  reporter_id: string;
  listing_id: string;
  reason: string;
  details: string;
  status: 'open' | 'resolved' | 'dismissed';
  created_at: string;
  resolved_at: string | null;
}

export interface ModerationEvent {
  id: string;
  actor_id: string | null;
  target_type: string;
  target_id: string;
  action: string;
  created_at: string;
}

export interface SchoolMemberOption {
  id: string;
  display_name: string;
}

export interface PageData {
  mode: 'supabase' | 'unconfigured';
  profile: Profile | null;
  listings: Listing[];
  categories: Category[];
  groups: SellerGroup[];
  purchaseRequests: PurchaseRequest[];
  savedIds: string[];
  profiles: Profile[];
  reports: Report[];
  events: ModerationEvent[];
  schoolMembers: SchoolMemberOption[];
  listingCount?: number;
  page?: number;
  pageSize?: number;
}

export type ActionName =
  | 'signup'
  | 'login'
  | 'logout'
  | 'forgot_password'
  | 'reset_password'
  | 'update_profile'
  | 'register_seller'
  | 'save_listing'
  | 'update_stock'
  | 'delete_listing'
  | 'mark_sold'
  | 'set_primary_image'
  | 'create_group'
  | 'update_group'
  | 'invite_group_member'
  | 'request_group_membership'
  | 'respond_group_invite'
  | 'manage_group_member'
  | 'submit_purchase_request'
  | 'update_purchase_request'
  | 'toggle_saved'
  | 'report_listing'
  | 'moderate_user'
  | 'set_seller_access'
  | 'moderate_group'
  | 'moderate_listing'
  | 'admin_create_product'
  | 'resolve_report';

export interface ActionResult {
  ok: boolean;
  message: string;
  id?: string;
  redirect?: string;
}
