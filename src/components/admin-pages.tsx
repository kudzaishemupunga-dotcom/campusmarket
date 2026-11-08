'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Flag,
  ImagePlus,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Package,
  Plus,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type { ActionName } from '@/lib/types';
import { MAX_IMAGES, validateImageHeader } from '@/lib/validation';
import { availabilityLabel, Dialog, EmptyState, money, PageHeading, Status } from './ui';
import { useMarket } from './market-app';

type ConfirmState = {
  action: ActionName;
  payload: Record<string, unknown>;
  title: string;
  destructive?: boolean;
};

export function AdminPage({ path }: { path: string }) {
  const { data, mutate, busy } = useMarket();
  const router = useRouter();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [tabFilter, setTabFilter] = useState('all');
  const [showAdminCreate, setShowAdminCreate] = useState(false);
  const [adminFiles, setAdminFiles] = useState<File[]>([]);
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminError, setAdminError] = useState('');

  const section = path.split('/')[2] || 'overview';
  const pendingUsers = data.profiles.filter((p) => p.verification_status === 'pending');
  const sellerRequests = data.profiles.filter(
    (p) => p.verification_status === 'approved' && p.seller_type !== 'none' && !p.seller_approved
  );
  const pendingGroups = data.groups.filter((g) => g.verification_status === 'pending');
  const pendingProducts = data.listings.filter((l) => l.status === 'pending_review');
  const activeRequests = data.purchaseRequests.filter((r) => ['pending', 'accepted'].includes(r.status));
  const openReports = data.reports.filter((r) => r.status === 'open');

  const approvedProfiles = data.profiles.filter((p) => p.verification_status === 'approved');
  const approvedGroups = data.groups.filter((g) => g.verification_status === 'approved');

  return (
    <>
      <PageHeading
        eyebrow="WISE OWL WESTGATE · ADMINISTRATION"
        title={
          section === 'users'
            ? 'Student & Seller Verification.'
            : section === 'groups'
              ? 'Project Group Governance.'
              : section === 'products'
                ? 'Product Review & Verified Entry.'
                : section === 'requests'
                  ? 'Purchase Request Oversight.'
                  : section === 'reports'
                    ? 'Community Safety Reports.'
                    : 'Marketplace Operations Overview.'
        }
        description="Verify Wise Owl Westgate learners, approve collaborative project groups, moderate submitted goods, and oversee supervised campus exchanges."
      >
        {section === 'products' && (
          <button type="button" className="button primary" onClick={() => setShowAdminCreate(true)}>
            <Plus size={16} /> Publish Verified Product
          </button>
        )}
      </PageHeading>

      <nav className="page-tabs" aria-label="Administration navigation">
        {[
          ['overview', '/admin', 'Overview', LayoutDashboard],
          ['users', '/admin/users', 'Students & Sellers', Users],
          ['groups', '/admin/groups', 'Groups', BadgeCheck],
          ['products', '/admin/products', 'Products', ListChecks],
          ['requests', '/admin/requests', 'Requests', Inbox],
          ['reports', '/admin/reports', 'Reports', Flag],
        ].map(([key, href, label, Icon]) => {
          const TabIcon = Icon as typeof Users;
          return (
            <Link key={String(key)} className={section === key ? 'active' : ''} href={String(href)}>
              <TabIcon size={17} />
              {String(label)}
            </Link>
          );
        })}
      </nav>

      {section === 'overview' && (
        <>
          <div className="metrics-grid admin-metrics">
            {[
              ['Pending accounts', pendingUsers.length, '/admin/users', Users],
              ['Seller access queue', sellerRequests.length, '/admin/users', BadgeCheck],
              ['Pending groups', pendingGroups.length, '/admin/groups', Users],
              ['Products to review', pendingProducts.length, '/admin/products', Package],
              ['Open purchase requests', activeRequests.length, '/admin/requests', Inbox],
              ['Open reports', openReports.length, '/admin/reports', Flag],
            ].map(([label, count, href, Icon]) => {
              const MetricIcon = Icon as typeof Users;
              return (
                <Link href={String(href)} className="metric-card" key={String(label)}>
                  <span>
                    {String(label)}
                    <MetricIcon size={18} />
                  </span>
                  <strong>{Number(count)}</strong>
                  <small>
                    Open queue <ArrowRight size={13} />
                  </small>
                </Link>
              );
            })}
          </div>

          <div className="section-heading">
            <h2>Moderation & audit log</h2>
            <span className="muted">Immutable record of administrative actions</span>
          </div>
          {data.events.length ? (
            <div className="audit-list">
              {data.events.map((event) => (
                <div key={event.id}>
                  <span className="audit-icon">
                    <ShieldCheck size={17} />
                  </span>
                  <div>
                    <strong>{event.action.replaceAll('_', ' ')}</strong>
                    <span>
                      {event.target_type.replaceAll('_', ' ')} · {event.target_id.slice(0, 8)}
                    </span>
                  </div>
                  <time>{new Date(event.created_at).toLocaleString('en-GB')}</time>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No administrative decisions recorded yet."
              text="Student approvals, group verifications, product reviews, and report resolutions will appear here."
            />
          )}
        </>
      )}

      {section === 'users' && (
        <>
          <div className="section-heading">
            <h2>
              School Members <span className="count-pill">{data.profiles.length}</span>
            </h2>
            <label className="inline-select">
              Filter
              <select
                value={tabFilter}
                onChange={(e) => setTabFilter(e.target.value)}
                aria-label="Verification status"
              >
                <option value="all">All members</option>
                <option value="pending">Pending membership</option>
                <option value="seller_pending">Awaiting seller access</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
          </div>

          <div className="management-list">
            {data.profiles
              .filter((user) => {
                if (tabFilter === 'all') return true;
                if (tabFilter === 'seller_pending') {
                  return user.verification_status === 'approved' && user.seller_type !== 'none' && !user.seller_approved;
                }
                return user.verification_status === tabFilter;
              })
              .map((user) => (
                <article className="management-row user-row" key={user.id} data-testid="admin-user-row">
                  <span className="avatar">{user.display_name.slice(0, 1)}</span>
                  <div className="management-title">
                    <strong>{user.display_name}</strong>
                    <span>
                      {user.role} · Seller mode: {user.seller_type} · Joined{' '}
                      {new Date(user.created_at).toLocaleDateString('en-GB')}
                    </span>
                    {user.project_summary && (
                      <small className="request-note">Project: {user.project_summary}</small>
                    )}
                  </div>
                  <div className="badge-cluster">
                    <Status value={user.verification_status} />
                    {user.seller_approved ? (
                      <Status value="seller approved" />
                    ) : user.seller_type !== 'none' ? (
                      <Status value="seller requested" />
                    ) : null}
                  </div>
                  <div className="listing-actions">
                    {user.id === data.profile?.id ? (
                      <span className="muted">Your account</span>
                    ) : (
                      <>
                        {user.verification_status !== 'approved' && (
                          <button
                            type="button"
                            className="button primary small"
                            disabled={busy}
                            onClick={() =>
                              setConfirm({
                                action: 'moderate_user',
                                payload: { id: user.id, status: 'approved' },
                                title: `Approve ${user.display_name}?`,
                              })
                            }
                          >
                            <Check size={14} /> Approve
                          </button>
                        )}
                        {user.verification_status === 'approved' && !user.seller_approved && (
                          <button
                            type="button"
                            className="button primary small"
                            disabled={busy}
                            onClick={() =>
                              setConfirm({
                                action: 'set_seller_access',
                                payload: { id: user.id, approved: true },
                                title: `Grant seller access to ${user.display_name}?`,
                              })
                            }
                          >
                            Grant Seller
                          </button>
                        )}
                        {user.verification_status === 'approved' && user.seller_approved && user.role !== 'admin' && (
                          <button
                            type="button"
                            className="button secondary small"
                            disabled={busy}
                            onClick={() =>
                              setConfirm({
                                action: 'set_seller_access',
                                payload: { id: user.id, approved: false },
                                title: `Revoke seller access for ${user.display_name}?`,
                                destructive: true,
                              })
                            }
                          >
                            Revoke Seller
                          </button>
                        )}
                        {user.verification_status === 'pending' && (
                          <button
                            type="button"
                            className="button secondary small"
                            onClick={() =>
                              setConfirm({
                                action: 'moderate_user',
                                payload: { id: user.id, status: 'rejected' },
                                title: `Reject ${user.display_name}?`,
                                destructive: true,
                              })
                            }
                          >
                            Reject
                          </button>
                        )}
                        {user.verification_status === 'approved' && user.role !== 'admin' && (
                          <button
                            type="button"
                            className="button danger-quiet small"
                            onClick={() =>
                              setConfirm({
                                action: 'moderate_user',
                                payload: { id: user.id, status: 'suspended' },
                                title: `Suspend ${user.display_name}?`,
                                destructive: true,
                              })
                            }
                          >
                            Suspend
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </article>
              ))}
          </div>
        </>
      )}

      {section === 'groups' && (
        <>
          <div className="section-heading">
            <h2>
              Project Groups <span className="count-pill">{data.groups.length}</span>
            </h2>
            <label className="inline-select">
              Status
              <select
                value={tabFilter}
                onChange={(e) => setTabFilter(e.target.value)}
                aria-label="Group status"
              >
                <option value="all">All groups</option>
                {['pending', 'approved', 'rejected', 'removed'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {data.groups.length ? (
            <div className="stack-list">
              {data.groups
                .filter((g) => tabFilter === 'all' || g.verification_status === tabFilter)
                .map((group) => (
                  <article className="panel group-workspace-card" key={group.id} data-testid="admin-group-row">
                    <div className="group-card-head">
                      <div>
                        <div className="badge-cluster">
                          <Status value={group.verification_status} />
                          {group.learning_area && <span className="pill-subtle">{group.learning_area}</span>}
                        </div>
                        <h3>{group.name}</h3>
                        <p className="muted">{group.project_description}</p>
                        <small className="muted-tiny">
                          Created by {group.creator_name} on{' '}
                          {new Date(group.created_at).toLocaleDateString('en-GB')}
                        </small>
                      </div>
                      <div className="listing-actions">
                        {group.verification_status !== 'approved' && (
                          <button
                            type="button"
                            className="button primary small"
                            disabled={busy}
                            onClick={() =>
                              setConfirm({
                                action: 'moderate_group',
                                payload: { id: group.id, status: 'approved' },
                                title: `Approve project group “${group.name}”?`,
                              })
                            }
                          >
                            <Check size={14} /> Approve Group
                          </button>
                        )}
                        {group.verification_status === 'pending' && (
                          <button
                            type="button"
                            className="button secondary small"
                            disabled={busy}
                            onClick={() =>
                              setConfirm({
                                action: 'moderate_group',
                                payload: { id: group.id, status: 'rejected' },
                                title: `Reject project group “${group.name}”?`,
                                destructive: true,
                              })
                            }
                          >
                            Reject
                          </button>
                        )}
                        {group.verification_status !== 'removed' && (
                          <button
                            type="button"
                            className="button danger-quiet small"
                            disabled={busy}
                            onClick={() =>
                              setConfirm({
                                action: 'moderate_group',
                                payload: { id: group.id, status: 'removed' },
                                title: `Remove project group “${group.name}”?`,
                                destructive: true,
                              })
                            }
                          >
                            Remove Group
                          </button>
                        )}
                      </div>
                    </div>

                    {group.members.length > 0 && (
                      <div className="group-members-box">
                        <h4>Members & Membership Requests ({group.members.length})</h4>
                        <div className="member-rows">
                          {group.members.map((member) => (
                            <div className="member-row" key={member.user_id}>
                              <div>
                                <strong>{member.display_name}</strong>{' '}
                                <span className="muted-tiny">
                                  ({member.member_role === 'owner'
                                    ? 'Owner'
                                    : member.can_manage_products
                                      ? 'Product Editor'
                                      : 'Viewer'})
                                </span>
                              </div>
                              <div className="badge-cluster">
                                <Status value={member.status} />
                                {member.member_role !== 'owner' && (
                                  <>
                                    {member.status !== 'approved' && (
                                      <button
                                        type="button"
                                        className="button primary tiny"
                                        disabled={busy}
                                        onClick={() =>
                                          void mutate('manage_group_member', {
                                            group_id: group.id,
                                            user_id: member.user_id,
                                            status: 'approved',
                                            can_manage_products: true,
                                          })
                                        }
                                      >
                                        Approve Member
                                      </button>
                                    )}
                                    {member.status === 'approved' && (
                                      <button
                                        type="button"
                                        className="button secondary tiny"
                                        disabled={busy}
                                        onClick={() =>
                                          void mutate('manage_group_member', {
                                            group_id: group.id,
                                            user_id: member.user_id,
                                            status: 'approved',
                                            can_manage_products: !member.can_manage_products,
                                          })
                                        }
                                      >
                                        {member.can_manage_products ? 'Set View-Only' : 'Allow Products'}
                                      </button>
                                    )}
                                    {member.status !== 'removed' && (
                                      <button
                                        type="button"
                                        className="button danger-quiet tiny"
                                        disabled={busy}
                                        onClick={() =>
                                          void mutate('manage_group_member', {
                                            group_id: group.id,
                                            user_id: member.user_id,
                                            status: 'removed',
                                            can_manage_products: false,
                                          })
                                        }
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
            </div>
          ) : (
            <EmptyState
              title="No project groups submitted yet."
              text="Collaborative learner groups will appear here when created."
            />
          )}
        </>
      )}

      {section === 'products' && (
        <>
          <div className="section-heading">
            <h2>
              Product Submissions <span className="count-pill">{pendingProducts.length} pending</span>
            </h2>
            <label className="inline-select">
              Status
              <select
                value={tabFilter}
                onChange={(e) => setTabFilter(e.target.value)}
                aria-label="Moderation status"
              >
                <option value="all">All products</option>
                <option value="pending_review">Pending review</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="sold">Sold</option>
                <option value="removed">Removed</option>
              </select>
            </label>
          </div>

          {data.listings.length ? (
            <div className="management-list">
              {data.listings
                .filter((l) => tabFilter === 'all' || l.status === tabFilter)
                .map((l) => (
                  <article className="management-row" key={l.id} data-testid="admin-product-row">
                    <Link className="management-image" href={`/product/${l.id}`} tabIndex={-1} aria-hidden="true">
                      {l.images[0]?.url ? (
                        <img src={l.images[0].url} alt="" width="100" height="80" />
                      ) : (
                        <div className="photo-placeholder tiny">No photo</div>
                      )}
                    </Link>
                    <div className="management-title">
                      <Link href={`/product/${l.id}`}>{l.title}</Link>
                      <span>
                        {money(l.price)} USD · {availabilityLabel(l)} ·{' '}
                        {l.group_name ? `Group: ${l.group_name}` : l.seller_name}
                      </span>
                    </div>
                    <Status value={l.status} />
                    <div className="listing-actions">
                      {l.status === 'pending_review' && (
                        <button
                          type="button"
                          className="button primary small"
                          disabled={busy}
                          onClick={() =>
                            setConfirm({
                              action: 'moderate_listing',
                              payload: { id: l.id, status: 'active' },
                              title: `Approve “${l.title}” for the marketplace?`,
                            })
                          }
                        >
                          <Check size={14} /> Approve
                        </button>
                      )}
                      {['pending_review', 'active', 'sold'].includes(l.status) && (
                        <button
                          type="button"
                          className="button danger-quiet small"
                          onClick={() =>
                            setConfirm({
                              action: 'moderate_listing',
                              payload: { id: l.id, status: 'removed' },
                              title: `${l.status === 'pending_review' ? 'Reject' : 'Remove'} “${l.title}”?`,
                              destructive: true,
                            })
                          }
                        >
                          {l.status === 'pending_review' ? 'Reject' : 'Remove'}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
            </div>
          ) : (
            <EmptyState
              title="No products submitted yet."
              text="Student and group submissions will appear here for review, or an authorized administrator can publish an actual verified project product."
            />
          )}
        </>
      )}

      {section === 'requests' && (
        <>
          <div className="section-heading">
            <h2>
              Purchase Requests <span className="count-pill">{data.purchaseRequests.length}</span>
            </h2>
            <label className="inline-select">
              Status
              <select
                value={tabFilter}
                onChange={(e) => setTabFilter(e.target.value)}
                aria-label="Request status"
              >
                <option value="all">All requests</option>
                {['pending', 'accepted', 'fulfilled', 'declined', 'cancelled'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {data.purchaseRequests.length ? (
            <div className="management-list">
              {data.purchaseRequests
                .filter((r) => tabFilter === 'all' || r.status === tabFilter)
                .map((req) => (
                  <article className="management-row request-row" key={req.id}>
                    <div className="management-title">
                      <Link href={`/product/${req.listing_id}`}>{req.listing_title}</Link>
                      <span>
                        Buyer: <strong>{req.buyer_name}</strong> → Seller:{' '}
                        <strong>{req.group_name || req.seller_name}</strong> · Qty: <strong>{req.quantity}</strong> (
                        {money(Number(req.listing_price) * req.quantity)} USD)
                      </span>
                      {req.note && <small className="request-note">Note: “{req.note}”</small>}
                    </div>
                    <Status value={req.status} />
                    {['pending', 'accepted'].includes(req.status) ? (
                      <div className="listing-actions">
                        {req.status === 'pending' && (
                          <button
                            type="button"
                            className="button secondary small"
                            disabled={busy}
                            onClick={() =>
                              void mutate('update_purchase_request', { id: req.id, status: 'accepted' })
                            }
                          >
                            Accept
                          </button>
                        )}
                        <button
                          type="button"
                          className="button primary small"
                          disabled={busy}
                          onClick={() =>
                            void mutate('update_purchase_request', { id: req.id, status: 'fulfilled' })
                          }
                        >
                          Fulfill
                        </button>
                        <button
                          type="button"
                          className="button danger-quiet small"
                          disabled={busy}
                          onClick={() =>
                            void mutate('update_purchase_request', { id: req.id, status: 'declined' })
                          }
                        >
                          Decline
                        </button>
                      </div>
                    ) : (
                      <span className="muted">Closed</span>
                    )}
                  </article>
                ))}
            </div>
          ) : (
            <EmptyState
              title="No purchase requests recorded yet."
              text="Supervised buyer interest requests will appear here."
            />
          )}
        </>
      )}

      {section === 'reports' &&
        (data.reports.length ? (
          <div className="reports-grid">
            {data.reports.map((report) => (
              <article key={report.id} className="panel report-card">
                <div className="section-heading">
                  <span className="report-category">
                    <Flag size={17} />
                    {report.reason}
                  </span>
                  <Status value={report.status} />
                </div>
                <h2>
                  <Link href={`/product/${report.listing_id}`}>
                    {data.listings.find((l) => l.id === report.listing_id)?.title || 'Reported product'}
                  </Link>
                </h2>
                <p>{report.details}</p>
                <span className="muted">Reported {new Date(report.created_at).toLocaleDateString('en-GB')}</span>
                {report.status === 'open' && (
                  <div className="button-row">
                    <button
                      type="button"
                      className="button primary small"
                      onClick={() =>
                        setConfirm({
                          action: 'resolve_report',
                          payload: { id: report.id, status: 'resolved' },
                          title: 'Mark this report resolved?',
                        })
                      }
                    >
                      Resolve report
                    </button>
                    <button
                      type="button"
                      className="button secondary small"
                      onClick={() =>
                        setConfirm({
                          action: 'resolve_report',
                          payload: { id: report.id, status: 'dismissed' },
                          title: 'Dismiss this report?',
                        })
                      }
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      className="button danger-quiet small"
                      onClick={() =>
                        setConfirm({
                          action: 'moderate_listing',
                          payload: { id: report.listing_id, status: 'removed' },
                          title: 'Remove the reported product?',
                          destructive: true,
                        })
                      }
                    >
                      Remove product
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No community reports right now."
            text="Submitted safety or content reports from school members will appear here."
          />
        ))}

      {confirm && (
        <Dialog title={confirm.title} onClose={() => setConfirm(null)}>
          <p>
            This administrative action will be permanently recorded in the school moderation audit history.
          </p>
          <div className="button-row">
            <button
              type="button"
              className={`button ${confirm.destructive ? 'danger' : 'primary'}`}
              disabled={busy}
              onClick={async () => {
                const result = await mutate(confirm.action, confirm.payload);
                if (result.ok) setConfirm(null);
              }}
            >
              Confirm decision
            </button>
            <button type="button" className="button secondary" onClick={() => setConfirm(null)}>
              Cancel
            </button>
          </div>
        </Dialog>
      )}

      {showAdminCreate && (
        <Dialog
          title="Publish Actual Verified School-Project Product"
          onClose={() => {
            setShowAdminCreate(false);
            setAdminFiles([]);
            setAdminError('');
          }}
        >
          <p className="muted">
            Use only for real, physically verified Wise Owl learner or group products with explicit school authorization. Never enter fictional items.
          </p>
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setAdminSubmitting(true);
              setAdminError('');
              try {
                const form = new FormData(e.currentTarget);
                for (const f of adminFiles) {
                  validateImageHeader(new Uint8Array(await f.slice(0, 12).arrayBuffer()), f.size, f.type);
                }
                const res = await mutate('admin_create_product', {
                  owner_id: form.get('owner_id'),
                  group_id: form.get('group_id') || null,
                  title: form.get('title'),
                  description: form.get('description'),
                  price: form.get('price'),
                  stock_quantity: form.get('stock_quantity'),
                  category_id: form.get('category_id'),
                  project_name: form.get('project_name'),
                  learning_area: form.get('learning_area'),
                  materials: form.get('materials'),
                  dimensions: form.get('dimensions'),
                  production_method: form.get('production_method'),
                  made_to_order: form.get('made_to_order') === 'on',
                });
                if (!res.ok || !res.id) throw new Error(res.message);
                if (adminFiles.length > 0) {
                  const uploadForm = new FormData();
                  uploadForm.set('id', res.id);
                  adminFiles.forEach((f) => uploadForm.append('images', f));
                  const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadForm });
                  if (!uploadRes.ok) {
                    const body = (await uploadRes.json()) as { message?: string };
                    throw new Error(body.message || 'Product published, but photograph upload failed.');
                  }
                }
                setShowAdminCreate(false);
                setAdminFiles([]);
                router.refresh();
              } catch (err) {
                setAdminError(err instanceof Error ? err.message : 'Could not publish product.');
              } finally {
                setAdminSubmitting(false);
              }
            }}
          >
            <div className="form-two">
              <label>
                Attributed student / staff profile
                <select name="owner_id" aria-label="Attributed student" defaultValue={data.profile?.id} required>
                  {approvedProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name} ({p.role})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Attributed project group (optional)
                <select name="group_id" aria-label="Attributed project group" defaultValue="">
                  <option value="">Individual learner project</option>
                  {approvedGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-two">
              <label>
                Product name
                <input name="title" minLength={4} maxLength={100} required />
              </label>
              <label>
                Project name
                <input name="project_name" maxLength={120} />
              </label>
            </div>
            <label>
              Description
              <textarea name="description" rows={3} minLength={20} maxLength={3000} required />
            </label>
            <div className="form-three">
              <label>
                Category
                <select name="category_id" aria-label="Product category" required>
                  <option value="">Select category</option>
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Price (USD)
                <input name="price" inputMode="decimal" placeholder="10.00" required />
              </label>
              <label>
                Quantity
                <input name="stock_quantity" type="number" min={0} max={10000} defaultValue={1} required />
              </label>
            </div>
            <div className="form-two">
              <label>
                Learning area
                <input name="learning_area" maxLength={100} />
              </label>
              <label>
                Materials
                <input name="materials" maxLength={500} />
              </label>
            </div>
            <label className="upload-zone compact">
              <ImagePlus size={20} />
              <span>Attach verified product photos (optional, up to 5)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => setAdminFiles(Array.from(e.target.files || []).slice(0, MAX_IMAGES))}
              />
            </label>
            {adminFiles.length > 0 && (
              <div className="badge-cluster">
                {adminFiles.map((f, idx) => (
                  <span key={`${f.name}-${idx}`} className="pill-subtle">
                    {f.name}{' '}
                    <button
                      type="button"
                      className="icon-inline"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => setAdminFiles(adminFiles.filter((_, j) => j !== idx))}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {adminError && (
              <p className="form-error" role="alert">
                {adminError}
              </p>
            )}
            <div className="button-row">
              <button type="submit" className="button primary" disabled={adminSubmitting || busy}>
                {adminSubmitting ? 'Publishing…' : 'Publish Verified Product'}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setShowAdminCreate(false);
                  setAdminFiles([]);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
