// Placeholder photo factory — { id, name, grad } renders as a gradient tile and
// downloads as a real generated image. Real uploads replace these with data URLs.
const P = (id, name, c1, c2) => ({ id, name, grad: [c1, c2] });

// Real-photo factory (added 2026-07-17) — { id, name, url } renders the actual
// downloaded stock photo (public/assets/vendors/*) exactly like a real upload
// would (see fileToPhoto() in lib/photoFiles.js), used for the 7 hand-authored
// vendors' logos/product photos instead of the gradient-tile placeholder.
const U = (id, name, url) => ({ id, name, url });

export const EVENT_IMG_PALETTE = [
  'linear-gradient(135deg,#B97434,#9A5B26)',
  'linear-gradient(135deg,#F0D8DD,#B97434)',
  'linear-gradient(135deg,#9FC9B9,#2D6A4F)',
  'linear-gradient(135deg,#F3D9A4,#C76A0D)',
  'linear-gradient(135deg,#d8c0a8,#8B6F4E)',
  'linear-gradient(135deg,#8C3A4E,#5C1F2E)',
];

// Events store `img` as a raw CSS `background` value — either a fallback
// gradient from the palette above, or a `url(...)` pointing at an uploaded photo.
export const isEventPhoto = (img) => typeof img === 'string' && img.trim().startsWith('url(');
export const eventImgFromFile = (dataUrl) => `url("${dataUrl}") center/cover no-repeat`;

export const INITIAL_EVENTS = [
  { id:'e1', name:'Tamu Weekend Bazaar', dateRange:'12 – 14 Jul 2026', location:'Gaya Street, KK', days:3, applied:48, fnb:300, nonfnb:250, startTime:'08:00', endTime:'16:00', lastApp:'2026-07-05', startDate:'2026-07-12', endDate:'2026-07-14', img:"url('/assets/events/e1-tamu-weekend.jpg') center/cover no-repeat" },
  { id:'e2', name:'Borneo Makers Fair',  dateRange:'26 – 27 Jul 2026', location:'Likas Square',   days:2, applied:32, fnb:280, nonfnb:230, startTime:'10:00', endTime:'18:00', lastApp:'2026-06-21', startDate:'2026-07-26', endDate:'2026-07-27', img:"url('/assets/events/e2-borneo-makers.jpg') center/cover no-repeat" },
  { id:'e3', name:'Harvest Night Market', dateRange:'2 – 4 Aug 2026', location:'Gaya Street, KK', days:3, applied:60, fnb:320, nonfnb:270, startTime:'17:00', endTime:'23:00', lastApp:'2026-07-26', startDate:'2026-08-02', endDate:'2026-08-04', img:"url('/assets/events/e3-harvest-night.jpg') center/cover no-repeat" },
  // Six more events (added 2026-07-17) spanning every eventStatus()/applications-open
  // combination so the admin Events tab, Dashboard, and vendor Available Markets
  // all have real variety to demo: e4 ongoing, e5/e6/e9 upcoming+open, e2 (above)
  // + e7 upcoming+closed, e8 concluded, e7 also doubles as the "Dates TBC" sample.
  { id:'e4', name:'Kadazan Heritage Bazaar', dateRange:'15 – 19 Jul 2026', location:'Karamunsing Complex, KK', days:5, applied:41, fnb:260, nonfnb:220, startTime:'09:00', endTime:'21:00', lastApp:'2026-07-08', startDate:'2026-07-15', endDate:'2026-07-19', img:"url('/assets/events/e4-kadazan-heritage.jpg') center/cover no-repeat" },
  { id:'e5', name:'Sunset Batik Market', dateRange:'8 – 9 Aug 2026', location:'Waterfront Esplanade, KK', days:2, applied:22, fnb:240, nonfnb:200, startTime:'16:00', endTime:'22:00', lastApp:'2026-07-30', startDate:'2026-08-08', endDate:'2026-08-09', img:"url('/assets/events/e5-sunset-batik.jpg') center/cover no-repeat" },
  { id:'e6', name:'Riverside Food Carnival', dateRange:'15 – 17 Aug 2026', location:'Riverside Promenade, KK', days:3, applied:15, fnb:300, nonfnb:260, startTime:'17:00', endTime:'23:00', lastApp:'2026-08-05', startDate:'2026-08-15', endDate:'2026-08-17', img:"url('/assets/events/e6-riverside-food.jpg') center/cover no-repeat" },
  // Dates intentionally unset — demos the "Dates TBC" status badge (eventStatus()
  // in lib/helpers.js) while applications are still open off the lastApp date alone.
  { id:'e7', name:'Artisan Night Bazaar', dateRange:'Dates to be confirmed', location:'Suria Sabah Mall Concourse', days:2, applied:9, fnb:250, nonfnb:210, startTime:'18:00', endTime:'23:00', lastApp:'2026-08-15', startDate:null, endDate:null, img:"url('/assets/events/e7-artisan-night-bazaar.jpg') center/cover no-repeat" },
  { id:'e8', name:'Handmade Sunday Market', dateRange:'5 – 6 Jul 2026', location:'Segama Bridge, KK', days:2, applied:30, fnb:220, nonfnb:190, startTime:'09:00', endTime:'17:00', lastApp:'2026-06-25', startDate:'2026-07-05', endDate:'2026-07-06', img:"url('/assets/events/e8-handmade-sunday.jpg') center/cover no-repeat" },
  { id:'e9', name:'Borneo Culture Fest', dateRange:'5 – 7 Sep 2026', location:'Suria Sabah Mall, Concourse & Rooftop', days:3, applied:12, fnb:320, nonfnb:280, startTime:'10:00', endTime:'22:00', lastApp:'2026-08-20', startDate:'2026-09-05', endDate:'2026-09-07', img:"url('/assets/events/e9-borneo-culture-fest.jpg') center/cover no-repeat" },
];

// E-Invoice & bank info collected once a vendor is approved — required before
// they can apply to any market (see einvoiceComplete() in lib/helpers.js).
// Bare `EI()` = not yet filled in by the vendor.
const EI = (companyName='', regNo='', tin='', sstNo='', regAddress='', bankName='', bankAccNo='', bankHolder='') =>
  ({ companyName, regNo, tin, sstNo, regAddress, bankName, bankAccNo, bankHolder });

// Blank e-invoice record for newly-registered vendors — filled in later from the Profile tab.
export const EMPTY_EINVOICE = EI();

// Admin-configurable list of required/optional vendor document types (mock
// default — real projects load this from the vendor_doc_types table,
// migration 0014). A vendor's uploaded docs are keyed by these ids under
// vendor.docs.byType — see normalizeDocs() in lib/helpers.js.
export const INITIAL_DOC_TYPES = [
  { id:'ssm',   label:'SSM Registration',  required:true,  sortOrder:1 },
  { id:'halal', label:'Halal / Food Cert', required:false, sortOrder:2 },
];

// Every seeded demo vendor signs in with this password (vendors registered
// through the live form carry their own — see VendorRegister). Plain text for
// the Phase 1 prototype only, same caveat as DEFAULT_ADMIN_PASSWORD below.
export const DEMO_VENDOR_PASSWORD = 'demo1234';

export const INITIAL_VENDORS = [
  { id:'v1', business:'Nutmeg & Clay',   owner:'Aisyah Rahman', category:'Handcraft / Art',          email:'aisyah@nutmegclay.my',  phone:'013-8842210', ig:'@nutmegclay',     fb:'Nutmeg & Clay',   tiktok:'@nutmegclay',  plate:'SAB 1842 K', regDate:'14 Jun', tcAcceptedAt:'14 Jun 2026, 10:24 AM', status:'approved', power:'1× kiln display light (240V), 1× LED string', logo:U('v1logo','nutmeg-clay-logo.jpg','/assets/vendors/v1-logo.jpg'), productPhotos:[U('v1p1','stoneware-mugs.jpg','/assets/vendors/v1-p1.jpg'),U('v1p2','botanical-planters.jpg','/assets/vendors/v1-p2.jpg'),U('v1p3','tableware-set.jpg','/assets/vendors/v1-p3.jpg')], desc:'Hand-thrown stoneware ceramics and small-batch botanical homewares, made in Kota Kinabalu. Mugs, planters, tableware and gift sets.', docs:{ ssm:P('v1ssm','ssm-certificate.jpg','#DCE8F5','#5B7FA6'), halal:null, extra:[] }, einvoice:EI('Aisyah Rahman','202301112233','IG88112233445','N/A','No. 21, Jalan Kelawat, 88300 Kota Kinabalu, Sabah','Maybank','156209988771','Aisyah Rahman') },
  { id:'v2', business:'Borneo Brews',    owner:'Daniel Lim',    category:'Food & Beverage',          email:'hello@borneobrews.co',   phone:'016-7720145', ig:'@borneobrews',    fb:'Borneo Brews Co', tiktok:'@borneobrews', plate:'SA 9021 P',  regDate:'15 Jun', tcAcceptedAt:'15 Jun 2026, 2:03 PM', status:'approved', power:'1× espresso machine (240V, 13A), 1× grinder, 1× chest freezer', logo:U('v2logo','borneo-brews-logo.jpg','/assets/vendors/v2-logo.jpg'), productPhotos:[U('v2p1','cold-brew-bottles.jpg','/assets/vendors/v2-p1.jpg'),U('v2p2','pour-over-set.jpg','/assets/vendors/v2-p2.jpg'),U('v2p3','coffee-beans.jpg','/assets/vendors/v2-p3.jpg'),U('v2p4','iced-latte.jpg','/assets/vendors/v2-p4.jpg')], desc:'Specialty cold brew, single-origin pour-overs and Sabah-grown coffee beans. Cups, bottles and retail bags.', einvoice:EI('Borneo Brews Sdn Bhd','202401123456','C2345678901','S01-2345-67891012','Lot 12, Jalan Gaya, 88000 Kota Kinabalu, Sabah','Maybank','156201234567','Borneo Brews Sdn Bhd') },
  { id:'v3', business:'Rattan Republic', owner:'Nadia Yusof',   category:'Fashion',                  email:'nadia@rattanrepublic.my',phone:'011-23398871', ig:'@rattan.republic',fb:'Rattan Republic', tiktok:'@rattanrepublic',plate:'SAB 553 T', regDate:'16 Jun', tcAcceptedAt:'16 Jun 2026, 9:47 AM', status:'approved', power:'None', logo:U('v3logo','rattan-republic-logo.jpg','/assets/vendors/v3-logo.jpg'), productPhotos:[U('v3p1','rattan-tote.jpg','/assets/vendors/v3-p1.jpg'),U('v3p2','woven-hat.jpg','/assets/vendors/v3-p2.jpg'),U('v3p3','clutch-bags.jpg','/assets/vendors/v3-p3.jpg'),U('v3p4','market-basket.jpg','/assets/vendors/v3-p4.jpg'),U('v3p5','earrings-set.jpg','/assets/vendors/v3-p5.jpg')], desc:'Handwoven rattan bags, hats and accessories using traditional Sabahan weaving techniques.', einvoice:EI() },
  { id:'v4', business:'Pulau Soap Co.',  owner:'Grace Wong',    category:'Beauty & Wellness',        email:'grace@pulausoap.my',     phone:'014-6650092', ig:'@pulausoap',      fb:'Pulau Soap Co',   tiktok:'@pulausoap',   plate:'SS 1180 A',  regDate:'17 Jun', tcAcceptedAt:'17 Jun 2026, 8:31 PM', status:'approved', power:'1× display fridge (240V)', logo:U('v4logo','pulau-soap-logo.jpg','/assets/vendors/v4-logo.jpg'), productPhotos:[U('v4p1','botanical-soaps.jpg','/assets/vendors/v4-p1.jpg'),U('v4p2','body-scrubs.jpg','/assets/vendors/v4-p2.jpg')], desc:'Cold-process artisan soaps, body scrubs and balms made with island botanicals. Plastic-free packaging.', einvoice:EI('Grace Wong','IG12345678901','','N/A','No. 8, Jalan Pulau, 88100 Kota Kinabalu, Sabah','CIMB Bank','7012345678','Grace Wong') },
  { id:'v5', business:'Kinabalu Kopi',   owner:'Faiz Anuar',    category:'Food & Beverage',          email:'faiz@kkkopi.my',         phone:'012-3041188', ig:'@kinabalukopi',   fb:'Kinabalu Kopi',   tiktok:'@kkkopi',      plate:'SAB 700 G',  regDate:'18 Jun', tcAcceptedAt:'18 Jun 2026, 11:15 AM', status:'approved', power:'1× coffee machine (240V, 13A), 1× water boiler', logo:U('v5logo','kinabalu-kopi-logo.jpg','/assets/vendors/v5-logo.jpg'), productPhotos:[U('v5p1','kopi-o-classic.jpg','/assets/vendors/v5-p1.jpg'),U('v5p2','kaya-toast.jpg','/assets/vendors/v5-p2.jpg'),U('v5p3','retail-packs.jpg','/assets/vendors/v5-p3.jpg')], desc:'Traditional Sabah kopi, kaya toast and local kuih. Hot and iced drinks plus retail coffee packs.', einvoice:EI() },
  { id:'v6', business:'Kadazan Silver',  owner:'Melissa Anak Robert', category:'Jewellery',          email:'melissa@kadazansilver.my', phone:'019-8801234', ig:'@kadazansilver',  fb:'Kadazan Silver',  tiktok:'@kadazansilver', plate:'SAB 2201 R', regDate:'9 Jul',  tcAcceptedAt:'9 Jul 2026, 4:56 PM', status:'pending',  power:'None', logo:U('v6logo','kadazan-silver-logo.jpg','/assets/vendors/v6-logo.jpg'), productPhotos:[U('v6p1','motif-rings.jpg','/assets/vendors/v6-p1.jpg'),U('v6p2','pendants.jpg','/assets/vendors/v6-p2.jpg'),U('v6p3','pattern-cuffs.jpg','/assets/vendors/v6-p3.jpg')], desc:'Handcrafted silver jewellery inspired by Kadazan-Dusun motifs — rings, pendants and traditional-pattern cuffs.', einvoice:EI() },
  { id:'v7', business:'Rumah Anyaman',   owner:'Joseph Majanil', category:'Home & Lifestyle',        email:'joseph@rumahanyaman.my', phone:'017-2093345', ig:'@rumahanyaman',   fb:'Rumah Anyaman',   tiktok:'@rumahanyaman', plate:'SS 442 B',   regDate:'10 Jul', tcAcceptedAt:'10 Jul 2026, 1:12 PM', status:'pending',  power:'None', logo:U('v7logo','rumah-anyaman-logo.jpg','/assets/vendors/v7-logo.jpg'), productPhotos:[U('v7p1','pandan-baskets.jpg','/assets/vendors/v7-p1.jpg'),U('v7p2','placemats.jpg','/assets/vendors/v7-p2.jpg'),U('v7p3','storage-boxes.jpg','/assets/vendors/v7-p3.jpg'),U('v7p4','bamboo-trays.jpg','/assets/vendors/v7-p4.jpg')], desc:'Woven pandan and bamboo homeware — baskets, placemats and storage pieces made by a Kudat weaving collective.', einvoice:EI() },
  ...genDemoVendors(68), // v8..v75 — filler vendors so the Categories tab's "All Vendors" table has enough rows to demo real pagination
  ...genDemoVendors(30, { startNum: 76, status: 'pending' }), // v76..v105 — pending fillers so Vendor Applications has 30+ rows to manually check (2026-07-16)
  // rejected/suspended fillers (added 2026-07-17) — until now no vendor anywhere
  // in the mock data carried either status, so the Vendor Applications "Show N
  // rejected applications" collapsed section and Vendor Listing's Suspend/
  // Reinstate flow had nothing to demo against.
  ...genDemoVendors(5, { startNum: 106, status: 'rejected' }),  // v106..v110
  ...genDemoVendors(5, { startNum: 111, status: 'suspended' }), // v111..v115
];

// Deterministic filler vendors (not hand-authored like v1–v7 above) — exist purely
// so vendor-listing tables have enough rows to demo real pagination. `startNum`/
// `status` let the same generator produce both the original approved fillers
// (v8..v75, Categories tab) and a second pending-status batch (v76..v105,
// Vendor Applications tab — added 2026-07-16 alongside every other tab's demo data).
function genDemoVendors(count, { startNum = 8, status = 'approved' } = {}) {
  const CAT_NAMES = ['Food & Beverage','Handcraft / Art','Fashion','Jewellery','Beauty & Wellness','Home & Lifestyle','Creative Services / Experience','Books / Stationery','Others'];
  const BIZ_PREFIX = ['Borneo','Tamu','Kinabalu','Sabah','Pulau','Rimba','Nusa','Kudat','Ranau','Papar','Tuaran','Sipitang'];
  const BIZ_WORD = ['Craft','Kitchen','Studio','Collective','Workshop','Trading','House','Bites','Wares','Atelier','Kopi','Batik'];
  const OWNER_FIRST = ['Aisyah','Daniel','Nadia','Grace','Faiz','Melissa','Joseph','Amirul','Siti','Wong','Chong','Farah','Aiman','Nurul','Hafiz','Jason','Lily','Kevin','Rosnah','Azman'];
  const OWNER_LAST = ['Rahman','Lim','Yusof','Wong','Anuar','Robert','Majanil','Idris','Chan','Hassan','Tan','Sabri','Lee','Osman','Junaidi'];
  const out = [];
  for (let i = 0; i < count; i++) {
    const n = startNum - 8 + i; // keeps name/category cycling continuous across both batches instead of repeating from i=0
    const business = `${BIZ_PREFIX[n % BIZ_PREFIX.length]} ${BIZ_WORD[(n * 3 + 1) % BIZ_WORD.length]}`;
    const owner = `${OWNER_FIRST[n % OWNER_FIRST.length]} ${OWNER_LAST[(n * 5 + 2) % OWNER_LAST.length]}`;
    const category = CAT_NAMES[n % CAT_NAMES.length];
    const slug = business.toLowerCase().replace(/[^a-z0-9]+/g, '') + startNum;
    out.push({
      id: 'v' + (startNum + i), business, owner, category,
      email: `${owner.split(' ')[0].toLowerCase()}@${slug}.my`,
      phone: `01${2 + (n % 8)}-${String(2000000 + n * 137).slice(0, 7)}`,
      ig: '@' + slug, fb: business, tiktok: '@' + slug,
      plate: `SAB ${1000 + n} ${String.fromCharCode(65 + (n % 26))}`,
      regDate: `${(n % 28) + 1} Jul`,
      tcAcceptedAt: `${(n % 28) + 1} Jul 2026, ${9 + (n % 8)}:00 AM`,
      status,
      power: 'None',
      logo: null,
      productPhotos: [],
      desc: `${business} is a Sabahan ${category.toLowerCase()} vendor showcasing local craftsmanship at Sulap Artisan markets.`,
      einvoice: EI(),
    });
  }
  return out;
}

// Deterministic filler event applications — one status-batch of 30 lets Payments,
// Deposit Record, Parking, Event Pictures, Vendor Pass, and Event Applications'
// Shortlist sub-tab all show real multi-page pagination for Tamu Weekend Bazaar
// (e1) simultaneously, since they all filter on `apps` with `status:'approved'`;
// the other batch of 30 gives Event Applications' own Applications sub-tab
// (`status:'pending'`) the same. Added 2026-07-16 alongside the table-style
// rollout so every touched tab has enough rows to manually check.
// `appliedAt` (ISO string) drives the Dashboard's "Recent Applications" table
// (most-recent-first) and is stamped for real when a vendor submits a new
// application (see the `newApp` object in components/Modals.jsx) — these seed
// values are just plausible fill-in dates so that table has something to sort
// on out of the box.
function genDemoApps(vendorIds, eventId, status, idPrefix, anchorDate) {
  return vendorIds.map((vid, i) => ({
    id: `${idPrefix}${i + 1}`, vendorId: vid, eventId, status, shared: false, partners: [],
    appliedAt: new Date(anchorDate.getTime() - (i + 1) * 86400000).toISOString(),
  }));
}
const DEMO_APP_APPROVED_VENDORS = Array.from({ length: 30 }, (_, i) => 'v' + (8 + i));   // v8..v37
const DEMO_APP_PENDING_VENDORS  = Array.from({ length: 30 }, (_, i) => 'v' + (38 + i));  // v38..v67
// 'shortlisted' had no demo rows anywhere (added 2026-07-17) — the Event
// Applications "Shortlist" sub-tab groups shortlisted+approved together, but
// with zero shortlisted rows it only ever showed the already-approved batch.
const DEMO_APP_SHORTLISTED_VENDORS = Array.from({ length: 8 }, (_, i) => 'v' + (68 + i)); // v68..v75

export const INITIAL_APPS = [
  { id:'a1', vendorId:'v2', eventId:'e1', status:'pending',  shared:false, partners:[], appliedAt:'2026-07-01T09:30:00' },
  { id:'a2', vendorId:'v1', eventId:'e1', status:'approved', shared:true,  partners:['v4'], appliedAt:'2026-06-20T10:15:00' },
  { id:'a3', vendorId:'v4', eventId:'e1', status:'approved', shared:true,  partners:['v1'], appliedAt:'2026-06-22T14:00:00' },
  { id:'a4', vendorId:'v3', eventId:'e2', status:'pending',  shared:false, partners:[], appliedAt:'2026-06-15T11:45:00' },
  { id:'a5', vendorId:'v5', eventId:'e2', status:'approved', shared:false, partners:[], appliedAt:'2026-06-10T16:20:00' },
  { id:'a6', vendorId:'v3', eventId:'e3', status:'pending',  shared:false, partners:[], appliedAt:'2026-07-15T13:05:00' },
  { id:'a7', vendorId:'v5', eventId:'e1', status:'approved', shared:false, partners:[], appliedAt:'2026-06-25T08:40:00' },
  { id:'a8', vendorId:'v3', eventId:'e1', status:'approved', shared:false, partners:[], appliedAt:'2026-06-28T15:10:00' },
  ...genDemoApps(DEMO_APP_APPROVED_VENDORS, 'e1', 'approved', 'da-appr-', new Date('2026-07-16T12:00:00')),
  ...genDemoApps(DEMO_APP_PENDING_VENDORS,  'e1', 'pending',  'da-pend-', new Date('2026-07-16T12:00:00')),
  ...genDemoApps(DEMO_APP_SHORTLISTED_VENDORS, 'e1', 'shortlisted', 'da-short-', new Date('2026-07-16T12:00:00')),
  // A handful of hand-authored applications to the new events (2026-07-17) so
  // the Event Applications/Payments/Dashboard "select event" dropdowns aren't
  // e1-only — mixed statuses, reusing existing hand-authored vendors.
  { id:'a9',  vendorId:'v2', eventId:'e4', status:'pending',     shared:false, partners:[], appliedAt:'2026-07-10T09:00:00' },
  { id:'a10', vendorId:'v5', eventId:'e4', status:'approved',    shared:false, partners:[], appliedAt:'2026-07-09T11:30:00' },
  { id:'a11', vendorId:'v8', eventId:'e4', status:'shortlisted', shared:false, partners:[], appliedAt:'2026-07-11T14:00:00' },
  { id:'a12', vendorId:'v9', eventId:'e4', status:'shortlisted', shared:false, partners:[], appliedAt:'2026-07-11T15:20:00' },
  { id:'a13', vendorId:'v3', eventId:'e6', status:'pending',     shared:false, partners:[], appliedAt:'2026-07-14T10:00:00' },
  { id:'a14', vendorId:'v10',eventId:'e6', status:'approved',    shared:false, partners:[], appliedAt:'2026-07-13T16:45:00' },
  { id:'a15', vendorId:'v6', eventId:'e9', status:'pending',     shared:false, partners:[], appliedAt:'2026-07-15T08:10:00' },
  { id:'a16', vendorId:'v11',eventId:'e9', status:'approved',    shared:false, partners:[], appliedAt:'2026-07-14T13:00:00' },
];

// Payment docs (advice/advice2/invoice/receipt) are file objects like photos.
// `scans` holds auto-scan results per advice field: { amount, at }.
export const INITIAL_PAYMENTS = {
  'v2-e1': { status:'paid',    paid:1054.00, advice:P('v2adv','payment-advice-borneo.jpg','#DCE8F5','#5B7FA6'), invoice:P('v2inv','invoice-INV-E1-002.jpg','#EDE5D8','#A08A5F'), receipt:P('v2rct','receipt-borneo.jpg','#E2EFE2','#5F9A6E'), scans:{ advice:{ amount:1054.00, at:'10 Jul' } } },
  'v1-e1': { status:'partial', paid:300,     advice:P('v1adv','payment-advice-nutmeg.jpg','#DCE8F5','#5B7FA6'), invoice:P('v1inv','invoice-INV-E1-001.jpg','#EDE5D8','#A08A5F'), scans:{ advice:{ amount:300, at:'9 Jul' } } },
};

// Tracks which vendors' payment advices admin has bulk-downloaded,
// keyed `${vendorId}-${eventId}` → date string.
export const INITIAL_PAY_DOC_DOWNLOADS = {};

export const INITIAL_REFUNDS = {};

// 27 more deposit records (on top of the 3 hand-authored ones below) so
// Deposit Record has ~30 vendors showing real paid/refunded status instead of
// the default "Unpaid" — added 2026-07-16 alongside the other demo data.
function genDemoDeposits(count, startNum) {
  const out = {};
  const cycle = ['paid', 'unpaid', 'refunded'];
  for (let i = 0; i < count; i++) {
    const status = cycle[i % cycle.length];
    if (status === 'unpaid') { out['v' + (startNum + i)] = { status, inv:'', payDate:'', refundDate:'' }; continue; }
    out['v' + (startNum + i)] = {
      status,
      inv: `DEP-${1100 + i}`,
      payDate: `2026-06-${String((i % 27) + 1).padStart(2, '0')}`,
      refundDate: status === 'refunded' ? `2026-07-${String((i % 14) + 1).padStart(2, '0')}` : '',
    };
  }
  return out;
}

export const INITIAL_DEPOSITS = {
  v1: { status:'paid',     inv:'DEP-1042', payDate:'2026-06-18', refundDate:'' },
  v3: { status:'refunded', inv:'DEP-0991', payDate:'2026-05-02', refundDate:'2026-06-10' },
  v5: { status:'paid',     inv:'DEP-1050', payDate:'2026-06-20', refundDate:'' },
  ...genDemoDeposits(27, 8), // v8..v34
};

// 30 more offence records, spread across the e1-approved demo vendors and every
// offence type, so Compliance's Vendor review sub-tab has real per-vendor
// history to expand instead of "No offences on record" almost everywhere.
// Added 2026-07-16 alongside the other demo data.
function genDemoOffenses(count, startNum) {
  const TYPES = ['late_open', 'early_close', 'late_pay', 'cleanup', 'no_show', 'unsanctioned'];
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({ id: `do${i + 1}`, vendorId: 'v' + (startNum + (i % 30)), eventId: 'e1', type: TYPES[i % TYPES.length], photos: [] });
  }
  return out;
}

// Offences may carry photo evidence (`photos`) that vendors can view in their portal.
export const INITIAL_OFFENSES = [
  { id:'o1', vendorId:'v2', eventId:'e1', type:'late_open', photos:[P('o1p1','booth-still-closed-9am.jpg','#C9B8A5','#6B5843')] },
  { id:'o2', vendorId:'v2', eventId:'e2', type:'late_open', photos:[] },
  { id:'o3', vendorId:'v4', eventId:'e1', type:'late_pay',  photos:[] },
  { id:'o4', vendorId:'v3', eventId:'e1', type:'no_show',   photos:[] },
  { id:'o5', vendorId:'v2', eventId:'e1', type:'cleanup',   photos:[P('o5p1','booth-cleanup-issue.jpg','#B5C4B1','#4F6B4A')] },
  ...genDemoOffenses(30, 8), // v8..v37
];

// Color pairs assigned to newly added offence types, cycled in order.
export const OFFENSE_PALETTE = [
  { color:'#0E7490', bg:'#E0F2FE' },
  { color:'#BE185D', bg:'#FCE7F3' },
  { color:'#4D7C0F', bg:'#ECFCCB' },
  { color:'#B45309', bg:'#FEF3C7' },
  { color:'#6D28D9', bg:'#EDE9FE' },
  { color:'#B91C1C', bg:'#FEE2E2' },
];

// Admin-uploaded event photos, keyed `${vendorId}-${eventId}`.
// Vendors download these from their Event Pictures tab.
export const INITIAL_EVENT_PHOTOS = {
  'v1-e1': [P('v1e1a','booth-opening.jpg','#B97434','#5C1F2E'), P('v1e1b','crowd-evening.jpg','#8C3A4E','#2A1420')],
};

// Tracks which vendors' product photos admin has already bulk-downloaded,
// keyed `${vendorId}-${eventId}` → date string.
export const INITIAL_PHOTO_DOWNLOADS = {};

export const INITIAL_PARKING = {
  'v1-e1-1':'P-A12', 'v1-e1-2':'P-A12', 'v1-e1-3':'P-A12',
};

// Digital Vendor Pass — one application per vendor+event, holding up to
// `PASS_SELF_SERVICE_MAX + extraApproved` people (name + photo each, see
// EMPTY_PASS_PERSON). Each pass holder is approved/rejected **individually**
// (`person.status`) — there is no single app-wide status; admin decides one
// person at a time, and a vendor can edit-and-resubmit one person without
// touching the others. A vendor can self-service fill slots up to
// PASS_SELF_SERVICE_MAX with no admin action needed; going beyond that is
// admin-initiated only — admin grants extra slots directly (`extraApproved`),
// there is no vendor-side request to approve (see "Vendor Pass" business
// rule in PROJECT_NOTES.md).
export const EMPTY_PASS_PERSON = () => ({ id:'pp'+Date.now()+Math.random().toString(36).slice(2,7), name:'', photo:null });

export const PASS_SELF_SERVICE_MAX = 3;

// Fixed reasons admin can pick when rejecting an individual pass holder's photo —
// 'other' unlocks a free-text field for anything not covered by the list.
export const PASS_REJECT_REASONS = {
  blurry:    'Photo is unclear or blurry',
  not_real:  'Not an actual photo of a person (e.g. a random image, logo, or drawing)',
  no_face:   "Face isn't clearly visible in the photo",
  mismatch:  "Name doesn't appear to match the person in the photo",
  duplicate: 'This person already has an approved pass for this event',
  other:     'Other reason',
};

export const INITIAL_PASS_APPS = [
  { id:'vp1', vendorId:'v1', eventId:'e1', extraApproved:1, boothNumber:'A12', submittedAt:'10 Jul',
    people:[
      { id:'vp1p1', name:'Aisyah Rahman', photo:P('vp1p1','aisyah-pass.jpg','#E8C5B8','#A56548'), status:'approved', rejectReason:null, decidedAt:'11 Jul' },
      { id:'vp1p2', name:'Farah Idris',   photo:P('vp1p2','farah-pass.jpg','#D9C6A5','#8B6F4E'),   status:'approved', rejectReason:null, decidedAt:'11 Jul' },
    ] },
  { id:'vp2', vendorId:'v4', eventId:'e1', extraApproved:0, boothNumber:'', submittedAt:'12 Jul',
    people:[
      { id:'vp2p1', name:'Grace Wong', photo:P('vp2p1','grace-pass.jpg','#F0D8DD','#B97434'), status:'pending', rejectReason:null, decidedAt:null },
    ] },
  ...genDemoPassApps(20, 8), // v8..v27 — leaves v28..v37 with "no application yet" for a realistic mix
];

// 20 more pass applications (1-2 pass holders each, mixed approved/pending/
// rejected) so Vendor Pass has real summaries to check instead of "No Vendor
// Pass application yet" on every demo row. Added 2026-07-16.
function genDemoPassApps(count, startNum) {
  const STATUSES = ['approved', 'pending', 'rejected'];
  const NAMES = ['Aina', 'Ben', 'Chong', 'Dewi', 'Eddy', 'Farah', 'Gopal', 'Hana', 'Ismail', 'Jia', 'Kavi', 'Lina', 'Mira', 'Nasir', 'Oscar', 'Priya', 'Qistina', 'Ravi', 'Sara', 'Tariq'];
  const OWNER_LAST_FOR_PASS = ['Rahman', 'Lim', 'Yusof', 'Wong', 'Anuar', 'Robert'];
  const out = [];
  for (let i = 0; i < count; i++) {
    const peopleCount = 1 + (i % 2);
    const people = Array.from({ length: peopleCount }, (_, pi) => {
      const status = STATUSES[(i + pi) % STATUSES.length];
      return {
        id: `dpp${i}_${pi}`,
        name: `${NAMES[(i + pi) % NAMES.length]} ${OWNER_LAST_FOR_PASS[(i + pi) % OWNER_LAST_FOR_PASS.length]}`,
        photo: P(`dpp${i}_${pi}img`, `pass-${i}-${pi}.jpg`, '#D8C6A5', '#8B6F4E'),
        status,
        rejectReason: status === 'rejected' ? 'Photo is unclear or blurry' : null,
        decidedAt: status === 'pending' ? null : '12 Jul',
      };
    });
    out.push({ id: `dvp${i + 1}`, vendorId: 'v' + (startNum + i), eventId: 'e1', extraApproved: 0, boothNumber: i % 3 === 0 ? `B${10 + i}` : '', submittedAt: '11 Jul', people });
  }
  return out;
}

// 30 pending profile change requests so the Profile Requests tab has real
// rows/pagination to check instead of starting empty (it previously had no
// seed data at all — `profileRequests: []` in store.jsx). Mostly locked-detail
// changes (e.g. a phone number update) with every 4th one an e-invoice/bank
// change, matching the two sections DETAILS_FIELDS/EINVOICE_FIELDS cover.
// Added 2026-07-16 alongside the other demo data.
function genDemoProfileRequests(count, startNum) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const vid = 'v' + (startNum + i);
    const v = INITIAL_VENDORS.find(x => x.id === vid) || {};
    const isEinvoice = i % 4 === 3;
    const section = isEinvoice ? 'einvoice' : 'details';
    // `changes` must snapshot every field the section covers (not just the one
    // that actually changed) — the admin UI diffs each DETAILS_FIELDS/
    // EINVOICE_FIELDS key against `v[k]`/`v.einvoice[k]`, so any key missing
    // from `changes` reads as "changed to blank" instead of "unchanged".
    const changes = isEinvoice
      ? { ...v.einvoice, bankName: 'CIMB Bank', bankAccNo: `70${1000000 + i}` }
      : { business: v.business, owner: v.owner, category: v.category, email: v.email, plate: v.plate, desc: v.desc, phone: `01${3 + (i % 6)}-${String(9000000 + i * 111).slice(0, 7)}` };
    out.push({ id: `dpr${i + 1}`, vendorId: vid, section, changes, submittedAt: `${(i % 28) + 1} Jul`, status: 'pending' });
  }
  return out;
}
export const INITIAL_PROFILE_REQUESTS = genDemoProfileRequests(30, 8); // v8..v37

export const INITIAL_CATS = [
  { id:'c-fnb',      icon:'utensils', name:'Food & Beverage',                desc:'Coffee, drinks, cakes, cookies, desserts, snacks, meals, packaged food' },
  { id:'c-craft',    icon:'palette',  name:'Handcraft / Art',                desc:'Paintings, prints, pottery, crochet, candles, resin art, handmade décor' },
  { id:'c-fashion',  icon:'shopbag',  name:'Fashion',                        desc:'Clothing, thrift wear, upcycled fashion, tote bags, scarves, batik' },
  { id:'c-jewel',    icon:'sparkles', name:'Jewellery',                      desc:'Earrings, bracelets, necklaces, rings, beaded & clay accessories' },
  { id:'c-beauty',   icon:'droplet',  name:'Beauty & Wellness',              desc:'Handmade soap, body scrub, balm, perfume, essential oils, bath' },
  { id:'c-home',     icon:'home',     name:'Home & Lifestyle',               desc:'Home décor, tableware, room fragrance, plants, dried flowers, gifts' },
  { id:'c-creative', icon:'pen',      name:'Creative Services / Experience', desc:'Portrait drawing, calligraphy, henna, workshops, live painting' },
  { id:'c-books',    icon:'file',     name:'Books / Stationery',             desc:'Zines, journals, notebooks, postcards, stickers, bookmarks, planners' },
  { id:'c-other',    icon:'folder',   name:'Others',                         desc:'Any product or service not listed above' },
];

export const INITIAL_CONTENT = {
  // Hero section (public home page, top of page)
  heroTitle:    'Showcase your craft at Sulap Artisan markets',
  heroSubtitle: 'Join a curated community of Sabahan makers at Suria Sabah Shopping Mall. Apply online, book your booth, and bring your craft to thousands of visitors.',
  heroImage:    '/assets/content/hero.jpg', // real photo (2026-07-17); data URL from admin upload takes over from here, else gradient placeholder
  heroTag1:     '40+ Artisan Vendors',
  heroTag2:     'Monthly Markets',

  // "Coming Soon" carousel (public home page) — cards are generated live from
  // state.events (see PublicHome.jsx); only the section heading is admin-authored.
  comingSoonHeading: 'COMING SOON',

  // "Why Join" section (public home page) — 2x2 photo grid + heading + 4
  // numbered feature items.
  whyJoinTitle:    'Why join Sulap Artisan?',
  whyJoinSubtitle: 'A market platform built for local makers, run by Suria Sabah Shopping Mall.',
  whyJoinImages: [
    { id: 'wj-img1', image: '/assets/content/why-join-1.jpg' },
    { id: 'wj-img2', image: '/assets/content/why-join-2.jpg' },
    { id: 'wj-img3', image: '/assets/content/why-join-3.jpg' },
    { id: 'wj-img4', image: '/assets/content/why-join-4.jpg' },
  ],
  whyJoinItems: [
    { id: 'wj1', title: 'Prime mall location',        body: 'Trade in the heart of Kota Kinabalu with steady daily footfall.' },
    { id: 'wj2', title: 'Simple online application',   body: 'Apply in minutes and track your application from the vendor portal.' },
    { id: 'wj3', title: 'Curated maker community',     body: 'Stand alongside quality Sabahan crafts, food, and design.' },
    { id: 'wj4', title: 'Flexible booth rates',        body: 'Daily rates for F&B and non-F&B booths — pay only for the days you trade.' },
  ],

  // "Our Gallery" section (public home page) — dark auto-scrolling photo
  // strip. Admin can add/remove any number of tiles (see AdminDashboard's
  // Content tab); this seed set is just a starting point, not a fixed count.
  galleryHeading: 'OUR GALLERY',
  galleryImages: [
    { id: 'g1', image: '/assets/content/gallery-1.jpg' }, { id: 'g2', image: '/assets/content/gallery-2.jpg' },
    { id: 'g3', image: '/assets/content/gallery-3.jpg' }, { id: 'g4', image: '/assets/content/gallery-4.jpg' },
    { id: 'g5', image: '/assets/content/gallery-5.jpg' }, { id: 'g6', image: '/assets/content/gallery-6.jpg' },
    { id: 'g7', image: '/assets/content/gallery-7.jpg' }, { id: 'g8', image: '/assets/content/gallery-8.jpg' },
  ],

  // CTA banner (public home page, above the footer)
  ctaTitle:    'Ready to showcase your craft?',
  ctaSubtitle: 'Applications for upcoming markets are open now. Join the Sulap Artisan vendor community today.',

  // Footer (public home page) — logo + "Vendors" nav links stay code-driven
  // (site branding / navigation, not editable copy).
  footerDescription: 'Sulap Artisan is a curated artisan market series by Suria Sabah Shopping Mall, celebrating Sabahan craft, food, and culture.',
  footerAddress:      'Suria Sabah Shopping Mall\n1, Jalan Tun Fuad Stephens\n88000 Kota Kinabalu, Sabah',
  footerCopyright:    '© 2026 Sulap Artisan · Suria Sabah Shopping Mall. All rights reserved.',

  // Rich HTML (edited via the Content tab's WYSIWYG editor — see rule 20 in
  // PROJECT_NOTES.md). Rendered with dangerouslySetInnerHTML in
  // VendorRegister.jsx and inserted raw into the generated PDF in
  // lib/signupForm.js, so this must always be admin-authored, never
  // user-submitted, content.
  terms: `<p><strong>1. Application &amp; selection</strong></p>
<p>Submitting this form is an application only. Sulap Artisan reviews every vendor and selects participants per market. Acceptance is confirmed by email.</p>
<p><strong>2. Booth fees &amp; payment</strong></p>
<p>Confirmed vendors pay the booth fee for the event before market day. Spots are released if payment is not received by the stated deadline.</p>
<p><strong>3. Products &amp; accuracy</strong></p>
<p>You agree to sell only the products described in your application. Major changes must be approved by the Sulap team beforehand.</p>
<p><strong>4. Setup, conduct &amp; teardown</strong></p>
<p>Vendors keep to their assigned booth and setup/teardown times, follow venue rules, and maintain a clean, safe stall throughout the event.</p>
<p><strong>5. Cancellation</strong></p>
<p>Cancellations within 7 days of the event may forfeit the booth fee. No-shows may affect future applications.</p>
<p><strong>6. Liability</strong></p>
<p>Vendors are responsible for their own stock, equipment and insurance. Sulap Artisan is not liable for loss or damage to vendor property.</p>`,
};

export const OFFENSE_TYPES = {
  late_open:  { label:'Late opening',                   color:'#B7770D', bg:'#FEF8EC' },
  early_close:{ label:'Early closing',                  color:'#B03A2E', bg:'#FDEEEC' },
  late_pay:   { label:'Late payment',                   color:'#7C3AED', bg:'#EDE9FE' },
  cleanup:    { label:'Poor booth cleanup',             color:'#2D6A4F', bg:'#E8F5F0' },
  no_show:    { label:'No-show / last-minute withdraw', color:'#9A5B26', bg:'#F3E4CC' },
  unsanctioned:{ label:'Unsanctioned selling',          color:'#1D4ED8', bg:'#DBEAFE' },
};

// (CURRENT_VENDOR_ID removed 2026-07-19 — the signed-in vendor now lives in
// store state as `currentVendorId`, set by a real email+password match in
// VendorLogin. Demo sign-in: any seeded vendor's email + DEMO_VENDOR_PASSWORD.)

// ── Admin accounts ────────────────────────────────────────────────────────────
// New admins start with the default password and must set their own on first
// sign-in. perms maps tabId → 'view' | 'edit'; a missing tab means no access
// (least privilege — newly added console tabs stay off until granted).
// NOTE: passwords are plain text for the Phase 1 prototype only — Phase 2
// replaces this with Supabase Auth (hashed, server-side).
export const DEFAULT_ADMIN_PASSWORD = '00000';
export const INITIAL_ADMINS = [
  { id:'admin',   name:'Siti Aminah', role:'super', password:'sulap123', mustReset:false, perms:{}, avatar:null },
  { id:'staff01', name:'Ahmad Fauzi', role:'staff', password:DEFAULT_ADMIN_PASSWORD, mustReset:true, perms:{ overview:'view', payments:'edit', parking:'view', photos:'view' }, avatar:null },
];

export const INITIAL_ACTIVITY = [
  { id:'act1', who:'Admin',        what:'approved Nutmeg & Clay as a vendor.',           when:'28 Jun 10:42 AM', tint:'#F3E4CC', icon:'check',    type:'admin' },
  { id:'act2', who:'Borneo Brews', what:'submitted a vendor application.',                when:'28 Jun 9:15 AM',  tint:'#FEF8EC', icon:'pen',      type:'vendor' },
  { id:'act3', who:'Admin',        what:'created the Harvest Night Market event.',        when:'27 Jun 4:30 PM', tint:'#E8F5F0', icon:'tent',  type:'admin' },
  { id:'act4', who:'Rattan Republic',what:'applied for Borneo Makers Fair.',             when:'27 Jun 2:18 PM', tint:'#F3E4CC', icon:'clipboard', type:'vendor' },
  { id:'act5', who:'Admin',        what:'updated deposit record for Kinabalu Kopi.',      when:'28 Jun 11:00 AM', tint:'#EEF1FB', icon:'wallet',  type:'admin' },
];
