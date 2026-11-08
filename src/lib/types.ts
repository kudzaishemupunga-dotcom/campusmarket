export type Role = 'student' | 'admin';
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type ListingStatus = 'draft' | 'pending_review' | 'active' | 'sold' | 'removed';
export type Condition = 'New' | 'Like New' | 'Good' | 'Fair';
export interface Profile { id: string; display_name: string; avatar_path: string | null; role: Role; verification_status: VerificationStatus; created_at: string; updated_at: string }
export interface Category { id: string; name: string; slug: string; description: string; display_order: number }
export interface ListingImage { id: string; listing_id: string; storage_path: string; display_order: number; url?: string }
export interface Listing { id: string; seller_id: string; title: string; description: string; price: string; category_id: string; condition: Condition; status: ListingStatus; created_at: string; updated_at: string; images: ListingImage[]; seller_name: string }
export interface Report { id: string; reporter_id: string; listing_id: string; reason: string; details: string; status: 'open' | 'resolved' | 'dismissed'; created_at: string; resolved_at: string | null }
export interface ModerationEvent { id: string; actor_id: string; target_type: string; target_id: string; action: string; created_at: string }
export interface PageData { mode: 'demo' | 'supabase' | 'unconfigured'; profile: Profile | null; listings: Listing[]; categories: Category[]; savedIds: string[]; profiles: Profile[]; reports: Report[]; events: ModerationEvent[]; listingCount?: number; page?: number; pageSize?: number }
export type ActionName = 'signup' | 'login' | 'logout' | 'forgot_password' | 'reset_password' | 'save_listing' | 'delete_listing' | 'mark_sold' | 'toggle_saved' | 'report_listing' | 'update_profile' | 'moderate_user' | 'moderate_listing' | 'resolve_report';
export interface ActionResult { ok: boolean; message: string; id?: string; redirect?: string }
