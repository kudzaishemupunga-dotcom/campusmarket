// Isolated synthetic fixtures only: no network connection or environment files.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
const baseline = process.argv.includes('--baseline');
const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');
const uuid = (n) => `90000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [admin, otherAdmin, seller, buyer, collaborator, outsider, noSeller, unverified] = [1,2,3,4,5,6,7,8].map(uuid);
const group = uuid(50);
const category = '10000000-0000-4000-8000-000000000001';
const rows = async (query, args) => (await db.query(query,args)).rows;
const scalar = async (query,args) => Object.values((await rows(query,args))[0])[0];
const as = async (id, role = 'authenticated') => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id ?? '']);
  await db.exec(`set role ${role}`);
};
const privileged = () => as(null,'postgres');
const denied = (query,args) => assert.rejects(() => db.query(query,args), /approved|available|authorized|permission|policy|edit|seller|member|finalized|stock/i);
let sequence = 100;
const makeListing = async (options = {}) => {
  const id = uuid(sequence++); await privileged();
  await db.query(`insert into public.listings(id,seller_id,group_id,title,description,price,category_id,condition,status,stock_quantity,availability,created_by_admin)
    values($1,$2,$3,'Fixture project product','Synthetic isolated security regression test product.',8,$4,'New',$5,$6,'available',$7)`,
    [id,options.seller ?? seller,options.group ?? null,category,options.status ?? 'active',options.stock ?? 4,options.admin ?? null]);
  return id;
};
const addImage = async (listing, owner = seller, order = 0) => {
  const path = `${owner}/${listing}/${uuid(sequence++)}.webp`; await privileged();
  await db.query("insert into storage.objects(bucket_id,name) values('listing-images',$1)",[path]); await as(owner);
  return scalar('insert into public.listing_images(listing_id,storage_path,display_order) values($1,$2,$3) returning id',[listing,path,order]);
};
const active = async (listing) => { await privileged(); await db.query("update public.listings set status='active' where id=$1",[listing]); };
const request = async (listing, quantity = 1) => { await as(buyer); return scalar('select public.submit_purchase_request($1,$2,null)',[listing,quantity]); };
let passed = 0;
const failures = [];
const test = async (name, run) => {
  try { await run(); passed++; console.log(`PASS audit: ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL audit: ${name}: ${error.message}`); }
};
try {
  await db.exec(await read('./bootstrap.sql'));
  await db.exec(await read('../migrations/202611080001_campusmarket.sql'));
  await db.exec(await read('../migrations/202611080002_wise_owl_projects.sql'));
  if (!baseline) await db.exec(await read('../migrations/202611090003_authorization_boundaries.sql'));
  for (const id of [admin,otherAdmin,seller,buyer,collaborator,outsider,noSeller,unverified]) {
    await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'synthetic@example.invalid',$2,'{\"display_name\":\"Synthetic fixture\"}')",[id,id === unverified ? null : new Date().toISOString()]);
    await db.query("update public.profiles set verification_status='approved',seller_approved=$2,role=$3 where id=$1",[id,[admin,otherAdmin,seller].includes(id),[admin,otherAdmin].includes(id) ? 'admin' : 'student']);
  }
  await db.query(`insert into public.seller_groups(id,name,slug,project_description,created_by,verification_status)
    values($1,'Synthetic regression group','synthetic-regression-group','A synthetic local test project group.',$2,'approved')`,[group,seller]);
  await db.query(`insert into public.group_members(group_id,user_id,member_role,can_manage_products,status)
    values($1,$2,'owner',true,'approved'),($1,$3,'member',true,'approved')`,[group,seller,collaborator]);

  await test('seller-access revocation hides products and linked storage', async () => {
    await as(seller);
    const createdBySeller = await scalar(
      `insert into public.listings(seller_id,title,description,price,category_id,condition,status,stock_quantity,availability)
       values($1,'Authenticated seller insert check','Verifies INSERT RETURNING succeeds under listings_member_read.',9,$2,'New','pending_review',2,'available') returning id`,
      [seller, category]
    );
    assert.ok(createdBySeller);
    const listing = await makeListing(); await addImage(listing); await active(listing);
    await as(admin); await db.query('select public.set_seller_access($1,false)',[seller]); await as(buyer);
    assert.equal(await scalar('select count(*)::int from public.listings where id=$1',[listing]),0);
    assert.equal(await scalar('select count(*)::int from storage.objects where name like $1',[`%/${listing}/%`]),0);
  });
  await privileged(); await db.query('update public.profiles set seller_approved=true where id=$1',[seller]);
  await test('admin cannot purchase or fulfill for a revoked seller', async () => {
    const listing = await makeListing(); const req = await request(listing);
    await as(admin); await db.query('select public.set_seller_access($1,false)',[seller]);
    await denied('select public.submit_purchase_request($1,1,null)',[listing]);
    await denied("select public.update_purchase_request_status($1,'fulfilled')",[req]);
    assert.equal(await scalar('select stock_quantity from public.listings where id=$1',[listing]),4);
  });
  await privileged(); await db.query('update public.profiles set seller_approved=true where id=$1',[seller]);
  await test('suspended buyer blocks acceptance and fulfillment without stock loss', async () => {
    const listing = await makeListing(); const req = await request(listing);
    await privileged(); await db.query("update public.profiles set verification_status='suspended' where id=$1",[buyer]); await as(seller);
    await denied("select public.update_purchase_request_status($1,'accepted')",[req]);
    await denied("select public.update_purchase_request_status($1,'fulfilled')",[req]);
    assert.equal(await scalar('select stock_quantity from public.listings where id=$1',[listing]),4);
  });
  await privileged(); await db.query("update public.profiles set verification_status='approved' where id=$1",[buyer]);
  await test('removed group blocks admin fulfillment and requests', async () => {
    const listing = await makeListing({group}); const req = await request(listing);
    await as(admin); await db.query("select public.moderate_group($1,'removed')",[group]);
    await denied("select public.update_purchase_request_status($1,'fulfilled')",[req]);
    await denied('select public.submit_purchase_request($1,1,null)',[listing]);
  });
  await privileged(); await db.query("update public.seller_groups set verification_status='approved' where id=$1",[group]);
  await test('approved group content edits require renewed review', async () => {
    const listing = await makeListing({group}); await as(seller);
    await db.query("select public.update_seller_group($1,'Revised synthetic group','Substantively changed synthetic project description.',null)",[group]);
    assert.equal(await scalar('select verification_status from public.seller_groups where id=$1',[group]),'pending');
    await as(buyer); assert.equal(await scalar('select count(*)::int from public.listings where id=$1',[listing]),0);
  });
  await privileged(); await db.query("update public.seller_groups set verification_status='approved' where id=$1",[group]);
  await test('changing primary image sends published product to review', async () => {
    const listing = await makeListing(); await addImage(listing); const second = await addImage(listing,seller,1); await active(listing);
    await as(seller); await db.query('select public.set_primary_listing_image($1,$2)',[listing,second]);
    assert.equal(await scalar('select status from public.listings where id=$1',[listing]),'pending_review');
  });
  await test('sold and removed product images cannot be reordered', async () => {
    for (const state of ['sold','removed']) {
      const listing = await makeListing(); await addImage(listing); const second = await addImage(listing,seller,1);
      await privileged(); await db.query('update public.listings set status=$2 where id=$1',[listing,state]); await as(seller);
      await denied('select public.set_primary_listing_image($1,$2)',[listing,second]);
    }
  });
  await test('photo assist works only for the admin who authored the product', async () => {
    const listing = await makeListing({admin});
    const ownPath = `${admin}/${listing}/${uuid(sequence++)}.webp`; const otherPath = `${otherAdmin}/${listing}/${uuid(sequence++)}.webp`;
    await privileged(); for (const path of [ownPath,otherPath]) await db.query("insert into storage.objects(bucket_id,name) values('listing-images',$1)",[path]);
    await as(otherAdmin); await denied('insert into public.listing_images(listing_id,storage_path,display_order) values($1,$2,0)',[listing,otherPath]);
    await as(admin); await db.query('insert into public.listing_images(listing_id,storage_path,display_order) values($1,$2,0)',[listing,ownPath]);
    assert.equal(await scalar('select status from public.listings where id=$1',[listing]),'pending_review');
  });
  await test('admin publishing enforces seller approval, email and group association', async () => {
    await as(admin);
    for (const [owner,gid] of [[noSeller,null],[unverified,null],[outsider,group]]) {
      await denied(`select public.admin_create_product($1,$2,'Synthetic admin publication','An isolated administrator publication regression fixture.',8,$3,2)`,[owner,gid,category]);
    }
  });
  await test('requester cannot self-approve or change product grants', async () => {
    await as(outsider); await db.query('select public.request_group_membership($1)',[group]);
    await denied("select public.manage_group_member($1,$2,'approved',true)",[group,outsider]);
    await denied('update public.group_members set can_manage_products=true where group_id=$1 and user_id=$2',[group,outsider]);
    await denied('select public.respond_group_invite($1,true)',[group]);
  });
  await test('revoked group product permission denies stock edit and fulfillment', async () => {
    const listing = await makeListing({group}); const req = await request(listing);
    await as(seller); await db.query("select public.manage_group_member($1,$2,'approved',false)",[group,collaborator]); await as(collaborator);
    assert.deepEqual(await rows('update public.listings set stock_quantity=999 where id=$1 returning id',[listing]),[]);
    await denied("select public.update_purchase_request_status($1,'fulfilled')",[req]);
    await as(seller); await db.query("select public.manage_group_member($1,$2,'approved',true)",[group,collaborator]);
  });
  await test('competing fulfillment calls preserve stock and prevent duplication', async () => {
    const listing = await makeListing({stock:1}); const first = await request(listing); const second = await request(listing); await as(seller);
    // PGlite serializes calls on one engine; this is not a hosted multi-session lock stress test.
    const outcomes = await Promise.allSettled([first,second].map((id) => db.query("select public.update_purchase_request_status($1,'fulfilled')",[id])));
    assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length,1);
    assert.equal(await scalar('select stock_quantity from public.listings where id=$1',[listing]),0);
    assert.equal(await scalar('select availability from public.listings where id=$1',[listing]),'sold_out');
    const done = await scalar("select id from public.purchase_requests where listing_id=$1 and status='fulfilled'",[listing]);
    await denied("select public.update_purchase_request_status($1,'fulfilled')",[done]);
  });
  await test('admin inspect rights do not permit fulfillment for suspended sellers', async () => {
    const listing = await makeListing(); const req = await request(listing);
    await privileged(); await db.query("update public.profiles set verification_status='suspended' where id=$1",[seller]); await as(admin);
    assert.equal(await scalar('select count(*)::int from public.listings where id=$1',[listing]),1);
    await denied("select public.update_purchase_request_status($1,'fulfilled')",[req]);
  });
  await privileged(); await db.query("update public.profiles set verification_status='approved' where id=$1",[seller]);
  await test('unavailable inventory cannot be accepted or fulfilled', async () => {
    const listing = await makeListing(); const req = await request(listing); await as(seller);
    await db.query("update public.listings set availability='unavailable' where id=$1",[listing]);
    await denied("select public.update_purchase_request_status($1,'accepted')",[req]);
    await denied("select public.update_purchase_request_status($1,'fulfilled')",[req]);
  });
  console.log(`\nAudit migration ${baseline ? '002 BASELINE' : '003'}: ${passed} passed; ${failures.length} failed. No hosted services contacted.`);
  if (failures.length) throw new Error(`Security regressions failed: ${failures.join('; ')}`);
} finally { await db.close(); }
