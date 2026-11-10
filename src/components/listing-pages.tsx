'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  Clock3,
  Flag,
  Heart,
  ImagePlus,
  Layers,
  Pencil,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  canEditProduct,
  canManageGroupProducts,
  isApprovedGroupMember,
  isApprovedSeller,
} from '@/lib/permissions';
import type { Condition, Listing, ProductAvailability } from '@/lib/types';
import { MAX_IMAGES, listingSchema, validateImageHeader } from '@/lib/validation';
import {
  availabilityLabel,
  categoryIcons,
  Dialog,
  EmptyState,
  money,
  PageHeading,
  ProductCard,
  Status,
} from './ui';
import { useMarket } from './market-app';

export function ListingDetail({ id }: { id: string }) {
  const { data, mutate, busy } = useMarket();
  const listing = data.listings.find((l) => l.id === id);
  const [index, setIndex] = useState(0);
  const [report, setReport] = useState(false);
  const [qty, setQty] = useState(1);
  const [buyerNote, setBuyerNote] = useState('');

  if (!listing) {
    return (
      <EmptyState
        title="This project product is not available."
        text="It may have been removed or is currently awaiting school administrator review."
        href="/marketplace"
        action="Back to Marketplace"
      />
    );
  }

  const categoryIndex = data.categories.findIndex((c) => c.id === listing.category_id);
  const category = categoryIndex >= 0 ? data.categories[categoryIndex] : undefined;
  const CategoryIcon = categoryIcons[categoryIndex >= 0 ? categoryIndex % categoryIcons.length : 0];

  const editable = canEditProduct(data.profile, listing, data.groups);
  const listingGroup = listing.group_id ? data.groups.find((g) => g.id === listing.group_id) : undefined;
  const isOwnOrCollaborator =
    listing.seller_id === data.profile?.id ||
    Boolean(listingGroup && isApprovedGroupMember(data.profile, listingGroup));

  const saved = data.savedIds.includes(id);
  const related = data.listings
    .filter((l) => l.id !== id && l.status === 'active' && l.category_id === listing.category_id)
    .slice(0, 4);

  const myRequests = data.purchaseRequests.filter(
    (req) => req.listing_id === id && req.buyer_id === data.profile?.id
  );

  const maxRequestable = listing.made_to_order ? 50 : Math.max(1, listing.stock_quantity);
  const canRequestPurchase =
    !isOwnOrCollaborator &&
    listing.status === 'active' &&
    listing.availability === 'available' &&
    (listing.made_to_order || listing.stock_quantity > 0);

  const activeImage = listing.images[index] ?? listing.images[0];

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/marketplace">Marketplace</Link>
        <ChevronSeparator />
        {category && (
          <>
            <Link href={`/category/${category.slug}`}>{category.name}</Link>
            <ChevronSeparator />
          </>
        )}
        <span>{listing.title}</span>
      </nav>

      <div className="detail-grid">
        <div className="gallery">
          <div className="gallery-main">
            {activeImage?.url ? (
              <img src={activeImage.url} alt={listing.title} width="720" height="600" />
            ) : (
              <div className="photo-placeholder large">
                <CategoryIcon size={44} strokeWidth={1.4} />
                <strong>No photograph uploaded yet</strong>
                <span>Real student photographs appear here once uploaded.</span>
              </div>
            )}
            <span className={`gallery-condition stock-pill stock-${listing.availability}`}>
              {availabilityLabel(listing)}
            </span>
          </div>
          {listing.images.length > 1 && (
            <div className="gallery-thumbs">
              {listing.images.map((image, i) => (
                <button
                  type="button"
                  className={index === i ? 'selected' : ''}
                  key={image.id}
                  aria-label={`View image ${i + 1}`}
                  aria-pressed={index === i}
                  onClick={() => setIndex(i)}
                >
                  {image.url ? (
                    <img src={image.url} alt={`${listing.title}, view ${i + 1}`} width="96" height="74" />
                  ) : (
                    <span>Photo {i + 1}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-info">
          <div className="detail-category">
            <span>{category?.name || 'School Project'}</span>
            <div className="badge-cluster">
              <Status value={listing.status} />
              <Status value={listing.availability} />
            </div>
          </div>

          <h1>{listing.title}</h1>

          <div className="detail-price-row">
            <div className="detail-price">
              {money(listing.price)}
              <span>USD</span>
            </div>
            <div className="detail-stock-badge" data-testid="detail-stock">
              <Boxes size={16} />
              <span>
                {listing.made_to_order
                  ? `${listing.stock_quantity} ready · Made to order`
                  : `${listing.stock_quantity} unit${listing.stock_quantity === 1 ? '' : 's'} available`}
              </span>
            </div>
          </div>

          <div className="detail-meta">
            {listing.project_name && (
              <span>
                <Sparkles size={15} /> Project: <strong>{listing.project_name}</strong>
              </span>
            )}
            <span>
              <Clock3 size={15} /> Listed{' '}
              {new Date(listing.created_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>

          <div className="seller-panel">
            <span className="avatar">
              {(listing.group_name || listing.seller_name)
                .split(' ')
                .map((s) => s[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div>
              {listing.group_id && listing.group_name ? (
                <>
                  <strong>
                    {listing.group_slug ? (
                      <Link href={`/projects/${listing.group_slug}`}>{listing.group_name}</Link>
                    ) : (
                      listing.group_name
                    )}
                  </strong>
                  <span>
                    <Users size={13} /> Verified Project Group · Submitted by {listing.seller_name}
                  </span>
                </>
              ) : (
                <>
                  <strong>{listing.seller_name}</strong>
                  <span>
                    <User size={13} /> Individual Learner Seller · Wise Owl Westgate
                  </span>
                </>
              )}
              {listing.created_by_admin && (
                <small className="admin-attributed-note">
                  Entered and verified by School Administration
                </small>
              )}
            </div>
            <ShieldCheck size={22} className="brand-icon" />
          </div>

          <div className="detail-description">
            <h2>About this project product</h2>
            <p>{listing.description}</p>
          </div>

          {(listing.learning_area ||
            listing.materials ||
            listing.dimensions ||
            listing.production_method ||
            listing.made_to_order) && (
            <div className="project-specs">
              <h3>Project & build specifications</h3>
              <dl className="specs-grid">
                {listing.learning_area && (
                  <div>
                    <dt>Learning area</dt>
                    <dd>{listing.learning_area}</dd>
                  </div>
                )}
                {listing.materials && (
                  <div>
                    <dt>Materials used</dt>
                    <dd>{listing.materials}</dd>
                  </div>
                )}
                {listing.dimensions && (
                  <div>
                    <dt>Dimensions</dt>
                    <dd>{listing.dimensions}</dd>
                  </div>
                )}
                {listing.production_method && (
                  <div>
                    <dt>Production method</dt>
                    <dd>{listing.production_method}</dd>
                  </div>
                )}
                <div>
                  <dt>Production model</dt>
                  <dd>{listing.made_to_order ? 'Made to order on request' : 'Produced batch stock'}</dd>
                </div>
              </dl>
            </div>
          )}

          {editable ? (
            <div className="panel seller-manage-box">
              <h3>Manage your product</h3>
              <p className="muted">Update stock, edit project details, or review buyer requests from your dashboard.</p>
              <ListingActions listing={listing} />
            </div>
          ) : (
            <div className="purchase-panel" data-testid="purchase-request-panel">
              <div className="purchase-panel-head">
                <div>
                  <h3>Express Purchase Interest</h3>
                  <p className="muted">
                    No online payment is collected. Approved requests are fulfilled on campus under Wise Owl teacher or administrator supervision.
                  </p>
                </div>
                <button
                  type="button"
                  className={`button secondary small ${saved ? 'is-saved-btn' : ''}`}
                  disabled={busy}
                  onClick={() => void mutate('toggle_saved', { listing_id: id })}
                >
                  <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
                  {saved ? 'Saved' : 'Save'}
                </button>
              </div>

              {canRequestPurchase ? (
                <form
                  className="stack-form purchase-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await mutate('submit_purchase_request', {
                      listing_id: id,
                      quantity: qty,
                      note: buyerNote,
                    });
                    if (res.ok) {
                      setQty(1);
                      setBuyerNote('');
                    }
                  }}
                >
                  <div className="form-two">
                    <label>
                      Requested quantity
                      <input
                        type="number"
                        name="quantity"
                        aria-label="Requested quantity"
                        min={1}
                        max={maxRequestable}
                        value={qty}
                        onChange={(e) => setQty(Math.max(1, Number.parseInt(e.target.value || '1', 10) || 1))}
                        required
                      />
                      <small>
                        Estimated total: <strong>{money(Number(listing.price) * qty)} USD</strong>
                      </small>
                    </label>
                    <label>
                      Optional note for school handover
                      <input
                        type="text"
                        name="note"
                        aria-label="Optional note"
                        maxLength={500}
                        placeholder="e.g. Preferred colour or project question (no phone/email)"
                        value={buyerNote}
                        onChange={(e) => setBuyerNote(e.target.value)}
                      />
                      <small>Never include phone numbers, emails, or home addresses.</small>
                    </label>
                  </div>
                  <button type="submit" className="button primary wide" disabled={busy}>
                    <Send size={16} /> Submit Request
                  </button>
                </form>
              ) : isOwnOrCollaborator ? (
                <p className="muted">
                  You are associated with this seller workspace. View incoming buyer requests in{' '}
                  <Link href="/seller/dashboard" className="text-link">
                    Seller Dashboard
                  </Link>
                  .
                </p>
              ) : (
                <p className="muted">
                  {listing.availability === 'sold_out' || listing.status === 'sold'
                    ? 'All available units from this project batch have been fulfilled.'
                    : 'This product is currently marked unavailable for new purchase requests.'}
                </p>
              )}

              {myRequests.length > 0 && (
                <div className="my-product-requests">
                  <h4>Your submitted requests for this product</h4>
                  {myRequests.map((req) => (
                    <div key={req.id} className="mini-request-row" data-testid="buyer-request-item">
                      <div>
                        <strong>{req.quantity} unit{req.quantity === 1 ? '' : 's'}</strong> ·{' '}
                        <span>{new Date(req.created_at).toLocaleDateString('en-GB')}</span>
                      </div>
                      <Status value={req.status} />
                      {['pending', 'accepted'].includes(req.status) && (
                        <button
                          type="button"
                          className="button danger-quiet small"
                          disabled={busy}
                          onClick={() => void mutate('update_purchase_request', { id: req.id, status: 'cancelled' })}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="exchange-note">
            <ShieldCheck size={20} />
            <div>
              <strong>Safe, school-supervised coordination</strong>
              <p>
                Student phone numbers, private emails, and home locations are never exposed. Read the{' '}
                <Link href="/rules#exchanges" className="text-link">
                  supervised handover rules
                </Link>
                .
              </p>
            </div>
          </div>

          {!editable && (
            <button type="button" className="report-link" onClick={() => setReport(true)}>
              <Flag size={14} /> Report a concern with this listing
            </button>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="related-section">
          <div className="section-heading">
            <h2>More in {category?.name || 'this area'}</h2>
            {category && (
              <Link href={`/category/${category.slug}`}>
                View category <ArrowRight size={16} />
              </Link>
            )}
          </div>
          <div className="product-grid">
            {related.map((l) => (
              <ProductCard
                key={l.id}
                listing={l}
                categories={data.categories}
                saved={data.savedIds.includes(l.id)}
                onSave={() => void mutate('toggle_saved', { listing_id: l.id })}
              />
            ))}
          </div>
        </section>
      )}

      {report && (
        <Dialog title="Report this product listing" onClose={() => setReport(false)}>
          <p className="muted">Reports are private and reviewed only by Wise Owl administrators.</p>
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const values = new FormData(e.currentTarget);
              const result = await mutate('report_listing', {
                listing_id: id,
                reason: values.get('reason'),
                details: values.get('details'),
              });
              if (result.ok) setReport(false);
            }}
          >
            <label>
              Reason
              <select name="reason" aria-label="Reason" required>
                <option value="">Choose a reason</option>
                {['Prohibited item', 'Misleading listing', 'Personal information', 'Other concern'].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Details
              <textarea
                name="details"
                rows={4}
                minLength={10}
                maxLength={1000}
                required
                placeholder="Explain your concern without including personal phone numbers or emails."
              />
            </label>
            <div className="button-row">
              <button className="button primary" disabled={busy}>
                Submit report
              </button>
              <button type="button" className="button secondary" onClick={() => setReport(false)}>
                Cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}

function ChevronSeparator() {
  return <span aria-hidden="true">/</span>;
}

export function ListingActions({ listing }: { listing: Listing }) {
  const { mutate, busy } = useMarket();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [stockModal, setStockModal] = useState(false);
  const [stockQty, setStockQty] = useState(String(listing.stock_quantity));
  const [availability, setAvailability] = useState<ProductAvailability>(listing.availability);
  const router = useRouter();
  const canEdit = !['sold', 'removed'].includes(listing.status);

  return (
    <>
      <div className="listing-actions">
        {canEdit && (
          <Link className="button secondary small" href={`/seller/products/${listing.id}/edit`}>
            <Pencil size={14} /> Edit
          </Link>
        )}
        {canEdit && (
          <button
            type="button"
            className="button secondary small"
            disabled={busy}
            onClick={() => {
              setStockQty(String(listing.stock_quantity));
              setAvailability(listing.availability);
              setStockModal(true);
            }}
          >
            <Boxes size={14} /> Update Stock
          </button>
        )}
        {listing.status === 'draft' && (
          <button
            type="button"
            className="button primary small"
            disabled={busy}
            onClick={() =>
              void mutate('save_listing', {
                id: listing.id,
                group_id: listing.group_id,
                title: listing.title,
                description: listing.description,
                price: listing.price,
                stock_quantity: listing.stock_quantity,
                category_id: listing.category_id,
                condition: listing.condition,
                availability: listing.availability,
                project_name: listing.project_name,
                materials: listing.materials,
                dimensions: listing.dimensions,
                production_method: listing.production_method,
                learning_area: listing.learning_area,
                made_to_order: listing.made_to_order,
                status: 'pending_review',
              })
            }
          >
            Submit for Review
          </button>
        )}
        {listing.status === 'active' && (
          <button
            type="button"
            className="button secondary small"
            disabled={busy}
            onClick={() => void mutate('mark_sold', { id: listing.id })}
          >
            <Check size={14} /> Mark Sold
          </button>
        )}
        <button type="button" className="button danger-quiet small" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={14} /> Remove
        </button>
      </div>

      {stockModal && (
        <Dialog title={`Update stock · ${listing.title}`} onClose={() => setStockModal(false)}>
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await mutate('update_stock', {
                id: listing.id,
                stock_quantity: stockQty,
                availability,
              });
              if (res.ok) setStockModal(false);
            }}
          >
            <label>
              Quantity available
              <input
                type="number"
                aria-label="Quantity available"
                min={0}
                max={10000}
                step={1}
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                required
              />
            </label>
            <label>
              Availability status
              <select
                aria-label="Availability status"
                value={availability}
                onChange={(e) => setAvailability(e.target.value as ProductAvailability)}
              >
                <option value="available">Available</option>
                <option value="unavailable">Temporarily unavailable</option>
                <option value="sold_out">Sold out</option>
              </select>
            </label>
            <div className="button-row">
              <button type="submit" className="button primary" disabled={busy}>
                Save stock
              </button>
              <button type="button" className="button secondary" onClick={() => setStockModal(false)}>
                Cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {confirmDelete && (
        <Dialog title="Remove this product listing?" onClose={() => setConfirmDelete(false)}>
          <p>“{listing.title}” and its private photographs will be permanently removed.</p>
          <div className="button-row">
            <button
              type="button"
              className="button danger"
              disabled={busy}
              onClick={async () => {
                const result = await mutate('delete_listing', { id: listing.id });
                if (result.ok) {
                  setConfirmDelete(false);
                  router.push('/seller/products');
                }
              }}
            >
              Remove listing
            </button>
            <button type="button" className="button secondary" onClick={() => setConfirmDelete(false)}>
              Keep listing
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

type ListingFields = {
  group_id: string;
  title: string;
  project_name: string;
  description: string;
  price: string;
  stock_quantity: number;
  category_id: string;
  condition: Condition;
  availability: ProductAvailability;
  learning_area: string;
  materials: string;
  dimensions: string;
  production_method: string;
  made_to_order: boolean;
};

export function ListingForm({ id, initialGroupId }: { id?: string; initialGroupId?: string }) {
  const { data, mutate, busy } = useMarket();
  const router = useRouter();
  const existing = data.listings.find((l) => l.id === id);

  const permittedGroups = data.groups.filter((g) => canManageGroupProducts(data.profile, g));
  const canSellIndividually = isApprovedSeller(data.profile);
  const hasAnySellerPermission = canSellIndividually || permittedGroups.length > 0;

  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState(id);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const [preferredPrimaryId, setPreferredPrimaryId] = useState<string | null>(null);
  const [recoveryId, setRecoveryId] = useState<string | null>(null);

  const stagedPreviews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files]
  );

  useEffect(() => {
    return () => {
      stagedPreviews.forEach((entry) => URL.revokeObjectURL(entry.url));
    };
  }, [stagedPreviews]);

  const defaultGroupId = existing
    ? existing.group_id || ''
    : initialGroupId && permittedGroups.some((g) => g.id === initialGroupId)
      ? initialGroupId
      : !canSellIndividually && permittedGroups[0]
        ? permittedGroups[0].id
        : '';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ListingFields>({
    defaultValues: {
      group_id: defaultGroupId,
      title: existing?.title || '',
      project_name: existing?.project_name || '',
      description: existing?.description || '',
      price: existing?.price || '',
      stock_quantity: existing?.stock_quantity ?? 1,
      category_id: existing?.category_id || '',
      condition: existing?.condition || 'New',
      availability: existing?.availability || 'available',
      learning_area: existing?.learning_area || '',
      materials: existing?.materials || '',
      dimensions: existing?.dimensions || '',
      production_method: existing?.production_method || '',
      made_to_order: existing?.made_to_order ?? false,
    },
  });

  if (!id && !hasAnySellerPermission) {
    return (
      <>
        <Link href="/seller/dashboard" className="back-link">
          <ArrowLeft size={16} /> Back to Seller Portal
        </Link>
        <PageHeading
          eyebrow="SELLER APPROVAL REQUIRED"
          title="Activate your seller workspace first."
          description="Students need approved individual seller access or product permission inside an approved Wise Owl project group before listing products."
        />
        <EmptyState
          title="Register as an Individual or Group Seller."
          text="Submit your seller registration or open a collaborative project group so a school administrator can verify your project."
          href="/seller/register"
          action="Register as a Seller"
          secondaryHref="/seller/group"
          secondaryAction="Open Group Workspaces"
        />
      </>
    );
  }

  if (id && (!existing || !canEditProduct(data.profile, existing, data.groups))) {
    return (
      <EmptyState
        title="You cannot edit this product."
        text="Only the approved individual seller or a permitted project group collaborator can modify this listing."
        href="/seller/products"
        action="Back to My Products"
      />
    );
  }

  if (existing && ['sold', 'removed'].includes(existing.status)) {
    return (
      <>
        <PageHeading
          eyebrow="LISTING CLOSED"
          title="This product listing can no longer be edited."
          description="Sold and removed items are archived for audit accuracy."
        />
        <EmptyState
          title="Create a new listing for a new batch."
          text="Return to your products workspace to manage active items or submit a new project batch."
          href="/seller/products"
          action="My Products"
        />
      </>
    );
  }

  const remainingExistingImages = (existing?.images || []).filter((img) => !removedImages.includes(img.id));
  const activePrimaryExistingId = preferredPrimaryId ?? remainingExistingImages[0]?.id ?? null;

  function promoteStagedFile(idx: number) {
    if (idx <= 0) return;
    setFiles((prev) => {
      const chosen = prev[idx];
      return [chosen, ...prev.filter((_, i) => i !== idx)];
    });
  }

  async function submit(values: ListingFields, targetStatus: 'draft' | 'pending_review' = 'pending_review') {
    if (recoveryId) return;
    setSubmitting(true);
    setError('');
    let persistedId: string | undefined;
    try {
      const payload = {
        ...values,
        id: savedId,
        group_id: values.group_id || null,
        status: targetStatus,
      };
      const parsed = listingSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);

      if (remainingExistingImages.length + files.length > MAX_IMAGES) {
        throw new Error('Choose no more than five product photographs in total.');
      }
      for (const file of files) {
        validateImageHeader(new Uint8Array(await file.slice(0, 12).arrayBuffer()), file.size, file.type);
      }

      const staging = files.length > 0 || removedImages.length > 0 || Boolean(preferredPrimaryId);
      const result = await mutate('save_listing', {
        ...payload,
        status: staging ? 'draft' : targetStatus,
      });
      if (!result.ok) throw new Error(result.message);
      const listingId = result.id || savedId;
      if (!listingId) throw new Error('Product ID missing. Please refresh your seller dashboard.');
      setSavedId(listingId);
      persistedId = listingId;

      if (staging) {
        for (const imageId of removedImages) {
          const response = await fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listingId, imageId }),
          });
          const body = (await response.json()) as { message?: string };
          if (!response.ok) {
            throw new Error(body.message || 'Could not remove a photograph. Your draft is saved.');
          }
        }
        if (files.length) {
          const form = new FormData();
          form.set('id', listingId);
          files.forEach((file) => form.append('images', file));
          const response = await fetch('/api/upload', { method: 'POST', body: form });
          const body = (await response.json()) as { message?: string };
          if (!response.ok) {
            throw new Error(body.message || 'Photographs could not be uploaded. Your product draft is saved.');
          }
        }
        if (preferredPrimaryId && !removedImages.includes(preferredPrimaryId)) {
          const primaryResult = await mutate('set_primary_image', { listing_id: listingId, image_id: preferredPrimaryId });
          if (!primaryResult.ok) throw new Error(primaryResult.message);
        }
        if (targetStatus === 'pending_review') {
          const published = await mutate('save_listing', {
            ...payload,
            id: listingId,
            status: 'pending_review',
          });
          if (!published.ok) throw new Error(published.message);
        }
      }
      router.push('/seller/products');
    } catch (err) {
      // A multi-step image update may have partially succeeded. Reopen the saved
      // draft before retrying so files are not duplicated or deleted twice.
      if (persistedId) setRecoveryId(persistedId);
      setError(err instanceof Error ? err.message : 'Unable to save your product. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Link href="/seller/products" className="back-link">
        <ArrowLeft size={16} /> Back to My Products
      </Link>
      <PageHeading
        eyebrow="WISE OWL STUDENT PROJECT SUBMISSION"
        title={id ? 'Edit your project product.' : 'Submit a real school-project product.'}
        description={
          id
            ? 'Substantive changes to descriptions, specifications, prices, or photos return to school administration for review.'
            : 'Document the actual product created through your individual or group project. Never include fictional details or personal contact numbers.'
        }
      />

      <div className="form-layout">
        <form
          className="panel listing-form"
          onSubmit={handleSubmit((values) => submit(values, 'pending_review'))}
          noValidate
        >
          <h2>Project & seller attribution</h2>
          <p className="muted">Identify who produced this item and which school project it belongs to.</p>

          <div className="stack-form">
            <div className="form-two">
              <label>
                Selling workspace
                <select
                  aria-label="Selling workspace"
                  disabled={Boolean(existing)}
                  {...register('group_id')}
                >
                  {canSellIndividually && (
                    <option value="">Individual Seller ({data.profile?.display_name})</option>
                  )}
                  {permittedGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      Project Group · {group.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Project name
                <input
                  {...register('project_name')}
                  maxLength={120}
                  placeholder="e.g. Solar Study Lamp Prototype"
                />
              </label>
            </div>

            <div className="form-divider" />
            <h2>Product details</h2>

            <label>
              Product name
              <input
                {...register('title', {
                  required: 'Enter the actual product name.',
                  minLength: { value: 4, message: 'Use at least 4 characters.' },
                  maxLength: 100,
                })}
                placeholder="e.g. Hand-Crafted Hardwood Desk Organiser"
                aria-invalid={!!errors.title}
              />
              {errors.title && <span className="field-error">{errors.title.message}</span>}
            </label>

            <label>
              Product description
              <textarea
                {...register('description', {
                  required: 'Describe your product.',
                  minLength: { value: 20, message: 'Use at least 20 characters.' },
                  maxLength: 3000,
                })}
                rows={5}
                placeholder="Explain how your project product works, how learners built or tested it, and what a buyer receives."
                aria-invalid={!!errors.description}
              />
              {errors.description && <span className="field-error">{errors.description.message}</span>}
            </label>

            <div className="form-two">
              <label>
                Category
                <select
                  aria-label="Category"
                  {...register('category_id', { required: 'Choose a project category.' })}
                  aria-invalid={!!errors.category_id}
                >
                  <option value="">Choose a category</option>
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.category_id && <span className="field-error">{errors.category_id.message}</span>}
              </label>

              <label>
                Subject / learning area (optional)
                <input
                  {...register('learning_area')}
                  maxLength={100}
                  placeholder="e.g. Wood Technology & Design"
                />
              </label>
            </div>

            <div className="form-three">
              <label>
                Price (USD)
                <div className="price-input">
                  <span>$</span>
                  <input
                    aria-label="Price"
                    {...register('price', {
                      required: 'Add a USD price.',
                      pattern: {
                        value: /^\d+(?:\.\d{1,2})?$/,
                        message: 'Enter a valid USD amount (e.g. 12.50).',
                      },
                    })}
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-invalid={!!errors.price}
                  />
                  <span>USD</span>
                </div>
                {errors.price && <span className="field-error">{errors.price.message}</span>}
              </label>

              <label>
                Quantity available
                <input
                  type="number"
                  aria-label="Quantity available"
                  min={0}
                  max={10000}
                  step={1}
                  {...register('stock_quantity', { valueAsNumber: true })}
                />
              </label>

              <label>
                Availability
                <select aria-label="Availability" {...register('availability')}>
                  <option value="available">Available</option>
                  <option value="unavailable">Unavailable</option>
                  <option value="sold_out">Sold out</option>
                </select>
              </label>
            </div>

            <label className="checkbox-label">
              <input type="checkbox" {...register('made_to_order')} />
              <span>This product can be made to order upon an approved purchase request.</span>
            </label>

            <div className="form-divider" />
            <h2>Optional craft & engineering details</h2>
            <div className="form-two">
              <label>
                Materials used
                <input
                  {...register('materials')}
                  maxLength={500}
                  placeholder="e.g. Pine timber, beeswax finish, brass hinges"
                />
              </label>
              <label>
                Dimensions / size
                <input
                  {...register('dimensions')}
                  maxLength={160}
                  placeholder="e.g. 24 cm × 14 cm × 11 cm"
                />
              </label>
            </div>
            <label>
              Production method
              <input
                {...register('production_method')}
                maxLength={500}
                placeholder="e.g. Hand-joined in the Westgate Design workshop and sanded to 240-grit"
              />
            </label>

            <div className="form-divider" />
            <h2>Product photographs</h2>
            <p className="muted">
              Upload up to 5 real photographs of the actual item (JPEG, PNG, or WebP, max 5 MB each). Metadata is automatically stripped for student privacy.
            </p>

            <label className="upload-zone">
              <ImagePlus size={28} />
              <strong>Select product photographs</strong>
              <span>First photo is shown as the main cover image</span>
              <input
                type="file"
                aria-label="Product photographs"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => {
                  const chosen = Array.from(e.target.files || []);
                  if (chosen.length) setFiles((prev) => [...prev, ...chosen].slice(0, MAX_IMAGES));
                  setError('');
                  e.currentTarget.value = '';
                }}
              />
            </label>

            {remainingExistingImages.length > 0 && (
              <div className="photo-manager-grid">
                {remainingExistingImages.map((image) => {
                  const isMain = image.id === activePrimaryExistingId;
                  return (
                    <div key={image.id} className={`photo-manager-card ${isMain ? 'is-main' : ''}`}>
                      {image.url ? (
                        <img src={image.url} alt="Uploaded product photograph" width="140" height="105" />
                      ) : (
                        <div className="photo-placeholder small">Uploaded</div>
                      )}
                      <div className="photo-card-controls">
                        {isMain ? (
                          <span className="main-photo-pill">
                            <Star size={12} /> Main photo
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="button secondary tiny"
                            onClick={() => setPreferredPrimaryId(image.id)}
                          >
                            Set as main
                          </button>
                        )}
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Remove current image"
                          onClick={() => setRemovedImages([...removedImages, image.id])}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {stagedPreviews.length > 0 && (
              <div className="photo-manager-grid">
                {stagedPreviews.map((entry, i) => {
                  const isMain = remainingExistingImages.length === 0 && i === 0;
                  return (
                    <div key={`${entry.file.name}-${i}`} className={`photo-manager-card ${isMain ? 'is-main' : ''}`}>
                      <img src={entry.url} alt={entry.file.name} width="140" height="105" />
                      <div className="photo-card-controls">
                        {isMain ? (
                          <span className="main-photo-pill">
                            <Star size={12} /> Main photo
                          </span>
                        ) : remainingExistingImages.length === 0 ? (
                          <button
                            type="button"
                            className="button secondary tiny"
                            onClick={() => promoteStagedFile(i)}
                          >
                            Set as main
                          </button>
                        ) : (
                          <span className="muted-tiny">New upload</span>
                        )}
                        <button
                          type="button"
                          aria-label={`Remove ${entry.file.name}`}
                          className="icon-button"
                          onClick={() => setFiles(files.filter((_, j) => i !== j))}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {error && (
              <div className="form-error" role="alert">
                {error}
                {recoveryId && (
                  <p>
                    Your draft is saved. Reload its latest photos before trying again:{' '}
                    <a className="text-link" href={`/seller/products/${recoveryId}/edit`}>Reopen saved draft</a>.
                  </p>
                )}
              </div>
            )}

            <div className="form-footer">
              <Link className="button secondary" href="/seller/products">
                Cancel
              </Link>
              <button
                type="button"
                className="button secondary"
                disabled={submitting || busy || Boolean(recoveryId)}
                onClick={handleSubmit((values) => submit(values, 'draft'))}
              >
                Save draft
              </button>
              <button type="submit" className="button primary" disabled={submitting || busy || Boolean(recoveryId)}>
                {submitting ? 'Saving product…' : id ? 'Save & submit for approval' : 'Submit for approval'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </form>

        <aside className="form-aside">
          <div className="panel selling-tips">
            <Layers size={26} />
            <h3>Standards for Wise Owl project listings</h3>
            <ul>
              <li>Only list authentic products made or developed through your school project.</li>
              <li>Photograph the actual item in good natural light without faces or school IDs.</li>
              <li>Enter accurate USD pricing and real available stock quantities.</li>
              <li>Never include phone numbers, email addresses, or off-campus meetup spots.</li>
            </ul>
            <div className="aside-note">
              <ShieldCheck size={18} />
              <p>Every product is reviewed by a Wise Owl administrator before appearing in the catalog.</p>
            </div>
            <Link href="/rules" className="text-link">
              Read marketplace rules <ArrowRight size={14} />
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
