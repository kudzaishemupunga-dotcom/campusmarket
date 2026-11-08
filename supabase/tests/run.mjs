import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
const sql = async (source, parameters) => parameters ? db.query(source, parameters) : db.exec(source);
const read = async (name) => readFile(new URL(name, import.meta.url), 'utf8');
let passed = 0;
const test = async (name, run) => {
  try { await run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
};
const uid = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const lid = (n) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const category = '10000000-0000-4000-8000-000000000001';
const [admin, alice, bob, pending, suspended, unverified, clara, dave] = [1, 2, 3, 4, 5, 6, 7, 8].map(uid);

const as = async (id, role = 'authenticated') => {
  await sql('reset role');
  await sql(`select set_config('request.jwt.claim.sub', $1, false)`, [id ?? '']);
  await sql(`set role ${role}`);
};
const privileged = () => as(null, 'postgres');
const rows = async (query, args) => (await db.query(query, args)).rows;
const scalar = async (query, args) => Object.values((await rows(query, args))[0])[0];
const denies = async (query, args, pattern) => {
  await assert.rejects(
    () => db.query(query, args),
    pattern ?? /permission|policy|owner|review|access|Invalid|approved|wait|edit|verified|own account|authorized|stock|finalized|already|Seller|invitation|Insufficient|buyer|open/i
  );
};
const listingInsert = (id, owner, extra = {}) => db.query(
  `insert into public.listings(id,seller_id,group_id,title,description,price,category_id,condition,status,stock_quantity,project_name)
   values($1,$2,$3,$4,$5,$6,$7,'New',$8,$9,$10) returning id`,
  [
    id,
    owner,
    extra.groupId ?? null,
    extra.title ?? 'Solar Desk Lamp Prototype',
    extra.description ?? 'A student-built solar study lamp assembled during a Design & Technology project.',
    extra.price ?? 12.50,
    category,
    extra.status ?? 'pending_review',
    extra.stock ?? 4,
    extra.projectName ?? 'Renewable Study Lighting'
  ]
);

try {
  await sql(await read('./bootstrap.sql'));
  await sql(await read('../migrations/202611080001_campusmarket.sql'));
  await sql(await read('../migrations/202611080002_wise_owl_projects.sql'));

  await test('migrations apply cleanly, start with zero products, create private bucket and eight project categories', async () => {
    assert.equal(await scalar('select count(*)::int from public.categories'), 8);
    assert.equal(await scalar("select slug from public.categories where id=$1", [category]), 'design-and-technology');
    assert.equal(await scalar('select count(*)::int from public.listings'), 0);
    assert.equal(await scalar('select count(*)::int from public.seller_groups'), 0);
    assert.equal(await scalar('select count(*)::int from public.purchase_requests'), 0);
    assert.equal(await scalar("select public from storage.buckets where id='listing-images'"), false);
  });

  await test('signup trigger captures seller_type & project_summary while ignoring attacker role/approval metadata', async () => {
    for (const [index, id] of [admin, alice, bob, pending, suspended, unverified, clara, dave].entries()) {
      const sellerType = id === alice ? 'individual' : id === clara ? 'group' : 'none';
      await db.query(
        `insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
         values($1,$2,$3,$4::jsonb)`,
        [
          id,
          `test-${index}@example.invalid`,
          id === unverified ? null : new Date().toISOString(),
          JSON.stringify({
            display_name: `Test Learner ${index}`,
            role: 'admin',
            verification_status: 'approved',
            seller_approved: true,
            seller_type: sellerType,
            project_summary: id === alice ? 'Woodwork and solar study lamps' : ''
          })
        ]
      );
    }
    assert.deepEqual(
      await rows('select distinct role, verification_status, seller_approved from public.profiles'),
      [{ role: 'student', verification_status: 'pending', seller_approved: false }]
    );
    assert.equal(await scalar('select seller_type from public.profiles where id=$1', [alice]), 'individual');
    assert.equal(await scalar('select project_summary from public.profiles where id=$1', [alice]), 'Woodwork and solar study lamps');

    await db.query("update public.profiles set verification_status='approved' where id=any($1::uuid[])", [[admin, bob, unverified, clara, dave]]);
    await db.query("update public.profiles set role='admin' where id=$1", [admin]);
    await db.query("update public.profiles set verification_status='suspended' where id=$1", [suspended]);

    // Admin approves Alice (who registered with seller_type='individual'), automatically granting seller_approved=true
    await as(admin);
    await db.query('select public.moderate_user($1,$2)', [alice, 'approved']);
    assert.equal(await scalar('select seller_approved from public.profiles where id=$1', [alice]), true);
  });

  await test('anonymous requests cannot select private marketplace tables or invoke moderation', async () => {
    await as(null, 'anon');
    await denies('select * from public.listings');
    await denies('select * from public.seller_groups');
    await denies('select * from public.purchase_requests');
    await denies('select public.moderate_user($1,$2)', [alice, 'approved']);
  });

  await test('buyer-only student cannot create individual products until seller access is approved', async () => {
    await as(bob);
    assert.equal(await scalar('select seller_approved from public.profiles where id=$1', [bob]), false);
    await denies('update public.profiles set seller_approved=true where id=$1', [bob]);
    await denies(
      `insert into public.listings(seller_id,title,description,price,category_id,condition,status)
       values($1,'Unauthorized Seller Product','Buyer without seller approval cannot list products.',10,$2,'New','pending_review')`,
      [bob, category]
    );
  });

  await test('approved individual seller creates pending product; cannot directly publish', async () => {
    await as(alice);
    await listingInsert(lid(1), alice);
    assert.equal(await scalar('select status from public.listings where id=$1', [lid(1)]), 'pending_review');
    await denies("update public.listings set status='active' where id=$1", [lid(1)]);
    await denies(
      `insert into public.listings(seller_id,title,description,price,category_id,condition,status)
       values($1,'Self published item','This listing must never be published directly.',8,$2,'New','active')`,
      [alice, category]
    );
  });

  await test('pending, suspended and unverified users cannot read or create listings', async () => {
    for (const id of [pending, suspended, unverified]) {
      await as(id);
      assert.equal(await scalar('select count(*)::int from public.listings'), 0);
      assert.equal(await scalar('select count(*)::int from public.categories'), 0);
      await denies(
        `insert into public.listings(seller_id,title,description,price,category_id,condition)
         values($1,'Rejected access attempt','An unapproved account cannot create this listing.',8,$2,'New')`,
        [id, category]
      );
    }
  });

  await test('students cannot self-approve, change role, grant seller access, or call admin RPCs', async () => {
    await as(alice);
    await denies("update public.profiles set verification_status='approved' where id=$1", [alice]);
    await denies("update public.profiles set role='admin' where id=$1", [alice]);
    await denies('select public.moderate_user($1,$2)', [pending, 'approved']);
    await denies('select public.set_seller_access($1,$2)', [bob, true]);
    await denies('select public.moderate_listing($1,$2)', [lid(1), 'active']);
    await denies('select public.resolve_report($1,$2)', [lid(1), 'resolved']);
  });

  await test('admin approval publishes listing and records atomic audit event', async () => {
    await as(admin);
    await db.query('select public.moderate_listing($1,$2)', [lid(1), 'active']);
    assert.equal(await scalar('select status from public.listings where id=$1', [lid(1)]), 'active');
    assert.equal(await scalar('select count(*)::int from public.moderation_events where target_id=$1', [lid(1)]), 1);
  });

  await test('seller can update stock & availability on active product without unpublishing, while substantive edits re-enter review', async () => {
    await as(alice);
    await db.query('update public.listings set stock_quantity=0 where id=$1', [lid(1)]);
    assert.equal(await scalar('select status from public.listings where id=$1', [lid(1)]), 'active');
    assert.equal(await scalar('select availability from public.listings where id=$1', [lid(1)]), 'sold_out');

    await db.query("update public.listings set stock_quantity=3, availability='unavailable' where id=$1", [lid(1)]);
    assert.equal(await scalar('select availability from public.listings where id=$1', [lid(1)]), 'unavailable');

    await db.query("update public.listings set availability='available' where id=$1", [lid(1)]);
    assert.equal(await scalar('select availability from public.listings where id=$1', [lid(1)]), 'available');
    assert.equal(await scalar('select status from public.listings where id=$1', [lid(1)]), 'active');

    await db.query("update public.listings set title='Revised Solar Desk Lamp Prototype' where id=$1", [lid(1)]);
    assert.equal(await scalar('select status from public.listings where id=$1', [lid(1)]), 'pending_review');
    await as(bob);
    assert.equal(await scalar('select count(*)::int from public.listings where id=$1', [lid(1)]), 0);
  });

  await test('cross-user updates and deletions affect zero rows; other profiles stay private', async () => {
    await as(admin);
    await db.query('select public.moderate_listing($1,$2)', [lid(1), 'active']);
    await as(bob);
    assert.equal(await scalar('select count(*)::int from public.listings where id=$1', [lid(1)]), 1);
    assert.deepEqual(await rows("update public.listings set title='Tampered by another student' where id=$1 returning id", [lid(1)]), []);
    assert.deepEqual(await rows('delete from public.listings where id=$1 returning id', [lid(1)]), []);
    assert.equal(await scalar('select count(*)::int from public.profiles where id=$1', [alice]), 0);
    assert.deepEqual(await rows('select * from public.get_seller_names($1)', [[alice]]), [{ id: alice, display_name: 'Test Learner 1' }]);
  });

  await test('only verified email accounts can receive school or seller approval', async () => {
    await as(admin);
    await db.query('select public.moderate_user($1,$2)', [pending, 'approved']);
    assert.equal(await scalar('select verification_status from public.profiles where id=$1', [pending]), 'approved');
    await db.query('select public.moderate_user($1,$2)', [unverified, 'suspended']);
    await denies('select public.moderate_user($1,$2)', [unverified, 'approved']);
    await denies('select public.set_seller_access($1,$2)', [unverified, true]);
    await denies('select public.moderate_user($1,$2)', [admin, 'suspended']);
  });

  await test('listing rejection prevents owner restoring or editing removed content', async () => {
    await as(admin);
    await db.query('select public.moderate_listing($1,$2)', [lid(1), 'removed']);
    await as(alice);
    await denies("update public.listings set status='pending_review' where id=$1", [lid(1)]);
    await denies("update public.listings set title='Restored removed prototype' where id=$1", [lid(1)]);
    await db.query('delete from public.listings where id=$1', [lid(1)]);
    assert.equal(await scalar('select count(*)::int from public.listings where id=$1', [lid(1)]), 0);
  });

  await test('approved owner can mark active listing sold, zeroing stock, and cannot revive sold listing', async () => {
    await as(alice);
    await listingInsert(lid(2), alice, { stock: 5 });
    await as(admin);
    await db.query('select public.moderate_listing($1,$2)', [lid(2), 'active']);
    await as(alice);
    await db.query("update public.listings set status='sold' where id=$1", [lid(2)]);
    assert.equal(await scalar('select status from public.listings where id=$1', [lid(2)]), 'sold');
    assert.equal(await scalar('select stock_quantity from public.listings where id=$1', [lid(2)]), 0);
    assert.equal(await scalar('select availability from public.listings where id=$1', [lid(2)]), 'sold_out');
    await denies("update public.listings set status='active' where id=$1", [lid(2)]);
  });

  await test('private uploads reject direct student writes and cross-owner image references', async () => {
    await as(alice);
    await listingInsert(lid(3), alice);
    await denies("insert into storage.objects(bucket_id,name) values('listing-images',$1)", [`${alice}/${lid(3)}/attacker.webp`]);
    await denies('insert into public.listing_images(listing_id,storage_path,display_order) values($1,$2,0)', [lid(3), `${bob}/${lid(3)}/attacker.webp`]);
    await denies('insert into public.listing_images(listing_id,storage_path,display_order) values($1,$2,0)', [lid(3), `${alice}/${lid(3)}/nonexistent.webp`]);
  });

  await test('verified storage images support main-image reordering, capped count, private reads, and force renewed review on add/delete', async () => {
    await privileged();
    for (let i = 0; i < 6; i++) {
      await db.query("insert into storage.objects(bucket_id,name) values('listing-images',$1)", [`${alice}/${lid(3)}/fixture-${i}.webp`]);
    }
    await as(alice);
    for (let i = 0; i < 5; i++) {
      await db.query('insert into public.listing_images(listing_id,storage_path,display_order) values($1,$2,$3)', [lid(3), `${alice}/${lid(3)}/fixture-${i}.webp`, i]);
    }
    await denies('insert into public.listing_images(listing_id,storage_path,display_order) values($1,$2,5)', [lid(3), `${alice}/${lid(3)}/fixture-5.webp`], /check constraint/);

    const thirdImageId = await scalar('select id from public.listing_images where listing_id=$1 and display_order=2', [lid(3)]);
    await as(bob);
    await denies('select public.set_primary_listing_image($1,$2)', [lid(3), thirdImageId]);

    await as(alice);
    await db.query('select public.set_primary_listing_image($1,$2)', [lid(3), thirdImageId]);
    assert.equal(await scalar('select storage_path from public.listing_images where listing_id=$1 and display_order=0', [lid(3)]), `${alice}/${lid(3)}/fixture-2.webp`);

    await as(bob);
    assert.equal(await scalar("select count(*)::int from storage.objects where bucket_id='listing-images'"), 0);
    await as(admin);
    await db.query('select public.moderate_listing($1,$2)', [lid(3), 'active']);
    await as(bob);
    assert.equal(await scalar("select count(*)::int from storage.objects where bucket_id='listing-images'"), 5);
    await as(alice);
    await db.query('delete from public.listing_images where listing_id=$1 and display_order=4', [lid(3)]);
    assert.equal(await scalar('select status from public.listings where id=$1', [lid(3)]), 'pending_review');
    await as(bob);
    assert.equal(await scalar("select count(*)::int from storage.objects where bucket_id='listing-images'"), 0);
  });

  await test('collaborative seller groups enforce admin approval, invitations, non-self-approvable join requests, and product permissions', async () => {
    await as(clara);
    const groupA = await scalar(
      `select public.create_seller_group('Westgate Agrotech Team', 'westgate-agrotech-team',
        'Collaborative drip-irrigation and seedling trays engineered by Form 4 learners.', 'Agriculture')`
    );
    assert.equal(await scalar('select verification_status from public.seller_groups where id=$1', [groupA]), 'pending');

    // Group cannot submit listings before admin approves the group
    await denies(
      `insert into public.listings(id,seller_id,group_id,title,description,price,category_id,condition,status,stock_quantity)
       values($1,$2,$3,'Seedling Starter Kit','Modular nursery kit built by our project group.',6.00,$4,'New','pending_review',10)`,
      [lid(10), clara, groupA, category]
    );

    // Non-admin cannot approve group
    await denies('select public.moderate_group($1,$2)', [groupA, 'approved']);

    // Admin approves group
    await as(admin);
    await db.query('select public.moderate_group($1,$2)', [groupA, 'approved']);
    assert.equal(await scalar('select verification_status from public.seller_groups where id=$1', [groupA]), 'approved');
    assert.equal(await scalar('select seller_approved from public.profiles where id=$1', [clara]), true);

    // Dave requests membership — cannot self-approve!
    await as(dave);
    await db.query('select public.request_group_membership($1)', [groupA]);
    assert.equal(await scalar('select status from public.group_members where group_id=$1 and user_id=$2', [groupA, dave]), 'requested');
    await denies('select public.respond_group_invite($1,true)', [groupA]);
    await denies('select public.manage_group_member($1,$2,$3,true)', [groupA, dave, 'approved']);
    await denies(
      `insert into public.listings(id,seller_id,group_id,title,description,price,category_id,condition,status,stock_quantity)
       values($1,$2,$3,'Unauthorized Group Product','Unapproved requester cannot list under group.',6.00,$4,'New','pending_review',2)`,
      [lid(11), dave, groupA, category]
    );

    // Clara approves Dave as view-only member (can_manage_products = false)
    await as(clara);
    await db.query('select public.manage_group_member($1,$2,$3,false)', [groupA, dave, 'approved']);
    await as(dave);
    await denies(
      `insert into public.listings(id,seller_id,group_id,title,description,price,category_id,condition,status,stock_quantity)
       values($1,$2,$3,'View-only Member Product','Member without product permission cannot list.',6.00,$4,'New','pending_review',2)`,
      [lid(11), dave, groupA, category]
    );

    // Clara grants Dave product management permission AND invites Bob into a second group (multi-group support)
    await as(clara);
    await db.query('select public.manage_group_member($1,$2,$3,true)', [groupA, dave, 'approved']);
    const groupB = await scalar(
      `select public.create_seller_group('Westgate Makers Guild', 'westgate-makers-guild',
        'Laser-cut stationery organizers and desk stands produced in Design & Technology.', 'Design & Technology')`
    );
    await db.query('select public.invite_group_member($1,$2,true)', [groupB, dave]);
    await as(admin);
    await db.query('select public.moderate_group($1,$2)', [groupB, 'approved']);
    await as(dave);
    await db.query('select public.respond_group_invite($1,true)', [groupB]);
    assert.equal(await scalar("select count(*)::int from public.group_members where user_id=$1 and status='approved'", [dave]), 2);

    // Permitted group member Dave creates and edits group product; Clara (group owner) can also edit it; outsider Bob cannot!
    await listingInsert(lid(10), dave, {
      groupId: groupA,
      title: 'Drip Irrigation Starter Kit',
      description: 'Complete gravity-fed micro-irrigation kit assembled and tested by the Agrotech project team.',
      price: 15.00,
      stock: 3,
      projectName: 'Smart Micro-Irrigation'
    });
    await as(clara);
    await db.query('update public.listings set stock_quantity=4 where id=$1', [lid(10)]);
    assert.equal(await scalar('select stock_quantity from public.listings where id=$1', [lid(10)]), 4);

    await as(admin);
    await db.query('select public.moderate_listing($1,$2)', [lid(10), 'active']);

    await as(bob);
    assert.deepEqual(await rows("update public.listings set title='Outsider Tamper' where id=$1 returning id", [lid(10)]), []);
  });

  await test('safe purchase requests enforce privacy, preserve stock until fulfillment, and atomically prevent negative stock or duplicate fulfillment', async () => {
    const groupProduct = lid(10); // stock = 4, owned by groupA (clara & dave)
    // Group members cannot submit purchase requests for their own group's product
    await as(clara);
    await denies('select public.submit_purchase_request($1,1,$2)', [groupProduct, 'Self request']);
    await as(dave);
    await denies('select public.submit_purchase_request($1,1,$2)', [groupProduct, 'Collaborator self request']);

    // Buyer Bob cannot request more than available stock (4)
    await as(bob);
    await denies('select public.submit_purchase_request($1,5,$2)', [groupProduct, 'Too many units']);

    // Bob requests 3 units, Pending (approved student) requests 2 units -> neither deducts stock yet!
    const reqBob = await scalar('select public.submit_purchase_request($1,3,$2)', [groupProduct, 'Interested for our family garden']);
    await as(pending);
    const reqPendingStudent = await scalar('select public.submit_purchase_request($1,2,$2)', [groupProduct, 'Requesting two kits']);

    assert.equal(await scalar('select stock_quantity from public.listings where id=$1', [groupProduct]), 4);

    // Cross-user purchase request isolation: Bob cannot see Pending student's request or fulfill his own request
    await as(bob);
    assert.equal(await scalar('select count(*)::int from public.purchase_requests'), 1);
    await denies('select public.update_purchase_request_status($1,$2)', [reqBob, 'fulfilled']);
    await denies('select public.update_purchase_request_status($1,$2)', [reqPendingStudent, 'cancelled']);

    // Outsider Alice (unrelated seller) cannot read or manage groupA's requests
    await as(alice);
    assert.equal(await scalar('select count(*)::int from public.purchase_requests where listing_id=$1', [groupProduct]), 0);
    await denies('select public.update_purchase_request_status($1,$2)', [reqBob, 'accepted']);

    // Group product manager Dave accepts and fulfills Bob's 3-unit request -> stock drops atomically from 4 to 1
    await as(dave);
    assert.equal(await scalar('select count(*)::int from public.purchase_requests where listing_id=$1', [groupProduct]), 2);
    await db.query('select public.update_purchase_request_status($1,$2)', [reqBob, 'accepted']);
    await db.query('select public.update_purchase_request_status($1,$2)', [reqBob, 'fulfilled']);
    assert.equal(await scalar('select stock_quantity from public.listings where id=$1', [groupProduct]), 1);
    assert.equal(await scalar('select availability from public.listings where id=$1', [groupProduct]), 'available');

    // Duplicate fulfillment is rejected
    await denies('select public.update_purchase_request_status($1,$2)', [reqBob, 'fulfilled']);

    // Fulfilling the second 2-unit request when only 1 unit remains is rejected (prevents negative stock!)
    await denies('select public.update_purchase_request_status($1,$2)', [reqPendingStudent, 'fulfilled']);
    assert.equal(await scalar('select stock_quantity from public.listings where id=$1', [groupProduct]), 1);

    // Buyer cancels unfulfilled 2-unit request, submits a 1-unit request, and Clara fulfills the final unit -> stock=0, sold_out!
    await as(pending);
    await db.query('select public.update_purchase_request_status($1,$2)', [reqPendingStudent, 'cancelled']);
    const reqFinal = await scalar('select public.submit_purchase_request($1,1,$2)', [groupProduct, 'Taking the final kit']);
    await as(clara);
    await db.query('select public.update_purchase_request_status($1,$2)', [reqFinal, 'fulfilled']);
    assert.equal(await scalar('select stock_quantity from public.listings where id=$1', [groupProduct]), 0);
    assert.equal(await scalar('select availability from public.listings where id=$1', [groupProduct]), 'sold_out');

    // New purchase requests are blocked once sold_out
    await as(bob);
    await denies('select public.submit_purchase_request($1,1,$2)', [groupProduct, 'Sold out attempt']);
  });

  await test('administrator can manually publish verified school-project product with audit trail; students cannot', async () => {
    await as(alice);
    await denies(
      `select public.admin_create_product($1,null,'Student Spoof','Unauthorized call to admin_create_product.',10,$2,2,'Project',null,null,null,null,false)`,
      [alice, category]
    );
    await as(admin);
    const adminProductId = await scalar(
      `select public.admin_create_product($1,null,'Hand-Bound Revision Journal','Hand-stitched A5 revision notebooks produced by Form 3 Design learners.',5.50,$2,8,'Bookbinding Practical','Recycled card, cotton thread','A5 (148 x 210 mm)','Hand-stitched Coptic binding','Design & Technology',false)`,
      [alice, category]
    );
    assert.equal(await scalar('select status from public.listings where id=$1', [adminProductId]), 'active');
    assert.equal(await scalar('select created_by_admin from public.listings where id=$1', [adminProductId]), admin);
    assert.equal(await scalar("select count(*)::int from public.moderation_events where target_id=$1 and action='admin published verified product'", [adminProductId]), 1);
  });

  await test('saves and reports enforce ownership, moderation resolves report with audit', async () => {
    await as(admin);
    await db.query('select public.moderate_listing($1,$2)', [lid(3), 'active']);
    await as(bob);
    await db.query('insert into public.saved_listings(user_id,listing_id) values($1,$2)', [bob, lid(3)]);
    await denies('insert into public.saved_listings(user_id,listing_id) values($1,$2)', [alice, lid(3)]);
    const report = (
      await rows(
        `insert into public.reports(reporter_id,listing_id,reason,details)
         values($1,$2,'Other concern','Please review this test project listing.') returning id`,
        [bob, lid(3)]
      )
    )[0].id;
    await denies("update public.reports set status='resolved',resolved_at=now() where id=$1", [report]);
    await as(alice);
    assert.equal(await scalar('select count(*)::int from public.saved_listings'), 0);
    assert.equal(await scalar('select count(*)::int from public.reports'), 0);
    await as(admin);
    await db.query('select public.resolve_report($1,$2)', [report, 'resolved']);
    assert.equal(await scalar('select status from public.reports where id=$1', [report]), 'resolved');
    assert.equal(await scalar('select count(*)::int from public.moderation_events where target_id=$1', [report]), 1);
  });

  await test('suspending owner revokes seller_approved, hides active listings, and revokes image access', async () => {
    await as(admin);
    await db.query('select public.moderate_user($1,$2)', [alice, 'suspended']);
    assert.equal(await scalar('select seller_approved from public.profiles where id=$1', [alice]), false);
    await as(bob);
    assert.equal(await scalar('select count(*)::int from public.listings where seller_id=$1', [alice]), 0);
    assert.equal(await scalar("select count(*)::int from storage.objects where bucket_id='listing-images'"), 0);
    await as(alice);
    assert.equal(await scalar('select count(*)::int from public.listings'), 0);
  });

  await test('restrictive storage policies withstand pre-existing broad permissive policies', async () => {
    await privileged();
    await sql('create policy test_overbroad_policy on storage.objects for all to anon,authenticated using(true) with check(true)');
    await as(bob);
    assert.equal(await scalar("select count(*)::int from storage.objects where bucket_id='listing-images'"), 0);
    await denies("insert into storage.objects(bucket_id,name) values('listing-images','malicious.webp')");
    await as(null, 'anon');
    assert.equal(await scalar("select count(*)::int from storage.objects where bucket_id='listing-images'"), 0);
    await denies("insert into storage.objects(bucket_id,name) values('listing-images','anonymous.webp')");
    await privileged();
    await sql('drop policy test_overbroad_policy on storage.objects');
  });

  await test('admin-owned personal listing image edits re-enter review without granting publication bypass', async () => {
    await privileged();
    await sql('delete from private.rate_limits');
    await as(admin);
    await listingInsert(lid(4), admin);
    await db.query('select public.moderate_listing($1,$2)', [lid(4), 'active']);
    await privileged();
    await db.query("insert into storage.objects(bucket_id,name) values('listing-images',$1)", [`${admin}/${lid(4)}/admin-image.webp`]);
    await as(admin);
    await db.query('insert into public.listing_images(listing_id,storage_path,display_order) values($1,$2,0)', [lid(4), `${admin}/${lid(4)}/admin-image.webp`]);
    assert.equal(await scalar('select status from public.listings where id=$1', [lid(4)]), 'pending_review');
    await denies("update public.listings set status='active' where id=$1", [lid(4)]);
  });

  await test('atomic rate caps cannot be expanded using caller-supplied limits or windows', async () => {
    await privileged();
    await sql('delete from private.rate_limits');
    await as(bob);
    for (let i = 0; i < 5; i++) assert.equal(await scalar("select public.consume_rate_limit('report',999999,$1)", [i + 1]), true);
    assert.equal(await scalar("select public.consume_rate_limit('report',999999,999999)"), false);
    assert.equal(await scalar("select public.consume_rate_limit('unknown',999999,60)"), false);
  });

  await test('database rate triggers reject direct REST-equivalent mutation beyond quota', async () => {
    await privileged();
    await sql('delete from private.rate_limits');
    await as(bob);
    for (let i = 0; i < 10; i++) await db.query('update public.profiles set display_name=$1 where id=$2', [`Test Bob ${i}`, bob]);
    await denies("update public.profiles set display_name='Exceeded quota' where id=$1", [bob]);
  });

  console.log(`\n${passed} database integration scenarios passed using embedded PostgreSQL. Supabase Auth HTTP, Storage HTTP and hosted configuration are not covered.`);
} finally {
  await db.close();
}
