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
const [admin, alice, bob, pending, suspended, unverified] = [1,2,3,4,5,6].map(uid);
const as = async (id, role = 'authenticated') => {
  await sql('reset role');
  await sql(`select set_config('request.jwt.claim.sub', $1, false)`, [id ?? '']);
  await sql(`set role ${role}`);
};
const privileged = () => as(null, 'postgres');
const rows = async (query, args) => (await db.query(query, args)).rows;
const scalar = async (query, args) => Object.values((await rows(query, args))[0])[0];
const denies = async (query, args, pattern) => {
  await assert.rejects(() => db.query(query, args), pattern ?? /permission|policy|owner|review|access|Invalid|approved|wait|edit|verified|own account/i);
};
const listingInsert = (id, owner) => db.query(
  `insert into public.listings(id,seller_id,title,description,price,category_id,condition,status)
   values($1,$2,'Mathematics textbook','A fictional mathematics textbook in good condition.',8,$3,'Good','pending_review')`,
  [id, owner, category]);
try {
  await sql(await read('./bootstrap.sql'));
  await sql(await read('../migrations/202611080001_campusmarket.sql'));
  await test('migration applies to PostgreSQL, creates private bucket and eight categories', async () => {
    assert.equal(await scalar('select count(*)::int from public.categories'), 8);
    assert.equal(await scalar("select public from storage.buckets where id='listing-images'"), false);
  });
  await test('signup trigger ignores attacker-supplied admin and approval metadata', async () => {
    for (const [index, id] of [admin,alice,bob,pending,suspended,unverified].entries()) {
      await db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
        values($1,$2,$3,$4::jsonb)`, [id,`fictional-${index}@example.invalid`,id === unverified ? null : new Date().toISOString(),
        JSON.stringify({display_name:`Fictional Student ${index}`,role:'admin',verification_status:'approved'})]);
    }
    assert.deepEqual(await rows('select distinct role,verification_status from public.profiles'),[{role:'student',verification_status:'pending'}]);
    await db.query("update public.profiles set verification_status='approved' where id=any($1::uuid[])",[[admin,alice,bob,unverified]]);
    await db.query("update public.profiles set role='admin' where id=$1",[admin]);
    await db.query("update public.profiles set verification_status='suspended' where id=$1",[suspended]);
  });
  await test('anonymous requests cannot select private marketplace tables or invoke moderation', async () => {
    await as(null,'anon');
    await denies('select * from public.listings');
    await denies('select public.moderate_user($1,$2)',[alice,'approved']);
  });
  await test('approved owner creates pending listing; cannot directly publish', async () => {
    await as(alice);
    await listingInsert(lid(1),alice);
    assert.equal(await scalar('select status from public.listings where id=$1',[lid(1)]),'pending_review');
    await denies("update public.listings set status='active' where id=$1",[lid(1)]);
    await denies(`insert into public.listings(seller_id,title,description,price,category_id,condition,status)
      values($1,'Self published item','This listing must never be published directly.',8,$2,'Good','active')`,[alice,category]);
  });
  await test('pending, suspended and unverified users cannot read or create listings', async () => {
    for (const id of [pending,suspended,unverified]) {
      await as(id);
      assert.equal(await scalar('select count(*)::int from public.listings'),0);
      assert.equal(await scalar('select count(*)::int from public.categories'),0);
      await denies(`insert into public.listings(seller_id,title,description,price,category_id,condition)
        values($1,'Rejected access attempt','An unapproved account cannot create this listing.',8,$2,'Good')`,[id,category]);
    }
  });
  await test('students cannot self-approve, change role, or call admin RPCs', async () => {
    await as(alice);
    await denies("update public.profiles set verification_status='approved' where id=$1",[alice]);
    await denies("update public.profiles set role='admin' where id=$1",[alice]);
    await denies('select public.moderate_user($1,$2)',[pending,'approved']);
    await denies('select public.moderate_listing($1,$2)',[lid(1),'active']);
    await denies('select public.resolve_report($1,$2)',[lid(1),'resolved']);
  });
  await test('admin approval publishes listing and records atomic audit event', async () => {
    await as(admin);
    await db.query('select public.moderate_listing($1,$2)',[lid(1),'active']);
    assert.equal(await scalar('select status from public.listings where id=$1',[lid(1)]),'active');
    assert.equal(await scalar('select count(*)::int from public.moderation_events where target_id=$1',[lid(1)]),1);
  });
  await test('cross-user updates and deletions affect zero rows; other profiles stay private', async () => {
    await as(bob);
    assert.equal(await scalar('select count(*)::int from public.listings where id=$1',[lid(1)]),1);
    assert.deepEqual(await rows("update public.listings set title='Tampered by another student' where id=$1 returning id",[lid(1)]),[]);
    assert.deepEqual(await rows('delete from public.listings where id=$1 returning id',[lid(1)]),[]);
    assert.equal(await scalar('select count(*)::int from public.profiles where id=$1',[alice]),0);
    assert.deepEqual(await rows('select * from public.get_seller_names($1)',[[alice]]),[{id:alice,display_name:'Fictional Student 1'}]);
  });
  await test('substantive edits require renewed review and disappear for other students', async () => {
    await as(alice);
    await db.query("update public.listings set title='Revised mathematics textbook' where id=$1",[lid(1)]);
    assert.equal(await scalar('select status from public.listings where id=$1',[lid(1)]),'pending_review');
    await as(bob);
    assert.equal(await scalar('select count(*)::int from public.listings where id=$1',[lid(1)]),0);
    assert.deepEqual(await rows('select * from public.get_seller_names($1)',[[alice]]),[]);
  });
  await test('only verified email accounts can receive school approval', async () => {
    await as(admin);
    await db.query('select public.moderate_user($1,$2)',[pending,'approved']);
    assert.equal(await scalar('select verification_status from public.profiles where id=$1',[pending]),'approved');
    await db.query('select public.moderate_user($1,$2)',[unverified,'suspended']);
    await denies('select public.moderate_user($1,$2)',[unverified,'approved']);
    await denies('select public.moderate_user($1,$2)',[admin,'suspended']);
  });
  await test('listing rejection prevents owner restoring or editing removed content', async () => {
    await as(admin);
    await db.query('select public.moderate_listing($1,$2)',[lid(1),'removed']);
    await as(alice);
    await denies("update public.listings set status='pending_review' where id=$1",[lid(1)]);
    await denies("update public.listings set title='Restored removed textbook' where id=$1",[lid(1)]);
    await db.query('delete from public.listings where id=$1',[lid(1)]);
    assert.equal(await scalar('select count(*)::int from public.listings where id=$1',[lid(1)]),0);
  });
  await test('approved owner can mark active listing sold, but cannot revive sold listing', async () => {
    await as(alice); await listingInsert(lid(2),alice);
    await as(admin); await db.query('select public.moderate_listing($1,$2)',[lid(2),'active']);
    await as(alice); await db.query("update public.listings set status='sold' where id=$1",[lid(2)]);
    assert.equal(await scalar('select status from public.listings where id=$1',[lid(2)]),'sold');
    await denies("update public.listings set status='active' where id=$1",[lid(2)]);
  });
  await test('private uploads reject direct student writes and cross-owner image references', async () => {
    await as(alice); await listingInsert(lid(3),alice);
    await denies("insert into storage.objects(bucket_id,name) values('listing-images',$1)",[`${alice}/${lid(3)}/attacker.webp`]);
    await denies('insert into public.listing_images(listing_id,storage_path,display_order) values($1,$2,0)',[lid(3),`${bob}/${lid(3)}/attacker.webp`]);
    await denies('insert into public.listing_images(listing_id,storage_path,display_order) values($1,$2,0)',[lid(3),`${alice}/${lid(3)}/nonexistent.webp`]);
  });
  await test('verified storage images have capped count, private reads, and force renewed review', async () => {
    await privileged();
    for(let i=0;i<6;i++) await db.query("insert into storage.objects(bucket_id,name) values('listing-images',$1)",[`${alice}/${lid(3)}/fixture-${i}.webp`]);
    await as(alice);
    for(let i=0;i<5;i++) await db.query('insert into public.listing_images(listing_id,storage_path,display_order) values($1,$2,$3)',[lid(3),`${alice}/${lid(3)}/fixture-${i}.webp`,i]);
    await denies('insert into public.listing_images(listing_id,storage_path,display_order) values($1,$2,5)',[lid(3),`${alice}/${lid(3)}/fixture-5.webp`],/check constraint/);
    await as(bob); assert.equal(await scalar("select count(*)::int from storage.objects where bucket_id='listing-images'"),0);
    await as(admin); await db.query('select public.moderate_listing($1,$2)',[lid(3),'active']);
    await as(bob); assert.equal(await scalar("select count(*)::int from storage.objects where bucket_id='listing-images'"),5);
    await as(alice); await db.query('delete from public.listing_images where listing_id=$1 and display_order=4',[lid(3)]);
    assert.equal(await scalar('select status from public.listings where id=$1',[lid(3)]),'pending_review');
    await as(bob); assert.equal(await scalar("select count(*)::int from storage.objects where bucket_id='listing-images'"),0);
  });
  await test('saves and reports enforce ownership, moderation resolves report with audit', async () => {
    await as(admin); await db.query('select public.moderate_listing($1,$2)',[lid(3),'active']);
    await as(bob); await db.query('insert into public.saved_listings(user_id,listing_id) values($1,$2)',[bob,lid(3)]);
    await denies('insert into public.saved_listings(user_id,listing_id) values($1,$2)',[alice,lid(3)]);
    const report = (await rows(`insert into public.reports(reporter_id,listing_id,reason,details)
      values($1,$2,'Other concern','Please review this fictional listing.') returning id`,[bob,lid(3)]))[0].id;
    await denies("update public.reports set status='resolved',resolved_at=now() where id=$1",[report]);
    await as(alice); assert.equal(await scalar('select count(*)::int from public.saved_listings'),0);
    assert.equal(await scalar('select count(*)::int from public.reports'),0);
    await as(admin); await db.query('select public.resolve_report($1,$2)',[report,'resolved']);
    assert.equal(await scalar('select status from public.reports where id=$1',[report]),'resolved');
    assert.equal(await scalar('select count(*)::int from public.moderation_events where target_id=$1',[report]),1);
  });
  await test('suspending owner hides active listings and revokes image access', async () => {
    await as(admin); await db.query('select public.moderate_user($1,$2)',[alice,'suspended']);
    await as(bob); assert.equal(await scalar('select count(*)::int from public.listings where seller_id=$1',[alice]),0);
    assert.equal(await scalar("select count(*)::int from storage.objects where bucket_id='listing-images'"),0);
    await as(alice); assert.equal(await scalar('select count(*)::int from public.listings'),0);
  });
  await test('restrictive storage policies withstand pre-existing broad permissive policies', async () => {
    await privileged();
    await sql('create policy test_overbroad_policy on storage.objects for all to anon,authenticated using(true) with check(true)');
    await as(bob);
    assert.equal(await scalar("select count(*)::int from storage.objects where bucket_id='listing-images'"),0);
    await denies("insert into storage.objects(bucket_id,name) values('listing-images','malicious.webp')");
    await as(null,'anon');
    assert.equal(await scalar("select count(*)::int from storage.objects where bucket_id='listing-images'"),0);
    await denies("insert into storage.objects(bucket_id,name) values('listing-images','anonymous.webp')");
    await privileged(); await sql('drop policy test_overbroad_policy on storage.objects');
  });
  await test('admin-owned listing image edits re-enter review without granting publication bypass', async () => {
    await as(admin); await listingInsert(lid(4),admin);
    await db.query('select public.moderate_listing($1,$2)',[lid(4),'active']);
    await privileged();
    await db.query("insert into storage.objects(bucket_id,name) values('listing-images',$1)",[`${admin}/${lid(4)}/admin-image.webp`]);
    await as(admin);
    await db.query('insert into public.listing_images(listing_id,storage_path,display_order) values($1,$2,0)',[lid(4),`${admin}/${lid(4)}/admin-image.webp`]);
    assert.equal(await scalar('select status from public.listings where id=$1',[lid(4)]),'pending_review');
    await denies("update public.listings set status='active' where id=$1",[lid(4)]);
  });
  await test('atomic rate caps cannot be expanded using caller-supplied limits or windows', async () => {
    await privileged(); await sql('delete from private.rate_limits');
    await as(bob);
    for(let i=0;i<5;i++) assert.equal(await scalar("select public.consume_rate_limit('report',999999,$1)",[i+1]),true);
    assert.equal(await scalar("select public.consume_rate_limit('report',999999,999999)"),false);
    assert.equal(await scalar("select public.consume_rate_limit('unknown',999999,60)"),false);
  });
  await test('database rate triggers reject direct REST-equivalent mutation beyond quota', async () => {
    await privileged(); await sql('delete from private.rate_limits');
    await as(bob);
    for(let i=0;i<10;i++) await db.query("update public.profiles set display_name=$1 where id=$2",[`Fictional Bob ${i}`,bob]);
    await denies("update public.profiles set display_name='Exceeded quota' where id=$1",[bob]);
  });
  console.log(`\n${passed} database integration scenarios passed using embedded PostgreSQL. Supabase Auth HTTP, Storage HTTP and hosted configuration are not covered.`);
} finally { await db.close(); }
