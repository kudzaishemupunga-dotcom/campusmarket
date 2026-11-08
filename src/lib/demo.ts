import type { Category, Listing, PageData, Profile } from './types';
const date = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
export const demoUserId = '20000000-0000-4000-8000-000000000001';
const sellerId = '20000000-0000-4000-8000-000000000002';
export const categories: Category[] = ['Textbooks','Calculators','Stationery','School Supplies','Electronics','Bags','Sports Equipment','Other Approved Items'].map((name, i) => ({ id: `10000000-0000-4000-8000-00000000000${i + 1}`, name, slug: name.toLowerCase().replaceAll(' ', '-'), description: `Pre-loved ${name.toLowerCase()} for your next school day.`, display_order: i + 1 }));
const profile: Profile = { id: demoUserId, display_name: 'Tariro M.', avatar_path: null, role: 'student', verification_status: 'approved', created_at: date(30), updated_at: date(1) };
const items = [
  ['Scientific Calculator','12.00',1,'Like New','calculator','A reliable scientific calculator for maths and science. All functions work perfectly, with a clean display and protective slide cover. Ready for a new school year.',sellerId,'Nyasha K.','active'],
  ['Mathematics Textbook','8.00',0,'Good','maths','A well-kept secondary school mathematics textbook. Clear pages with a few helpful pencil notes. Ideal for practice and exam preparation.',sellerId,'Chipo R.','active'],
  ['School Backpack','15.00',5,'Like New','backpack','A sturdy teal backpack with plenty of space for books, a padded laptop pocket, and two bottle holders. All zips work and straps are comfortable.',demoUserId,'Tariro M.','active'],
  ['Geometry Set','5.00',2,'New','geometry','Complete geometry set with compass, divider, ruler, protractor and set squares. Unused and in its original case.',sellerId,'Rudo T.','active'],
  ['Physics Revision Guide','10.00',0,'Good','physics','A handy physics revision guide with diagrams, worked examples and practice questions. No missing pages.',demoUserId,'Tariro M.','active'],
  ['USB Flash Drive · 32GB','7.00',4,'Like New','usb','A compact 32GB USB drive for school projects. Formatted and ready to use. Includes a protective cap.',sellerId,'Tendai P.','active'],
  ['Practice Football','9.00',6,'Good','football','A size 5 football for lunchtime practice. Holds air well, with some light marks from use.',sellerId,'Farai S.','active'],
  ['Everyday Notebook Set','4.00',3,'New','notebooks','Three unused lined notebooks with durable covers. Plenty of room for your next big ideas.',demoUserId,'Tariro M.','active'],
  ['Revision Flashcards','3.00',7,'New','notebooks','Blank revision cards in assorted colours. Organise your notes and make exam prep your own.',demoUserId,'Tariro M.','pending_review'],
  ['Spare Geometry Set','4.00',2,'Fair','geometry','A used but complete geometry set, ideal as a spare for school.',demoUserId,'Tariro M.','sold'],
] as const;
const listings: Listing[] = items.map((item, i) => {
  const id = `30000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
  return { id, title: item[0], price: item[1], category_id: categories[item[2]].id, condition: item[3], description: item[5], seller_id: item[6], seller_name: item[7], status: item[8], created_at: date(i < 2 ? 0 : i), updated_at: date(i), images: [{ id: `40000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, listing_id: id, storage_path: `/products/${item[4]}.svg`, url: `/products/${item[4]}.svg`, display_order: 0 }] };
});
export const demoData: PageData = { mode: 'demo', profile, listings, categories, savedIds: [listings[1].id, listings[4].id], profiles: [profile, { ...profile, id: sellerId, display_name: 'Nyasha K.' }, { ...profile, id: '20000000-0000-4000-8000-000000000003', display_name: 'Kuda N.', verification_status: 'pending' }], reports: [{ id: '50000000-0000-4000-8000-000000000001', listing_id: listings[6].id, reporter_id: demoUserId, reason: 'Inaccurate description', details: 'Please check the item condition before approving an exchange.', status: 'open', created_at: date(0), resolved_at: null }], events: [] };
