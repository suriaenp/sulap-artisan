// Placeholder photo factory — { id, name, grad } renders as a gradient tile and
// downloads as a real generated image. Real uploads replace these with data URLs.
const P = (id, name, c1, c2) => ({ id, name, grad: [c1, c2] });

export const EVENT_IMG_PALETTE = [
  'linear-gradient(135deg,#C75C84,#A6364E)',
  'linear-gradient(135deg,#F0D8DD,#C75C84)',
  'linear-gradient(135deg,#9FC9B9,#2D6A4F)',
  'linear-gradient(135deg,#F3D9A4,#C76A0D)',
  'linear-gradient(135deg,#d8c0a8,#8B6F4E)',
  'linear-gradient(135deg,#8C3A4E,#5C1F2E)',
];

export const INITIAL_EVENTS = [
  { id:'e1', name:'Tamu Weekend Bazaar', dateRange:'12 – 14 Jul 2026', location:'Gaya Street, KK', days:3, applied:48, fnb:300, nonfnb:250, startTime:'08:00', endTime:'16:00', lastApp:'2026-07-05', startDate:'2026-07-12', endDate:'2026-07-14', img:"url('/assets/event-tamu.png') center/cover no-repeat" },
  { id:'e2', name:'Borneo Makers Fair',  dateRange:'26 – 27 Jul 2026', location:'Likas Square',   days:2, applied:32, fnb:280, nonfnb:230, startTime:'10:00', endTime:'18:00', lastApp:'2026-06-21', startDate:'2026-07-26', endDate:'2026-07-27', img:"url('/assets/event-makers.png') center/cover no-repeat" },
  { id:'e3', name:'Harvest Night Market', dateRange:'2 – 4 Aug 2026', location:'Gaya Street, KK', days:3, applied:60, fnb:320, nonfnb:270, startTime:'17:00', endTime:'23:00', lastApp:'2026-07-26', startDate:'2026-08-02', endDate:'2026-08-04', img:"url('/assets/event-harvest.png') center/cover no-repeat" },
];

export const INITIAL_VENDORS = [
  { id:'v1', business:'Nutmeg & Clay',   owner:'Aisyah Rahman', category:'Handcraft / Art',          email:'aisyah@nutmegclay.my',  phone:'013-8842210', ig:'@nutmegclay',     fb:'Nutmeg & Clay',   tiktok:'@nutmegclay',  plate:'SAB 1842 K', regDate:'14 Jun', status:'approved', power:'1× kiln display light (240V), 1× LED string', productPhotos:[P('v1p1','stoneware-mugs.jpg','#E8C5B8','#A56548'),P('v1p2','botanical-planters.jpg','#D9C6A5','#8B6F4E'),P('v1p3','tableware-set.jpg','#C9A99B','#7A4A38')], desc:'Hand-thrown stoneware ceramics and small-batch botanical homewares, made in Kota Kinabalu. Mugs, planters, tableware and gift sets.' },
  { id:'v2', business:'Borneo Brews',    owner:'Daniel Lim',    category:'Food & Beverage',          email:'hello@borneobrews.co',   phone:'016-7720145', ig:'@borneobrews',    fb:'Borneo Brews Co', tiktok:'@borneobrews', plate:'SA 9021 P',  regDate:'15 Jun', status:'approved', power:'1× espresso machine (240V, 13A), 1× grinder, 1× chest freezer', productPhotos:[P('v2p1','cold-brew-bottles.jpg','#D7B899','#6F4E37'),P('v2p2','pour-over-set.jpg','#C9AE8B','#4A3728'),P('v2p3','coffee-beans.jpg','#B58B5E','#3E2A1A'),P('v2p4','iced-latte.jpg','#E3CDB0','#8B5E3C')], desc:'Specialty cold brew, single-origin pour-overs and Sabah-grown coffee beans. Cups, bottles and retail bags.' },
  { id:'v3', business:'Rattan Republic', owner:'Nadia Yusof',   category:'Fashion',                  email:'nadia@rattanrepublic.my',phone:'011-23398871', ig:'@rattan.republic',fb:'Rattan Republic', tiktok:'@rattanrepublic',plate:'SAB 553 T', regDate:'16 Jun', status:'approved', power:'None', productPhotos:[P('v3p1','rattan-tote.jpg','#E2CBA8','#9C7A52'),P('v3p2','woven-hat.jpg','#D9BE93','#8A6B42'),P('v3p3','clutch-bags.jpg','#CBB088','#7A5C38'),P('v3p4','market-basket.jpg','#E6D2B0','#A5824F'),P('v3p5','earrings-set.jpg','#D4B98F','#8F7046')], desc:'Handwoven rattan bags, hats and accessories using traditional Sabahan weaving techniques.' },
  { id:'v4', business:'Pulau Soap Co.',  owner:'Grace Wong',    category:'Beauty & Wellness',        email:'grace@pulausoap.my',     phone:'014-6650092', ig:'@pulausoap',      fb:'Pulau Soap Co',   tiktok:'@pulausoap',   plate:'SS 1180 A',  regDate:'17 Jun', status:'approved', power:'1× display fridge (240V)', productPhotos:[P('v4p1','botanical-soaps.jpg','#F0D8DD','#C75C84'),P('v4p2','body-scrubs.jpg','#DCE8DD','#7FA88B')], desc:'Cold-process artisan soaps, body scrubs and balms made with island botanicals. Plastic-free packaging.' },
  { id:'v5', business:'Kinabalu Kopi',   owner:'Faiz Anuar',    category:'Food & Beverage',          email:'faiz@kkkopi.my',         phone:'012-3041188', ig:'@kinabalukopi',   fb:'Kinabalu Kopi',   tiktok:'@kkkopi',      plate:'SAB 700 G',  regDate:'18 Jun', status:'approved', power:'1× coffee machine (240V, 13A), 1× water boiler', productPhotos:[P('v5p1','kopi-o-classic.jpg','#C8A176','#5C3A21'),P('v5p2','kaya-toast.jpg','#E8CFA3','#B07E3F'),P('v5p3','retail-packs.jpg','#B98F63','#4A2E18')], desc:'Traditional Sabah kopi, kaya toast and local kuih. Hot and iced drinks plus retail coffee packs.' },
  { id:'v6', business:'Kadazan Silver',  owner:'Melissa Anak Robert', category:'Jewellery',          email:'melissa@kadazansilver.my', phone:'019-8801234', ig:'@kadazansilver',  fb:'Kadazan Silver',  tiktok:'@kadazansilver', plate:'SAB 2201 R', regDate:'9 Jul',  status:'pending',  power:'None', productPhotos:[P('v6p1','motif-rings.jpg','#D8D8DC','#8A8A94'),P('v6p2','pendants.jpg','#C9C9CF','#6E6E78'),P('v6p3','pattern-cuffs.jpg','#E2E2E6','#9A9AA4')], desc:'Handcrafted silver jewellery inspired by Kadazan-Dusun motifs — rings, pendants and traditional-pattern cuffs.' },
  { id:'v7', business:'Rumah Anyaman',   owner:'Joseph Majanil', category:'Home & Lifestyle',        email:'joseph@rumahanyaman.my', phone:'017-2093345', ig:'@rumahanyaman',   fb:'Rumah Anyaman',   tiktok:'@rumahanyaman', plate:'SS 442 B',   regDate:'10 Jul', status:'pending',  power:'None', productPhotos:[P('v7p1','pandan-baskets.jpg','#D9E3C9','#7C9153'),P('v7p2','placemats.jpg','#CBD8B5','#6B8046'),P('v7p3','storage-boxes.jpg','#E1E8D2','#8CA05E'),P('v7p4','bamboo-trays.jpg','#D2DFBE','#75894C')], desc:'Woven pandan and bamboo homeware — baskets, placemats and storage pieces made by a Kudat weaving collective.' },
];

export const INITIAL_APPS = [
  { id:'a1', vendorId:'v2', eventId:'e1', status:'pending',  shared:false, partners:[] },
  { id:'a2', vendorId:'v1', eventId:'e1', status:'approved', shared:true,  partners:['v4'] },
  { id:'a3', vendorId:'v4', eventId:'e1', status:'approved', shared:true,  partners:['v1'] },
  { id:'a4', vendorId:'v3', eventId:'e2', status:'pending',  shared:false, partners:[] },
  { id:'a5', vendorId:'v5', eventId:'e2', status:'approved', shared:false, partners:[] },
  { id:'a6', vendorId:'v3', eventId:'e3', status:'pending',  shared:false, partners:[] },
  { id:'a7', vendorId:'v5', eventId:'e1', status:'approved', shared:false, partners:[] },
  { id:'a8', vendorId:'v3', eventId:'e1', status:'approved', shared:false, partners:[] },
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

export const INITIAL_DEPOSITS = {
  v1: { status:'paid',     inv:'DEP-1042', payDate:'2026-06-18', refundDate:'' },
  v3: { status:'refunded', inv:'DEP-0991', payDate:'2026-05-02', refundDate:'2026-06-10' },
  v5: { status:'paid',     inv:'DEP-1050', payDate:'2026-06-20', refundDate:'' },
};

// Offences may carry photo evidence (`photos`) that vendors can view in their portal.
export const INITIAL_OFFENSES = [
  { id:'o1', vendorId:'v2', eventId:'e1', type:'late_open', photos:[P('o1p1','booth-still-closed-9am.jpg','#C9B8A5','#6B5843')] },
  { id:'o2', vendorId:'v2', eventId:'e2', type:'late_open', photos:[] },
  { id:'o3', vendorId:'v4', eventId:'e1', type:'late_pay',  photos:[] },
  { id:'o4', vendorId:'v3', eventId:'e1', type:'no_show',   photos:[] },
  { id:'o5', vendorId:'v2', eventId:'e1', type:'cleanup',   photos:[P('o5p1','booth-cleanup-issue.jpg','#B5C4B1','#4F6B4A')] },
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
  'v1-e1': [P('v1e1a','booth-opening.jpg','#C75C84','#5C1F2E'), P('v1e1b','crowd-evening.jpg','#8C3A4E','#2A1420')],
};

// Tracks which vendors' product photos admin has already bulk-downloaded,
// keyed `${vendorId}-${eventId}` → date string.
export const INITIAL_PHOTO_DOWNLOADS = {};

export const INITIAL_PARKING = {
  'v1-e1-1':'P-A12', 'v1-e1-2':'P-A12', 'v1-e1-3':'P-A12',
};

export const INITIAL_PASSES = {
  v1: { status:'collected', issued:'2', collectDate:'2026-07-12' },
  v3: { status:'pending' },
  v5: { status:'returned', issued:'2', returned:'2', returnDate:'2026-07-14' },
};

export const INITIAL_CATS = [
  { id:'c-fnb',      name:'Food & Beverage' },
  { id:'c-craft',    name:'Handcraft / Art' },
  { id:'c-fashion',  name:'Fashion' },
  { id:'c-jewel',    name:'Jewellery' },
  { id:'c-beauty',   name:'Beauty & Wellness' },
  { id:'c-home',     name:'Home & Lifestyle' },
  { id:'c-creative', name:'Creative Services / Experience' },
  { id:'c-books',    name:'Books / Stationery' },
  { id:'c-other',    name:'Others' },
];

export const INITIAL_CONTENT = {
  title:    'Bringing artisan makers to Sulap Markets',
  subtitle: 'Apply to become a Sulap vendor, showcase your craft at curated artisan markets, and manage everything from one place.',
  purpose:  'Now accepting applications',
  terms: `1. Application & selection
Submitting this form is an application only. Sulap Artisan reviews every vendor and selects participants per market. Acceptance is confirmed by email.

2. Booth fees & payment
Confirmed vendors pay the booth fee for the event before market day. Spots are released if payment is not received by the stated deadline.

3. Products & accuracy
You agree to sell only the products described in your application. Major changes must be approved by the Sulap team beforehand.

4. Setup, conduct & teardown
Vendors keep to their assigned booth and setup/teardown times, follow venue rules, and maintain a clean, safe stall throughout the event.

5. Cancellation
Cancellations within 7 days of the event may forfeit the booth fee. No-shows may affect future applications.

6. Liability
Vendors are responsible for their own stock, equipment and insurance. Sulap Artisan is not liable for loss or damage to vendor property.`,
};

export const OFFENSE_TYPES = {
  late_open:  { label:'Late opening',                   color:'#B7770D', bg:'#FEF8EC' },
  early_close:{ label:'Early closing',                  color:'#B03A2E', bg:'#FDEEEC' },
  late_pay:   { label:'Late payment',                   color:'#7C3AED', bg:'#EDE9FE' },
  cleanup:    { label:'Poor booth cleanup',             color:'#2D6A4F', bg:'#E8F5F0' },
  no_show:    { label:'No-show / last-minute withdraw', color:'#A6364E', bg:'#F8E9EE' },
  unsanctioned:{ label:'Unsanctioned selling',          color:'#1D4ED8', bg:'#DBEAFE' },
};

export const CURRENT_VENDOR_ID = 'v1';

// ── Admin accounts ────────────────────────────────────────────────────────────
// New admins start with the default password and must set their own on first
// sign-in. perms maps tabId → 'view' | 'edit'; a missing tab means no access
// (least privilege — newly added console tabs stay off until granted).
// NOTE: passwords are plain text for the Phase 1 prototype only — Phase 2
// replaces this with Supabase Auth (hashed, server-side).
export const DEFAULT_ADMIN_PASSWORD = '00000';
export const INITIAL_ADMINS = [
  { id:'admin',   name:'Siti Aminah', role:'super', password:'sulap123', mustReset:false, perms:{} },
  { id:'staff01', name:'Ahmad Fauzi', role:'staff', password:DEFAULT_ADMIN_PASSWORD, mustReset:true, perms:{ overview:'view', payments:'edit', parking:'view', photos:'view' } },
];

export const INITIAL_ACTIVITY = [
  { who:'Admin',        what:'approved Nutmeg & Clay as a vendor.',           when:'28 Jun 10:42 AM', tint:'#F8E9EE', icon:'check',    type:'admin' },
  { who:'Borneo Brews', what:'submitted a vendor application.',                when:'28 Jun 9:15 AM',  tint:'#FEF8EC', icon:'pen',      type:'vendor' },
  { who:'Admin',        what:'created the Harvest Night Market event.',        when:'27 Jun 4:30 PM', tint:'#E8F5F0', icon:'tent',  type:'admin' },
  { who:'Rattan Republic',what:'applied for Borneo Makers Fair.',             when:'27 Jun 2:18 PM', tint:'#F8E9EE', icon:'clipboard', type:'vendor' },
  { who:'Admin',        what:'updated deposit record for Kinabalu Kopi.',      when:'28 Jun 11:00 AM', tint:'#EEF1FB', icon:'wallet',  type:'admin' },
];
