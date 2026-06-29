export const INITIAL_EVENTS = [
  { id:'e1', name:'Tamu Weekend Bazaar', dateRange:'12 – 14 Jul 2026', location:'Gaya Street, KK', days:3, applied:48, fnb:300, nonfnb:250, startTime:'08:00', endTime:'16:00', lastApp:'2026-07-05', startDate:'2026-07-12', endDate:'2026-07-14', img:"url('/assets/event-tamu.png') center/cover no-repeat" },
  { id:'e2', name:'Borneo Makers Fair',  dateRange:'26 – 27 Jul 2026', location:'Likas Square',   days:2, applied:32, fnb:280, nonfnb:230, startTime:'10:00', endTime:'18:00', lastApp:'2026-06-21', startDate:'2026-07-26', endDate:'2026-07-27', img:"url('/assets/event-makers.png') center/cover no-repeat" },
  { id:'e3', name:'Harvest Night Market', dateRange:'2 – 4 Aug 2026', location:'Gaya Street, KK', days:3, applied:60, fnb:320, nonfnb:270, startTime:'17:00', endTime:'23:00', lastApp:'2026-07-26', startDate:'2026-08-02', endDate:'2026-08-04', img:"url('/assets/event-harvest.png') center/cover no-repeat" },
];

export const INITIAL_VENDORS = [
  { id:'v1', business:'Nutmeg & Clay',   owner:'Aisyah Rahman', category:'Handcraft / Art',          email:'aisyah@nutmegclay.my',  phone:'013-8842210', ig:'@nutmegclay',     fb:'Nutmeg & Clay',   tiktok:'@nutmegclay',  plate:'SAB 1842 K', regDate:'14 Jun', status:'approved', power:'1× kiln display light (240V), 1× LED string', photos:3, desc:'Hand-thrown stoneware ceramics and small-batch botanical homewares, made in Kota Kinabalu. Mugs, planters, tableware and gift sets.' },
  { id:'v2', business:'Borneo Brews',    owner:'Daniel Lim',    category:'Food & Beverage',          email:'hello@borneobrews.co',   phone:'016-7720145', ig:'@borneobrews',    fb:'Borneo Brews Co', tiktok:'@borneobrews', plate:'SA 9021 P',  regDate:'15 Jun', status:'pending',  power:'1× espresso machine (240V, 13A), 1× grinder, 1× chest freezer', photos:4, desc:'Specialty cold brew, single-origin pour-overs and Sabah-grown coffee beans. Cups, bottles and retail bags.' },
  { id:'v3', business:'Rattan Republic', owner:'Nadia Yusof',   category:'Fashion',                  email:'nadia@rattanrepublic.my',phone:'011-23398871', ig:'@rattan.republic',fb:'Rattan Republic', tiktok:'@rattanrepublic',plate:'SAB 553 T', regDate:'16 Jun', status:'approved', power:'None', photos:5, desc:'Handwoven rattan bags, hats and accessories using traditional Sabahan weaving techniques.' },
  { id:'v4', business:'Pulau Soap Co.',  owner:'Grace Wong',    category:'Beauty & Wellness',        email:'grace@pulausoap.my',     phone:'014-6650092', ig:'@pulausoap',      fb:'Pulau Soap Co',   tiktok:'@pulausoap',   plate:'SS 1180 A',  regDate:'17 Jun', status:'pending',  power:'1× display fridge (240V)', photos:2, desc:'Cold-process artisan soaps, body scrubs and balms made with island botanicals. Plastic-free packaging.' },
  { id:'v5', business:'Kinabalu Kopi',   owner:'Faiz Anuar',    category:'Food & Beverage',          email:'faiz@kkkopi.my',         phone:'012-3041188', ig:'@kinabalukopi',   fb:'Kinabalu Kopi',   tiktok:'@kkkopi',      plate:'SAB 700 G',  regDate:'18 Jun', status:'approved', power:'1× coffee machine (240V, 13A), 1× water boiler', photos:3, desc:'Traditional Sabah kopi, kaya toast and local kuih. Hot and iced drinks plus retail coffee packs.' },
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

export const INITIAL_PAYMENTS = {
  'v2-e1': { status:'paid',    paid:556.50, advice:true,  invoice:true,  receipt:true  },
  'v1-e1': { status:'partial', paid:300,    advice:true,  invoice:true,  receipt:false },
};

export const INITIAL_DEPOSITS = {
  v1: { status:'paid',     inv:'DEP-1042', payDate:'2026-06-18', refundDate:'' },
  v3: { status:'refunded', inv:'DEP-0991', payDate:'2026-05-02', refundDate:'2026-06-10' },
  v5: { status:'paid',     inv:'DEP-1050', payDate:'2026-06-20', refundDate:'' },
};

export const INITIAL_OFFENSES = [
  { id:'o1', vendorId:'v2', eventId:'e1', type:'late_open' },
  { id:'o2', vendorId:'v2', eventId:'e2', type:'late_open' },
  { id:'o3', vendorId:'v4', eventId:'e1', type:'late_pay'  },
  { id:'o4', vendorId:'v3', eventId:'e1', type:'no_show'   },
  { id:'o5', vendorId:'v2', eventId:'e1', type:'cleanup'   },
];

export const INITIAL_EVENT_PHOTOS = {
  'v1-e1': { vendor:3, admin:1 },
  'v5-e1': { vendor:2, admin:0 },
  'v3-e1': { vendor:0, admin:0 },
};

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
