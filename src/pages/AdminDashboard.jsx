import { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import Badge from '../components/Badge';
import PhotoTile from '../components/PhotoTile';
import { useStore } from '../lib/store';
import { money, fmt, fmtShort, fmtTime, payCalc, badge, dayCount, EINVOICE_FIELDS, DETAILS_FIELDS } from '../lib/helpers';
import { OFFENSE_PALETTE, CURRENT_VENDOR_ID, EVENT_IMG_PALETTE, DEFAULT_ADMIN_PASSWORD } from '../data/mockData';
import { fileToPhoto, downloadZip, safeName, photoExt, renamedFile } from '../lib/photoFiles';
import { scanNotice } from '../lib/payScan';

// Single source of truth for console tabs — the sidebar, mobile pills, AND the
// Admin Roles permission matrix all render from this list, so adding or
// removing a tab here automatically updates role management too.
export const ADMIN_TABS = [
  { id:'overview',   label:'Overview',            icon:'bars' },
  { id:'vendors',    label:'Vendor Applications', icon:'users' },
  { id:'vendorList', label:'Vendor Listing',      icon:'file' },
  { id:'profileReq', label:'Profile Requests',    icon:'pencil' },
  { id:'events',     label:'Events',              icon:'tent' },
  { id:'apps',       label:'Event Applications',  icon:'clipboard' },
  { id:'payments',   label:'Payments',            icon:'receipt' },
  { id:'deposits',   label:'Deposit Record',      icon:'wallet' },
  { id:'parking',    label:'Parking',             icon:'car' },
  { id:'photos',     label:'Event Pictures',      icon:'camera' },
  { id:'pass',       label:'Vendor Pass',         icon:'badge' },
  { id:'categories', label:'Categories',          icon:'folder' },
  { id:'activity',   label:'Activity',            icon:'activity' },
  { id:'chart',      label:'Vendor Chart',        icon:'trophy' },
  { id:'compliance', label:'Compliance',          icon:'shield' },
  { id:'content',    label:'Content',             icon:'pen' },
  { id:'settings',   label:'Settings',            icon:'settings' },
  { id:'roles',      label:'Admin Roles',         icon:'lock', superOnly:true },
];

function Pager({ total, perPage, page, onPage }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  const start = (page-1)*perPage+1, end = Math.min(page*perPage, total);
  const btnStyle = (dis) => ({ background:dis?'var(--bg-subtle)':'var(--bg-card)', border:'1px solid var(--border-medium)', color:dis?'var(--text-muted)':'#A6364E', fontSize:12, fontWeight:600, borderRadius:9, padding:'7px 14px', cursor:dis?'not-allowed':'pointer' });
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14 }}>
      <div style={{ fontSize:12, color:'var(--text-muted)' }}>{start}–{end} of {total}</div>
      <div style={{ display:'flex', gap:8 }}>
        <button disabled={page<=1} onClick={()=>onPage(page-1)} style={btnStyle(page<=1)}>Prev</button>
        <button disabled={page>=pages} onClick={()=>onPage(page+1)} style={btnStyle(page>=pages)}>Next</button>
      </div>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder = 'Search by business or owner name' }) {
  return (
    <div style={{ position:'relative', marginBottom:14, maxWidth:360 }}>
      <div style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
        <Icon name="search" size={15} color="var(--text-muted)"/>
      </div>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{ width:'100%', border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'11px 34px 11px 36px', fontSize:14, color:'var(--text-primary)', outline:'none' }}/>
      {value && (
        <button onClick={()=>onChange('')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'var(--bg-subtle)', border:'none', width:22, height:22, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <Icon name="x" size={11} color="var(--text-secondary)"/>
        </button>
      )}
    </div>
  );
}

function NoSearchMatch({ query }) {
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:16, padding:'24px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
      No vendors match "{query}".
    </div>
  );
}

export default function AdminDashboard() {
  const { state, set, dispatch, showToast, closeModals, logActivity, acting, canViewTab, canEditTab } = useStore();
  const { aTab, events, vendors, apps, payments, refunds, deposits, offenses, offenseTypes, compOverrides, eventPhotos, photoDownloads, payDocDownloads, parking, passes, cats, content, settings, activity, filterEvent, page, PER_PAGE, compTab, compSel, chartPeriod, actTab, parkOverride, newOffType, admins, currentAdminId, appsTab, darkMode, catEditId, expandedCats, profileRequests } = state;
  const isSuperActing = !acting || acting.role === 'super';
  const visibleTabs = ADMIN_TABS.filter(t => t.superOnly ? isSuperActing : canViewTab(t.id));
  const [newAdmin, setNewAdmin] = useState({ id:'', name:'' });
  const [expandedAdmin, setExpandedAdmin] = useState(null); // admin id whose permission matrix (or transfer panel) is open
  const [transferTo, setTransferTo] = useState('');
  const [transferConfirm, setTransferConfirm] = useState('');

  // If the signed-in admin can't view the current tab, land on their first visible tab
  useEffect(() => {
    const cur = ADMIN_TABS.find(t => t.id === aTab);
    const allowed = cur && (cur.superOnly ? isSuperActing : canViewTab(aTab));
    if (!allowed && visibleTabs.length) set({ aTab: visibleTabs[0].id, page:1 });
  }, [aTab, currentAdminId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showRejected, setShowRejected] = useState(false);
  const [showDecidedReq, setShowDecidedReq] = useState(false);
  const [photoSel, setPhotoSel] = useState({});        // booth-group selection for bulk download
  const [photoFilter, setPhotoFilter] = useState('all'); // 'all' | 'new'
  const [bulkUpMsg, setBulkUpMsg] = useState(null);      // bulk upload result summary
  const [zipBusy, setZipBusy] = useState(false);
  const [paySel, setPaySel] = useState({});          // payment-card selection for bulk advice download
  const [payFilter, setPayFilter] = useState('all'); // 'all' | 'new'
  const [payUpMsg, setPayUpMsg] = useState(null);    // bulk invoice/receipt upload summary
  const [vendorSearch, setVendorSearch] = useState(''); // search box shared across vendor-listing tabs
  useEffect(() => { setVendorSearch(''); }, [aTab]);

  const vById = id => vendors.find(v=>v.id===id)||{};
  const eById = id => events.find(e=>e.id===id)||{};
  const depRec = id => deposits[id]||{status:'unpaid',inv:'',payDate:'',refundDate:''};
  const payRec = key => payments[key]||{status:'unpaid',paid:0,advice:false,invoice:false,receipt:false};
  const refundRec = key => refunds[key]||{status:'none'};

  // Vendor's participation history — most recent approved market + total count,
  // shown faintly on Event Applications so admin can see a vendor's track record at a glance.
  const vendorHistory = (vendorId) => {
    const joined = apps.filter(a => a.vendorId === vendorId && a.status === 'approved')
      .map(a => eById(a.eventId))
      .filter(e => e.id)
      .sort((a,b) => (b.startDate||'').localeCompare(a.startDate||''));
    return { latest: joined[0] || null, total: joined.length };
  };

  // ── Vendor search (used across every tab with a vendor listing) ──
  const searchQ = vendorSearch.trim().toLowerCase();
  const vendorMatches = (v) => !searchQ || (v?.business||'').toLowerCase().includes(searchQ) || (v?.owner||'').toLowerCase().includes(searchQ);
  const searchVendors = (list) => searchQ ? list.filter(vendorMatches) : list;
  const searchApps    = (list) => searchQ ? list.filter(a => vendorMatches(vById(a.vendorId))) : list;
  const searchGroups  = (list) => searchQ ? list.filter(g => g.members.some(vid => vendorMatches(vById(vid)))) : list;

  const tabStyle = (active) => ({
    display:'inline-flex', alignItems:'center', gap:7, flexShrink:0,
    border:active?'none':'1px solid #e7ddd0', fontFamily:"'DM Sans'",
    fontSize:13, fontWeight:600, borderRadius:999, padding:'9px 16px', cursor:'pointer',
    background:active?'#A6364E':'var(--bg-card)', color:active?'#FAF8F5':'var(--text-secondary)',
  });

  const logout = () => { set({ aScreen:'login', currentAdminId:null }); showToast('Signed out','leaf'); };

  // Derived filtered data for paginated tabs
  // Event Applications = pending only now; shortlisted/approved live in the Shortlist tab.
  const filteredApps = searchApps(apps.filter(a => a.eventId === filterEvent && a.status === 'pending'));
  const approvedApps = apps.filter(a => a.eventId === filterEvent && a.status === 'approved');
  const searchedApprovedApps = searchApps(approvedApps);
  const pagedApps    = filteredApps.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const filteredPayApps = searchApps(payFilter === 'new'
    ? approvedApps.filter(a => { const r = payRec(`${a.vendorId}-${a.eventId}`); return (r.advice || r.advice2) && !payDocDownloads[`${a.vendorId}-${a.eventId}`]; })
    : approvedApps);
  const pagedPayments= filteredPayApps.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const selectedPayApps = filteredPayApps.filter(a => paySel[a.id]);
  const pagedPark    = searchedApprovedApps.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const pagedPass    = searchedApprovedApps.slice((page-1)*PER_PAGE, page*PER_PAGE);

  // Booth groups for Event Pictures: main vendor + booth sharers together, de-duplicated
  // (partners who also hold their own application row are not shown twice)
  const boothGroups = (() => {
    const seen = new Set(); const groups = [];
    approvedApps.forEach(a => {
      if (seen.has(a.vendorId)) return;
      const members = [a.vendorId, ...(a.partners||[])].filter((id,i,arr) => arr.indexOf(id) === i);
      members.forEach(id => seen.add(id));
      groups.push({ id: a.id, members, shared: members.length > 1 });
    });
    return groups;
  })();
  const groupDownloaded = g => g.members.every(vid => photoDownloads[`${vid}-${filterEvent}`]);
  const filteredGroups  = searchGroups(photoFilter === 'new' ? boothGroups.filter(g => !groupDownloaded(g)) : boothGroups);
  const pagedGroups     = filteredGroups.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const selectedGroups  = filteredGroups.filter(g => photoSel[g.id]);
  const pendingVendors = vendors.filter(v => v.status === 'pending');
  const approvedVendors = vendors.filter(v => v.status === 'approved' || v.status === 'suspended');
  const rejectedVendors = vendors.filter(v => v.status === 'rejected');
  const searchedPending = searchVendors(pendingVendors);
  const searchedApprovedList = searchVendors(approvedVendors);
  const searchedRejected = searchVendors(rejectedVendors);
  const pagedVendors = searchedPending.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const pagedVendorList = searchedApprovedList.slice((page-1)*PER_PAGE, page*PER_PAGE);

  const curEv = eById(filterEvent);
  const today = new Date(); today.setHours(0,0,0,0);

  // ── Compliance hold ──
  // A vendor with offences sits out the next `settings.skipMarkets` markets
  // (by event start date) unless admin overrides for that vendor + event.
  const eventIdx = (() => {
    const sorted = [...events].sort((a,b)=>(a.startDate||'').localeCompare(b.startDate||''));
    return Object.fromEntries(sorted.map((e,i)=>[e.id,i]));
  })();
  const skipN = settings.skipMarkets ?? 1;
  const complianceHold = (vendorId, eventId) => {
    const target = eventIdx[eventId];
    if (target == null) return [];
    return offenses.filter(o => o.vendorId === vendorId
      && eventIdx[o.eventId] != null && eventIdx[o.eventId] < target
      && target - eventIdx[o.eventId] <= skipN);
  };

  // ── Event Pictures handlers ──
  const markDownloaded = (vids) => {
    const marks = {};
    vids.forEach(vid => { marks[`${vid}-${filterEvent}`] = fmtShort(new Date()); });
    dispatch({ type:'MERGE_PHOTO_DOWNLOADS', payload:marks });
  };

  const downloadVendorZip = async (v) => {
    const phs = v.productPhotos || [];
    if (!phs.length) { showToast(`${v.business} has no product photos yet`,'info'); return; }
    setZipBusy(true); showToast('Preparing ZIP…','download');
    try {
      await downloadZip(
        phs.map((ph,i)=>({ folder:v.business, filename:renamedFile(v.business,i,curEv.name,photoExt(ph)), photo:ph })),
        `${safeName(v.business)} - ${safeName(curEv.name)}.zip`
      );
      markDownloaded([v.id]);
      logActivity('Admin', `downloaded ${v.business}'s product photos for ${curEv.name}.`, {icon:'download', tint:'var(--tint-blue-bg)'});
      showToast(`${phs.length} photo(s) saved`,'check');
    } finally { setZipBusy(false); }
  };

  const bulkDownloadSel = async () => {
    if (!selectedGroups.length) { showToast('Tick at least one booth first','info'); return; }
    const entries = []; const vids = [];
    selectedGroups.forEach(g => g.members.forEach(vid => {
      const v = vById(vid); vids.push(vid);
      (v.productPhotos||[]).forEach((ph,i)=>entries.push({ folder:v.business, filename:renamedFile(v.business,i,curEv.name,photoExt(ph)), photo:ph }));
    }));
    if (!entries.length) { showToast('Selected vendors have no photos yet','info'); return; }
    setZipBusy(true); showToast('Preparing ZIP…','download');
    try {
      await downloadZip(entries, `${safeName(curEv.name)} - vendor photos.zip`);
      markDownloaded(vids);
      setPhotoSel({});
      logActivity('Admin', `bulk downloaded product photos for ${vids.length} vendor(s) — ${curEv.name}.`, {icon:'download', tint:'var(--tint-blue-bg)'});
      showToast(`ZIP saved · ${entries.length} photos from ${vids.length} vendors`,'check');
    } finally { setZipBusy(false); }
  };

  const handleBulkUpload = async (e) => {
    const files = [...e.target.files].filter(f => f.type.startsWith('image/'));
    e.target.value = '';
    if (!files.length) { showToast('No images found in that folder','info'); return; }
    const nameMap = {};
    boothGroups.forEach(g => g.members.forEach(vid => { const v = vById(vid); nameMap[(v.business||'').toLowerCase().trim()] = vid; }));
    const adds = {}; const unmatched = new Set(); const matchedVendors = new Set(); let count = 0;
    for (const f of files) {
      const parts = (f.webkitRelativePath || f.name).split('/');
      const folder = parts.length >= 2 ? parts[parts.length-2] : '';
      const vid = nameMap[folder.toLowerCase().trim()];
      if (!vid) { unmatched.add(folder || f.name); continue; }
      const ph = await fileToPhoto(f);
      const key = `${vid}-${filterEvent}`;
      adds[key] = [...(adds[key] || eventPhotos[key] || []), ph];
      matchedVendors.add(vid); count++;
    }
    if (count) {
      dispatch({ type:'MERGE_PHOTOS', payload:adds });
      logActivity('Admin', `bulk uploaded ${count} event photo(s) to ${matchedVendors.size} vendor(s) — ${curEv.name}.`, {icon:'upload', tint:'var(--tint-green-bg)'});
    }
    setBulkUpMsg({ count, vendors:matchedVendors.size, unmatched:[...unmatched] });
    showToast(count ? `${count} photo(s) uploaded to ${matchedVendors.size} vendor(s)` : 'No folders matched vendor names', count ? 'check' : 'info');
  };

  // ── Payments handlers ──
  const bulkDownloadAdvices = async () => {
    if (!selectedPayApps.length) { showToast('Tick at least one vendor first','info'); return; }
    const entries = []; const marks = {};
    selectedPayApps.forEach(a => {
      const v = vById(a.vendorId);
      const rec = payRec(`${a.vendorId}-${a.eventId}`);
      if (rec.advice)  entries.push({ folder:v.business, filename:`${safeName(v.business)} - Payment Advice - ${safeName(curEv.name)}.${photoExt(rec.advice)}`, photo:rec.advice });
      if (rec.advice2) entries.push({ folder:v.business, filename:`${safeName(v.business)} - Payment Advice 2 - ${safeName(curEv.name)}.${photoExt(rec.advice2)}`, photo:rec.advice2 });
      if (rec.advice || rec.advice2) marks[`${a.vendorId}-${a.eventId}`] = fmtShort(new Date());
    });
    if (!entries.length) { showToast('Selected vendors have no payment advices yet','info'); return; }
    setZipBusy(true); showToast('Preparing ZIP…','download');
    try {
      await downloadZip(entries, `${safeName(curEv.name)} - payment advices.zip`);
      dispatch({ type:'MERGE_PAY_DOC_DOWNLOADS', payload:marks });
      setPaySel({});
      logActivity('Admin', `bulk downloaded ${entries.length} payment advice(s) — ${curEv.name}.`, {icon:'download', tint:'var(--tint-blue-bg)'});
      showToast(`ZIP saved · ${entries.length} advice(s) from ${Object.keys(marks).length} vendor(s)`,'check');
    } finally { setZipBusy(false); }
  };

  const bulkUploadPayDocs = (field, label) => async (e) => {
    const files = [...e.target.files].filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
    e.target.value = '';
    if (!files.length) { showToast('No images or PDFs found in that folder','info'); return; }
    const nameMap = {};
    approvedApps.forEach(a => { const v = vById(a.vendorId); nameMap[(v.business||'').toLowerCase().trim()] = a.vendorId; });
    const payload = {}; const unmatched = new Set(); const matched = new Set();
    for (const f of files) {
      const parts = (f.webkitRelativePath || f.name).split('/');
      const folder = parts.length >= 2 ? parts[parts.length-2] : '';
      const vid = nameMap[folder.toLowerCase().trim()];
      if (!vid) { unmatched.add(folder || f.name); continue; }
      if (matched.has(vid)) continue; // one document per vendor — first file wins
      const doc = await fileToPhoto(f);
      const key = `${vid}-${filterEvent}`;
      payload[key] = { ...payRec(key), [field]: doc };
      matched.add(vid);
    }
    if (matched.size) {
      dispatch({ type:'MERGE_PAYMENTS', payload });
      logActivity('Admin', `bulk uploaded ${label.toLowerCase()}s for ${matched.size} vendor(s) — ${curEv.name}.`, {icon:'file', tint:'var(--tint-green-bg)'});
    }
    setPayUpMsg({ label, count:matched.size, unmatched:[...unmatched] });
    showToast(matched.size ? `${label}s attached to ${matched.size} vendor(s)` : 'No folders matched vendor names', matched.size ? 'check' : 'info');
  };

  return (
    <div>
      {/* Header */}
      <div style={{ background:'#3A1622', padding:'15px 20px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:600, color:'#FAF8F5' }}>Admin Console</div>
          <div style={{ fontSize:11, color:'#C99AAA', marginTop:1 }}>Sulap Artisan{acting ? ` · ${acting.name}${isSuperActing ? ' (Super admin)' : ''}` : ''}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={()=>set({darkMode:!darkMode})} title={darkMode ? 'Switch to day mode' : 'Switch to night mode'} style={{ background:'#54222f', border:'none', width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <Icon name={darkMode ? 'sun' : 'moon'} size={16} color="#f0d9e0"/>
          </button>
          <button onClick={logout} style={{ background:'#54222f', border:'none', color:'#f0d9e0', fontSize:12, fontWeight:600, borderRadius:10, padding:'8px 12px', cursor:'pointer' }}>Sign out</button>
        </div>
      </div>

      {/* Mobile pill tabs */}
      <div className="admin-tabs-bar" style={{ display:'flex', flexWrap:'wrap', gap:7, padding:'13px 16px', background:'var(--bg-card)', borderBottom:'1px solid var(--border-faint)' }}>
        {visibleTabs.map(t => (
          <button key={t.id} onClick={()=>{ closeModals(); set({aTab:t.id,page:1}); }} style={tabStyle(aTab===t.id)}>{t.label}</button>
        ))}
      </div>

      {/* View-only notice for restricted admins */}
      {acting && !isSuperActing && canViewTab(aTab) && !canEditTab(aTab) && (
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--tint-amber-bg-soft)', borderBottom:'1px solid var(--tint-amber-border-soft)', padding:'9px 18px', fontSize:12, color:'var(--tint-amber-text-soft)', fontWeight:500 }}>
          <Icon name="eye" size={14} color="var(--tint-amber-text-soft)"/>View-only access — you can browse this tab but changes are disabled.
        </div>
      )}

      {/* ── Overview ── */}
      {aTab === 'overview' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div className="overview-grid">
            {[
              { icon:'users',   tint:'var(--tint-pink-bg)', iconColor:'#A6364E', value:vendors.length,                        label:'Total vendors',     sub:'registered' },
              { icon:'clock',   tint:'var(--tint-amber-bg)', iconColor:'var(--tint-amber-text)', value:vendors.filter(v=>v.status==='pending').length, label:'Pending review', sub:'awaiting approval' },
              { icon:'tent',    tint:'var(--tint-green-bg)', iconColor:'var(--tint-green-text)', value:events.length,                         label:'Active events',     sub:'this season' },
              { icon:'receipt', tint:'var(--tint-blue-bg)', iconColor:'var(--tint-blue-text)', value:Object.values(payments).filter(p=>p.status==='paid').length, label:'Payments confirmed', sub:'this event' },
            ].map(c => (
              <div key={c.label} style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:16, padding:'13px 14px' }}>
                <div style={{ width:34, height:34, borderRadius:10, background:c.tint, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon name={c.icon} size={17} color={c.iconColor}/>
                </div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:600, color:'var(--text-primary)', marginTop:10, lineHeight:1 }}>{c.value}</div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', marginTop:5 }}>{c.label}</div>
                <div style={{ fontSize:10.5, color:'var(--text-muted)', marginTop:2 }}>{c.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', margin:'20px 2px 10px' }}>Quick actions</div>
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {[
              { icon:'users',   label:'Review vendor applications', tab:'vendors' },
              { icon:'tent',    label:'Create a new event',         tab:'events'  },
              { icon:'receipt', label:'Manage payments',            tab:'payments'},
              { icon:'shield',  label:'Log vendor offences',        tab:'compliance'},
            ].map(a => (
              <button key={a.label} onClick={()=>set({aTab:a.tab,page:1})} style={{ display:'flex', alignItems:'center', gap:12, background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:14, padding:'13px 14px', cursor:'pointer', textAlign:'left', fontFamily:"'DM Sans'" }}>
                <div style={{ width:34, height:34, borderRadius:10, background:'var(--tint-pink-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Icon name={a.icon} size={17} color="#A6364E"/>
                </div>
                <span style={{ flex:1, fontSize:13.5, fontWeight:600, color:'var(--text-primary)' }}>{a.label}</span>
                <span style={{ fontSize:17, color:'var(--text-muted)' }}>›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Vendor Applications (new sign-ups awaiting a decision) ── */}
      {aTab === 'vendors' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:13, color:'var(--text-secondary)' }}><b style={{ color:'#A6364E' }}>{pendingVendors.length}</b> awaiting review</div>
            <button onClick={()=>showToast('Exporting vendors.csv…','download')} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'#A6364E', fontSize:12, fontWeight:600, borderRadius:9, padding:'7px 12px', cursor:'pointer' }}>
              <Icon name="download" size={14} color="#A6364E"/>Export CSV
            </button>
          </div>
          <SearchBox value={vendorSearch} onChange={setVendorSearch}/>
          {pendingVendors.length === 0 && (
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:16, padding:'24px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
              No new applications right now.
            </div>
          )}
          {pendingVendors.length > 0 && searchedPending.length === 0 && <NoSearchMatch query={vendorSearch}/>}
          <div className="admin-cards">
            {pagedVendors.map((v,idx) => (
              <div key={v.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:16, padding:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}><span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginRight:7 }}>#{(page-1)*PER_PAGE+idx+1}</span>{v.business}</div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>{v.owner} · {v.category}</div>
                  </div>
                  <Badge status={v.status}/>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'8px 14px', marginTop:11, fontSize:11.5, color:'var(--text-secondary)' }}>
                  <span style={{ display:'flex', alignItems:'center', gap:5 }}><Icon name="mail" size={13} color="var(--text-muted)"/>{v.email}</span>
                  <span style={{ display:'flex', alignItems:'center', gap:5 }}><Icon name="phone" size={13} color="var(--text-muted)"/>{v.phone}</span>
                  <span style={{ display:'flex', alignItems:'center', gap:5, color:'#A6364E' }}><Icon name="instagram" size={13} color="#A6364E"/>{v.ig}</span>
                </div>
                <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:6 }}>Registered {v.regDate}</div>
                <div style={{ display:'flex', gap:9, marginTop:13, alignItems:'center' }}>
                  <button onClick={()=>set({vendorDetailId:v.id, vendorDetailReturnAppId:null})} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'#A6364E', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'9px 14px', cursor:'pointer' }}>
                    <Icon name="eye" size={14} color="#A6364E"/>View details
                  </button>
                  <div style={{ flex:1 }}/>
                  <button onClick={()=>{ dispatch({type:'MERGE_VENDORS',payload:vendors.map(x=>x.id===v.id?{...x,status:'approved'}:x)}); logActivity('Admin', `approved ${v.business} as a vendor.`, {icon:'check', tint:'var(--tint-pink-bg)'}); showToast('Vendor approved'+(settings.emailAlerts?' · vendor emailed':''),'check'); }} style={{ background:'var(--tint-green-bg)', border:'none', color:'var(--tint-green-text)', fontSize:12, fontWeight:600, borderRadius:9, padding:'8px 14px', cursor:'pointer' }}>Approve</button>
                  <button onClick={()=>{ dispatch({type:'MERGE_VENDORS',payload:vendors.map(x=>x.id===v.id?{...x,status:'rejected'}:x)}); logActivity('Admin', `rejected ${v.business}'s vendor application.`, {icon:'x', tint:'var(--tint-red-bg)'}); showToast('Vendor rejected'+(settings.emailAlerts?' · vendor emailed':''),'x'); }} style={{ background:'var(--tint-red-bg)', border:'none', color:'var(--tint-red-text)', fontSize:12, fontWeight:600, borderRadius:9, padding:'8px 14px', cursor:'pointer' }}>Reject</button>
                </div>
              </div>
            ))}
          </div>
          <Pager total={searchedPending.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}/>
          {searchedRejected.length > 0 && (
            <div style={{ marginTop:22, paddingTop:16, borderTop:'1px solid var(--border-light)' }}>
              <button onClick={()=>setShowRejected(s=>!s)} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:12, fontWeight:600, padding:0, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                <Icon name={showRejected?'x':'eye'} size={13} color="var(--text-muted)"/>
                {showRejected ? 'Hide' : 'Show'} {searchedRejected.length} rejected application{searchedRejected.length>1?'s':''}
              </button>
              {showRejected && (
                <div className="admin-cards" style={{ marginTop:13 }}>
                  {searchedRejected.map(v => (
                    <div key={v.id} style={{ background:'var(--bg-subtle-alt)', border:'1px solid var(--border-light)', borderRadius:16, padding:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>{v.business}</div>
                          <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>{v.owner} · {v.category}</div>
                        </div>
                        <Badge status={v.status}/>
                      </div>
                      <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:6 }}>Registered {v.regDate}</div>
                      <button onClick={()=>{ dispatch({type:'MERGE_VENDORS',payload:vendors.map(x=>x.id===v.id?{...x,status:'pending'}:x)}); logActivity('Admin', `moved ${v.business}'s application back to pending review.`, {icon:'info', tint:'var(--tint-amber-bg)'}); showToast(`${v.business} moved back to pending review`,'info'); }} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:11, width:'100%', background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'#A6364E', fontSize:12.5, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>
                        <Icon name="pencil" size={13} color="#A6364E"/>Reconsider — move back to pending
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Vendor Listing (master list of approved/suspended vendors) ── */}
      {aTab === 'vendorList' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:13, color:'var(--text-secondary)' }}><b style={{ color:'var(--tint-green-text)' }}>{approvedVendors.filter(v=>v.status==='approved').length}</b> approved vendors</div>
            <button onClick={()=>showToast('Exporting vendors.csv…','download')} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'#A6364E', fontSize:12, fontWeight:600, borderRadius:9, padding:'7px 12px', cursor:'pointer' }}>
              <Icon name="download" size={14} color="#A6364E"/>Export CSV
            </button>
          </div>
          <SearchBox value={vendorSearch} onChange={setVendorSearch}/>
          {approvedVendors.length > 0 && searchedApprovedList.length === 0 && <NoSearchMatch query={vendorSearch}/>}
          <div className="admin-cards">
            {pagedVendorList.map((v,idx) => {
              const vOff = offenses.filter(o=>o.vendorId===v.id);
              const typeCounts = {};
              vOff.forEach(o=>{ typeCounts[o.type]=(typeCounts[o.type]||0)+1; });
              return (
                <div key={v.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:16, padding:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}><span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginRight:7 }}>#{(page-1)*PER_PAGE+idx+1}</span>{v.business}</div>
                      <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>{v.owner} · {v.category}</div>
                    </div>
                    <Badge status={v.status}/>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'8px 14px', marginTop:11, fontSize:11.5, color:'var(--text-secondary)' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:5 }}><Icon name="mail" size={13} color="var(--text-muted)"/>{v.email}</span>
                    <span style={{ display:'flex', alignItems:'center', gap:5 }}><Icon name="phone" size={13} color="var(--text-muted)"/>{v.phone}</span>
                    <span style={{ display:'flex', alignItems:'center', gap:5, color:'#A6364E' }}><Icon name="instagram" size={13} color="#A6364E"/>{v.ig}</span>
                  </div>
                  <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:6 }}>Registered {v.regDate}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-primary)', marginTop:12, marginBottom:6 }}>Compliance</div>
                  {vOff.length === 0 ? (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, borderRadius:999, padding:'4px 10px', background:'var(--tint-green-bg)', color:'var(--tint-green-text)' }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--tint-green-text)' }}/>No offences on record
                    </span>
                  ) : (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {Object.entries(typeCounts).map(([type,count]) => {
                        const ot = offenseTypes[type]||{};
                        return <span key={type} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, borderRadius:999, padding:'4px 10px', background:ot.bg, color:ot.color }}><span style={{ width:6, height:6, borderRadius:'50%', background:ot.color }}/>{ot.label} ×{count}</span>;
                      })}
                    </div>
                  )}
                  <div style={{ display:'flex', gap:9, marginTop:13, alignItems:'center' }}>
                    <button onClick={()=>set({vendorDetailId:v.id, vendorDetailReturnAppId:null})} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'#A6364E', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'9px 14px', cursor:'pointer' }}>
                      <Icon name="eye" size={14} color="#A6364E"/>View details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <Pager total={searchedApprovedList.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}/>
        </div>
      )}

      {/* ── Profile Requests (vendor-submitted changes to locked profile fields) ── */}
      {aTab === 'profileReq' && (() => {
        const pending = profileRequests.filter(r=>r.status==='pending');
        const decided = profileRequests.filter(r=>r.status!=='pending').sort((a,b)=>b.id.localeCompare(a.id));
        const decide = (req, decision) => {
          const v = vendors.find(x=>x.id===req.vendorId);
          if (decision === 'approved') {
            const patch = req.section === 'einvoice' ? { einvoice: req.changes } : req.changes;
            dispatch({ type:'MERGE_VENDORS', payload: vendors.map(x=>x.id===req.vendorId?{...x,...patch}:x) });
          }
          dispatch({ type:'MERGE_PROFILE_REQUESTS', payload: profileRequests.map(r=>r.id===req.id?{...r,status:decision}:r) });
          logActivity('Admin', `${decision==='approved'?'approved':'rejected'} ${v?.business||'a vendor'}'s ${req.section==='einvoice'?'E-Invoice':'profile'} change request.`, {icon: decision==='approved'?'check':'x', tint: decision==='approved'?'var(--tint-pink-bg)':'var(--tint-red-bg)'});
          showToast(`Request ${decision}`, decision==='approved'?'check':'x');
        };
        return (
          <div style={{ padding:'14px 16px 20px' }}>
            <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:12 }}><b style={{ color:'#A6364E' }}>{pending.length}</b> pending change request{pending.length!==1?'s':''}</div>
            {pending.length === 0 && (
              <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:16, padding:'24px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
                No pending profile change requests.
              </div>
            )}
            <div className="admin-cards">
              {pending.map(req => {
                const v = vendors.find(x=>x.id===req.vendorId)||{};
                const fields = req.section==='einvoice' ? EINVOICE_FIELDS : DETAILS_FIELDS;
                return (
                  <div key={req.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:16, padding:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div>
                        <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>{v.business}</div>
                        <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>{req.section==='einvoice' ? 'E-Invoice & bank details' : 'Profile details'} · submitted {req.submittedAt}</div>
                      </div>
                    </div>
                    <div style={{ marginTop:11, display:'flex', flexDirection:'column', gap:6 }}>
                      {fields.map(([k,label]) => {
                        const newVal = req.changes[k];
                        const oldVal = req.section==='einvoice' ? (v.einvoice&&v.einvoice[k]) : v[k];
                        if ((oldVal||'') === (newVal||'')) return null;
                        return (
                          <div key={k} style={{ fontSize:12, color:'var(--text-secondary)' }}>
                            <span style={{ fontWeight:600, color:'var(--text-primary)' }}>{label}:</span>{' '}
                            <span style={{ color:'var(--text-muted)', textDecoration:'line-through' }}>{oldVal||'—'}</span>{' → '}
                            <span style={{ color:'var(--text-primary)', fontWeight:600 }}>{newVal||'—'}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display:'flex', gap:9, marginTop:13 }}>
                      <button onClick={()=>decide(req,'approved')} style={{ flex:1, background:'var(--tint-green-bg)', border:'none', color:'var(--tint-green-text)', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'9px 14px', cursor:'pointer' }}>Approve</button>
                      <button onClick={()=>decide(req,'rejected')} style={{ flex:1, background:'var(--tint-red-bg)', border:'none', color:'var(--tint-red-text)', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'9px 14px', cursor:'pointer' }}>Reject</button>
                      <button onClick={()=>set({vendorDetailId:v.id, vendorDetailReturnAppId:null})} style={{ background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'#A6364E', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'9px 12px', cursor:'pointer' }}>View vendor</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {decided.length > 0 && (
              <div style={{ marginTop:22, paddingTop:16, borderTop:'1px solid var(--border-light)' }}>
                <button onClick={()=>setShowDecidedReq(s=>!s)} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:12, fontWeight:600, padding:0, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                  <Icon name={showDecidedReq?'x':'eye'} size={13} color="var(--text-muted)"/>
                  {showDecidedReq ? 'Hide' : 'Show'} {decided.length} decided request{decided.length!==1?'s':''}
                </button>
                {showDecidedReq && (
                  <div className="admin-cards" style={{ marginTop:13 }}>
                    {decided.map(req => {
                      const v = vendors.find(x=>x.id===req.vendorId)||{};
                      return (
                        <div key={req.id} style={{ background:'var(--bg-subtle-alt)', border:'1px solid var(--border-light)', borderRadius:16, padding:14 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{v.business}</div>
                          <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>{req.section==='einvoice' ? 'E-Invoice & bank details' : 'Profile details'} · submitted {req.submittedAt}</div>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, borderRadius:999, padding:'4px 10px', marginTop:9, background: req.status==='approved'?'var(--tint-green-bg)':'var(--tint-red-bg)', color: req.status==='approved'?'var(--tint-green-text)':'var(--tint-red-text)' }}>
                            {req.status==='approved' ? 'Approved' : 'Rejected'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Events ── */}
      {aTab === 'events' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:18, padding:16 }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:600, color:'var(--text-primary)' }}>Create event</div>
            <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:13 }}>
              <div><div style={lbl}>Event name</div><input value={state.ef.name} onChange={e=>set({ef:{...state.ef,name:e.target.value}})} placeholder="e.g. Harvest Night Market" style={inp}/></div>
              <div>
                <div style={lbl}>Event image</div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:76, height:46, borderRadius:9, background:state.ef.img||EVENT_IMG_PALETTE[0], flexShrink:0 }}/>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {EVENT_IMG_PALETTE.map((g,i) => (
                      <button key={i} onClick={()=>set({ef:{...state.ef,img:g}})} style={{ width:28, height:28, borderRadius:8, background:g, border:(state.ef.img||EVENT_IMG_PALETTE[0])===g?'2px solid var(--text-primary)':'2px solid transparent', padding:0, cursor:'pointer' }}/>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:7, lineHeight:1.4 }}>Pick a thumbnail color — shown wherever this event is listed. Real photo upload isn't available yet (needs cloud storage).</div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <div style={{ flex:1 }}><div style={lbl}>Daily start time</div><input type="time" value={state.ef.startTime} onChange={e=>set({ef:{...state.ef,startTime:e.target.value}})} style={inp}/></div>
                <div style={{ flex:1 }}><div style={lbl}>Daily end time</div><input type="time" value={state.ef.endTime} onChange={e=>set({ef:{...state.ef,endTime:e.target.value}})} style={inp}/></div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <div style={{ flex:1 }}><div style={lbl}>Start date</div><input type="date" value={state.ef.start} onChange={e=>set({ef:{...state.ef,start:e.target.value}})} style={inp}/></div>
                <div style={{ flex:1 }}><div style={lbl}>End date</div><input type="date" value={state.ef.end} onChange={e=>set({ef:{...state.ef,end:e.target.value}})} style={inp}/></div>
              </div>
              {state.ef.start && state.ef.end && <div style={{ display:'flex', alignItems:'center', gap:7, background:'var(--tint-pink-bg)', borderRadius:10, padding:'9px 12px', fontSize:12.5, color:'#A6364E', fontWeight:600 }}><Icon name="calendar" size={15} color="#A6364E"/>Duration: {dayCount(state.ef.start,state.ef.end)} day(s)</div>}
              <div><div style={lbl}>Last date to apply</div><input type="date" value={state.ef.lastApp} onChange={e=>set({ef:{...state.ef,lastApp:e.target.value}})} style={inp}/><div style={{ fontSize:11, color:'var(--text-muted)', marginTop:5 }}>Applications close automatically after this date.</div></div>
              <div style={{ display:'flex', gap:10 }}>
                <div style={{ flex:1 }}><div style={lbl}>F&B / day (RM) + 6% SST</div><input inputMode="numeric" value={state.ef.fnb} onChange={e=>set({ef:{...state.ef,fnb:e.target.value}})} placeholder="300" style={inp}/></div>
                <div style={{ flex:1 }}><div style={lbl}>Non-F&B / day (RM) + 6% SST</div><input inputMode="numeric" value={state.ef.nonfnb} onChange={e=>set({ef:{...state.ef,nonfnb:e.target.value}})} placeholder="250" style={inp}/></div>
              </div>
              {(state.ef.fnb || state.ef.nonfnb) && (() => {
                const d = dayCount(state.ef.start,state.ef.end)||1;
                const fnbTotal = Number(state.ef.fnb||0)*d*1.06;
                const nfTotal  = Number(state.ef.nonfnb||0)*d*1.06;
                return (
                  <div style={{ display:'flex', gap:9 }}>
                    <div style={{ flex:1, background:'var(--tint-green-bg)', borderRadius:10, padding:'10px 12px' }}><div style={{ fontSize:10.5, color:'var(--tint-green-text)', fontWeight:600 }}>F&B rental total</div><div style={{ fontSize:15, fontWeight:700, color:'var(--tint-green-text)', marginTop:2 }}>RM {money(fnbTotal)}</div><div style={{ fontSize:9.5, color:'#6f9d8a', marginTop:1 }}>inclusive of 6% SST</div></div>
                    <div style={{ flex:1, background:'var(--tint-pink-bg)', borderRadius:10, padding:'10px 12px' }}><div style={{ fontSize:10.5, color:'#A6364E', fontWeight:600 }}>Non-F&B rental total</div><div style={{ fontSize:15, fontWeight:700, color:'#A6364E', marginTop:2 }}>RM {money(nfTotal)}</div><div style={{ fontSize:9.5, color:'#bd7e95', marginTop:1 }}>inclusive of 6% SST</div></div>
                  </div>
                );
              })()}
              <button onClick={() => {
                if (!state.ef.name) { showToast('Add an event name first','info'); return; }
                const d = dayCount(state.ef.start,state.ef.end)||1;
                const ev = { id:'e'+Date.now(), name:state.ef.name, dateRange:state.ef.start&&state.ef.end ? `${fmtShort(state.ef.start)} – ${fmtShort(state.ef.end)} ${new Date(state.ef.end).getFullYear()}` : 'Dates TBC', location:'Suria Sabah Mall', days:d, applied:0, fnb:Number(state.ef.fnb)||0, nonfnb:Number(state.ef.nonfnb)||0, startTime:state.ef.startTime||'10:00', endTime:state.ef.endTime||'22:00', lastApp:state.ef.lastApp||'', startDate:state.ef.start||'', endDate:state.ef.end||'', img:state.ef.img||EVENT_IMG_PALETTE[0] };
                dispatch({type:'MERGE_EVENTS',payload:[ev,...events]});
                set({ef:{name:'',start:'',end:'',startTime:'',endTime:'',lastApp:'',fnb:'',nonfnb:'',img:EVENT_IMG_PALETTE[0]}});
                logActivity('Admin', `created the ${ev.name} event.`, {icon:'tent', tint:'var(--tint-green-bg)'});
                showToast('Event created','tent');
              }} className="cta" style={{ background:'#A6364E', color:'#FAF8F5', border:'none', fontSize:14.5, fontWeight:600, borderRadius:12, padding:14, cursor:'pointer', marginTop:2 }}>Create event</button>
            </div>
          </div>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', margin:'18px 2px 10px' }}>Existing events</div>
          <div className="admin-cards">
            {events.map(ev => (
              <div key={ev.id} onClick={()=>set({eventDetailId:ev.id,eef:{name:ev.name,location:ev.location||'',start:ev.startDate||'',end:ev.endDate||'',startTime:ev.startTime||'',endTime:ev.endTime||'',lastApp:ev.lastApp||'',fnb:ev.fnb||'',nonfnb:ev.nonfnb||'',img:ev.img||EVENT_IMG_PALETTE[0]}})} style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:14, padding:'12px 13px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
                <div style={{ width:76, height:46, borderRadius:9, background:ev.img, flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>{ev.name}</div>
                  <div style={{ fontSize:11.5, color:'var(--text-secondary)', marginTop:3 }}>{ev.dateRange}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                    <Icon name="clock" size={12} color="var(--text-muted)"/>{ev.startTime && ev.endTime ? `${fmtTime(ev.startTime)} – ${fmtTime(ev.endTime)}` : 'Time TBC'} · {apps.filter(a=>a.eventId===ev.id).length} applied
                  </div>
                </div>
                <span style={{ fontSize:17, color:'var(--text-muted)' }}>›</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Event Applications ── */}
      {aTab === 'apps' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:12, marginBottom:14 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={lbl}>Filter by event</div>
              <select value={filterEvent} onChange={e=>set({filterEvent:e.target.value,page:1})} style={{ width:'100%', maxWidth:360, border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'12px 13px', fontSize:14, color:'var(--text-primary)', outline:'none' }}>
                {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <button onClick={()=>showToast('Exporting…','download')} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'#A6364E', fontSize:12, fontWeight:600, borderRadius:9, padding:'9px 13px', cursor:'pointer', flexShrink:0 }}>
              <Icon name="download" size={14} color="#A6364E"/>Export
            </button>
          </div>
          <div style={{ display:'flex', background:'var(--bg-subtle)', borderRadius:12, padding:4, gap:4, marginBottom:14 }}>
            {[['apps','Applications'],['shortlist',`Shortlist${apps.filter(a=>a.eventId===filterEvent&&(a.status==='shortlisted'||a.status==='approved')).length ? ` (${apps.filter(a=>a.eventId===filterEvent&&(a.status==='shortlisted'||a.status==='approved')).length})` : ''}`]].map(([id,label]) => (
              <button key={id} onClick={()=>set({appsTab:id,page:1})} style={{ flex:1, border:'none', fontSize:13, fontWeight:600, borderRadius:9, padding:'10px 4px', cursor:'pointer', background:appsTab===id?'var(--bg-card)':'transparent', color:appsTab===id?'var(--text-primary)':'var(--text-secondary)', boxShadow:appsTab===id?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>{label}</button>
            ))}
          </div>
          {appsTab === 'apps' && (
          <>
          <div style={{ fontSize:11.5, color:'var(--text-muted)', marginBottom:12, lineHeight:1.5 }}>Awaiting a decision for <b style={{ color:'var(--text-secondary)' }}>{curEv.name}</b>. Shortlist a vendor to move them for review — once approved they'll only appear in the Shortlist tab.</div>
          <SearchBox value={vendorSearch} onChange={setVendorSearch}/>
          {apps.filter(a=>a.eventId===filterEvent && a.status==='pending').length > 0 && filteredApps.length === 0 && <NoSearchMatch query={vendorSearch}/>}
          {apps.filter(a=>a.eventId===filterEvent && a.status==='pending').length === 0 && !searchQ && (
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:16, padding:'24px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
              No applications awaiting a decision for this market.
            </div>
          )}
          <div className="admin-cards">
            {pagedApps.map((a,idx) => {
              const v = vById(a.vendorId);
              const vOffenses = offenses.filter(o=>o.vendorId===a.vendorId);
              const holdOffs = complianceHold(a.vendorId, a.eventId);
              const overridden = !!compOverrides[`${a.vendorId}-${a.eventId}`];
              const onHold = holdOffs.length > 0 && !overridden;
              return (
                <div key={a.id} style={{ background:'var(--bg-card)', border:`1px solid ${onHold?'var(--tint-amber-border)':'var(--border-light)'}`, borderRadius:16, padding:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:7 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)' }}>#{(page-1)*PER_PAGE+idx+1}</span>
                        {v.business}
                      </div>
                      <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>{v.owner} · {v.category}</div>
                      {(() => { const h = vendorHistory(a.vendorId); return (
                        <div style={{ fontSize:11, color:'var(--text-faint)', marginTop:3 }}>
                          {h.total === 0 ? 'No markets joined yet' : `Last joined ${h.latest.name} (${h.latest.dateRange}) · ${h.total} market${h.total>1?'s':''} joined total`}
                        </div>
                      ); })()}
                    </div>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:7, marginTop:10 }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'var(--text-secondary)', background:'var(--bg-subtle)', borderRadius:999, padding:'4px 10px' }}>
                      <Icon name={a.shared?'users':'tent'} size={12} color="#A6364E"/>{a.shared?`Sharing · ${(a.partners||[]).length+1} vendors`:'Solo booth'}
                    </span>
                    {vOffenses.slice(0,3).map((o,i) => {
                      const ot = offenseTypes[o.type]||{};
                      return <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, borderRadius:999, padding:'4px 10px', background:ot.bg, color:ot.color }}><span style={{ width:6, height:6, borderRadius:'50%', background:ot.color, display:'inline-block' }}/>{ot.label}</span>;
                    })}
                  </div>
                  {holdOffs.length > 0 && (
                    onHold ? (
                      <div style={{ display:'flex', alignItems:'flex-start', gap:8, background:'var(--tint-amber-bg-soft)', border:'1px solid var(--tint-amber-border-soft)', borderRadius:11, padding:'10px 12px', marginTop:11, fontSize:11.5, color:'var(--tint-amber-text-soft)', lineHeight:1.5 }}>
                        <Icon name="shield" size={14} color="var(--tint-amber-text-soft)" style={{ marginTop:1, flexShrink:0 }}/>
                        <div style={{ flex:1 }}>
                          <b>Compliance hold</b> — {v.business} logged {holdOffs.length} offence{holdOffs.length>1?'s':''} at {[...new Set(holdOffs.map(o=>eById(o.eventId).name))].join(', ')}. Policy: sit out the next {skipN} market{skipN>1?'s':''} — this can still be shortlisted, but approval will need an override in the Shortlist tab.
                        </div>
                      </div>
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', gap:7, background:'var(--bg-neutral-soft)', border:'1px solid var(--border-soft)', borderRadius:11, padding:'9px 12px', marginTop:11, fontSize:11.5, color:'var(--text-faint)', lineHeight:1.45 }}>
                        <Icon name="shield" size={13} color="var(--text-faint)"/>Compliance hold overridden for this vendor.
                      </div>
                    )
                  )}
                  <div style={{ display:'flex', gap:9, marginTop:13, alignItems:'center' }}>
                    <button onClick={()=>set({appDetailId:a.id})} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'#A6364E', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'9px 14px', cursor:'pointer' }}>
                      <Icon name="eye" size={14} color="#A6364E"/>View &amp; share booth
                    </button>
                    <div style={{ flex:1 }}/>
                    <button onClick={()=>{ dispatch({type:'MERGE_APPS',payload:apps.map(x=>x.id===a.id?{...x,status:'shortlisted'}:x)}); logActivity('Admin', `shortlisted ${v.business} for ${eById(a.eventId).name}.`, {icon:'clipboard', tint:'var(--tint-amber-bg)'}); showToast('Vendor shortlisted','clipboard'); }} style={{ background:'var(--tint-amber-bg)', border:'none', color:'var(--tint-amber-text)', fontSize:12, fontWeight:600, borderRadius:9, padding:'8px 14px', cursor:'pointer' }}>Shortlist</button>
                  </div>
                </div>
              );
            })}
          </div>
          <Pager total={filteredApps.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}/>
          </>
          )}

          {appsTab === 'shortlist' && (() => {
            // Shortlist tab is the final roster for this event: shortlisted (awaiting a decision)
            // and approved (already confirmed) vendors both stay here, grouped by category.
            const rosterApps = apps.filter(a => a.eventId===filterEvent && (a.status==='shortlisted' || a.status==='approved'));
            const groups = cats
              .map(c => {
                const inCat = rosterApps.filter(a => vById(a.vendorId).category===c.name);
                return {
                  cat: c,
                  totalVendors: vendors.filter(v=>v.category===c.name).length,
                  roster: [...inCat].sort((a,b) => a.status===b.status ? 0 : a.status==='shortlisted' ? -1 : 1),
                  approvedCount: inCat.filter(a=>a.status==='approved').length,
                  shortlistedCount: inCat.filter(a=>a.status==='shortlisted').length,
                };
              })
              .filter(g => g.totalVendors > 0 || g.roster.length > 0);
            return (
              <>
                <div style={{ fontSize:11.5, color:'var(--text-muted)', marginBottom:14, lineHeight:1.5 }}>The final roster for <b style={{ color:'var(--text-secondary)' }}>{curEv.name}</b>, grouped by category. Approve or reject shortlisted vendors here — rejected vendors move back to Event Applications. Approved vendors stay here as the record for this market.</div>
                {rosterApps.length === 0 && (
                  <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:16, padding:'24px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:13, marginBottom:14 }}>
                    No vendors shortlisted or approved yet — shortlist pending applications from the Applications tab.
                  </div>
                )}
                <div className="admin-cards">
                  {groups.map(g => (
                    <div key={g.cat.id} style={{ gridColumn:'1 / -1', background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:16, padding:14 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:9, flexWrap:'wrap' }}>
                        <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{g.cat.name}</span>
                        <span style={{ fontSize:11, fontWeight:600, color: g.roster.length ? 'var(--tint-amber-text)' : 'var(--text-muted)', background: g.roster.length ? 'var(--tint-amber-bg)' : 'var(--bg-subtle)', borderRadius:999, padding:'3px 10px' }}>
                          {g.roster.length} of {g.totalVendors} vendor{g.totalVendors!==1?'s':''}
                        </span>
                        {g.roster.length > 0 && (
                          <span style={{ fontSize:11, color:'var(--text-muted)' }}>{g.approvedCount} approved · {g.shortlistedCount} shortlisted</span>
                        )}
                      </div>
                      {g.roster.length === 0 ? (
                        <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:10 }}>No vendors shortlisted or approved yet in this category.</div>
                      ) : (
                        <div className="admin-cards" style={{ marginTop:11 }}>
                          {g.roster.map((a,idx) => {
                            const v = vById(a.vendorId);
                            const holdOffs = complianceHold(a.vendorId, a.eventId);
                            const overridden = !!compOverrides[`${a.vendorId}-${a.eventId}`];
                            const onHold = a.status==='shortlisted' && holdOffs.length > 0 && !overridden;
                            return (
                              <div key={a.id} style={{ background: a.status==='approved' ? 'var(--tint-green-bg-soft)' : 'var(--bg-subtle-alt)', border:`1px solid ${onHold?'var(--tint-amber-border)':a.status==='approved'?'var(--tint-green-border)':'var(--border-light)'}`, borderRadius:14, padding:13 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                                  <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text-primary)' }}>
                                    <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginRight:7 }}>#{idx+1}</span>{v.business}
                                  </div>
                                  {a.status==='approved' && <span style={{ fontSize:11, fontWeight:600, color:'var(--tint-green-text)' }}>Approved</span>}
                                </div>
                                <div style={{ fontSize:11.5, color:'var(--text-secondary)', marginTop:2 }}>{v.owner}</div>
                                {a.shared && (
                                  <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'var(--text-secondary)', background:'var(--bg-subtle)', borderRadius:999, padding:'4px 10px', marginTop:8 }}>
                                    <Icon name="users" size={12} color="#A6364E"/>Sharing · {(a.partners||[]).length+1} vendors
                                  </span>
                                )}
                                {onHold && (
                                  <div style={{ display:'flex', alignItems:'flex-start', gap:7, background:'var(--tint-amber-bg-soft)', border:'1px solid var(--tint-amber-border-soft)', borderRadius:10, padding:'9px 11px', marginTop:9, fontSize:11, color:'var(--tint-amber-text-soft)', lineHeight:1.5 }}>
                                    <Icon name="shield" size={13} color="var(--tint-amber-text-soft)" style={{ marginTop:1, flexShrink:0 }}/>
                                    <div style={{ flex:1 }}>Compliance hold — {holdOffs.length} offence{holdOffs.length>1?'s':''} in the last {skipN} market{skipN>1?'s':''}.</div>
                                  </div>
                                )}
                                <div style={{ display:'flex', gap:8, marginTop:11 }}>
                                  <button onClick={()=>set({appDetailId:a.id})} title="View & share booth" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:34, height:34, background:'var(--bg-card)', border:'1px solid var(--border-medium)', borderRadius:9, cursor:'pointer', flexShrink:0 }}>
                                    <Icon name="eye" size={14} color="#A6364E"/>
                                  </button>
                                  {a.status==='approved' && (
                                    <button onClick={()=>{ if (!window.confirm(`Release ${v.business} from this market? They'll be moved back to Event Applications as pending.`)) return; dispatch({type:'MERGE_APPS',payload:apps.map(x=>x.id===a.id?{...x,status:'pending'}:x)}); logActivity('Admin', `released ${v.business} from the approved roster for ${eById(a.eventId).name} — moved back to Event Applications.`, {icon:'x', tint:'var(--tint-red-bg)'}); showToast('Vendor released — moved back to Event Applications','x'); }} style={{ display:'flex', alignItems:'center', background:'none', border:'none', color:'var(--tint-red-text)', fontSize:11, fontWeight:600, padding:'0 4px', cursor:'pointer', textDecoration:'underline', textUnderlineOffset:3, flexShrink:0 }}>Release vendor</button>
                                  )}
                                  <div style={{ flex:1 }}/>
                                  {a.status==='shortlisted' && (onHold ? (
                                    <button onClick={()=>{ set({compOverrides:{...compOverrides, [`${a.vendorId}-${a.eventId}`]:true}}); logActivity('Admin', `overrode the compliance hold for ${v.business} — ${eById(a.eventId).name}.`, {icon:'shield', tint:'var(--tint-amber-bg)'}); showToast('Hold overridden — you can now approve this vendor','shield'); }} style={{ background:'var(--bg-card)', border:'1px solid var(--tint-amber-border-soft)', color:'var(--tint-amber-text-soft)', fontSize:11.5, fontWeight:600, borderRadius:9, padding:'8px 12px', cursor:'pointer' }}>Override hold</button>
                                  ) : (
                                    <button onClick={()=>{ dispatch({type:'MERGE_APPS',payload:apps.map(x=>x.id===a.id?{...x,status:'approved'}:x)}); logActivity('Admin', `approved ${v.business}'s application for ${eById(a.eventId).name}.`, {icon:'check', tint:'var(--tint-pink-bg)'}); showToast('Application approved'+(settings.emailAlerts?' · vendor emailed':''),'check'); }} style={{ background:'var(--tint-green-bg)', border:'none', color:'var(--tint-green-text)', fontSize:12, fontWeight:600, borderRadius:9, padding:'8px 14px', cursor:'pointer' }}>Approve</button>
                                  ))}
                                  {a.status==='shortlisted' && (
                                    <button onClick={()=>{ dispatch({type:'MERGE_APPS',payload:apps.map(x=>x.id===a.id?{...x,status:'pending'}:x)}); logActivity('Admin', `rejected ${v.business} from the shortlist for ${eById(a.eventId).name} — moved back to Event Applications.`, {icon:'x', tint:'var(--tint-red-bg)'}); showToast('Vendor moved back to Event Applications','x'); }} style={{ background:'var(--tint-red-bg)', border:'none', color:'var(--tint-red-text)', fontSize:12, fontWeight:600, borderRadius:9, padding:'8px 14px', cursor:'pointer' }}>Reject</button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── Payments ── */}
      {aTab === 'payments' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:12, marginBottom:13 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={lbl}>Filter by event</div>
              <select value={filterEvent} onChange={e=>{ set({filterEvent:e.target.value,page:1}); setPaySel({}); setPayUpMsg(null); }} style={{ width:'100%', maxWidth:360, border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'12px 13px', fontSize:14, color:'var(--text-primary)', outline:'none' }}>
                {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <button onClick={()=>showToast(`Exporting payments for ${curEv.name}…`,'download')} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'#A6364E', fontSize:12, fontWeight:600, borderRadius:9, padding:'9px 13px', cursor:'pointer', flexShrink:0 }}>
              <Icon name="download" size={14} color="#A6364E"/>Export
            </button>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:9, marginBottom:12 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, borderRadius:10, padding:'8px 12px', background:'var(--bg-subtle-alt)', border:'1px solid var(--border-light)', color:'var(--text-secondary)' }}>
              <Icon name="calendar" size={13} color="var(--text-muted)"/>Payment due by {curEv.lastApp ? fmtShort(curEv.lastApp) : 'TBC'}
            </span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, borderRadius:10, padding:'8px 12px', background:'var(--tint-green-bg)', color:'var(--tint-green-text)' }}>
              {pagedPayments.filter(a=>payRec(`${a.vendorId}-${a.eventId}`).status==='paid').length} of {pagedPayments.length} fully paid
            </span>
          </div>
          <SearchBox value={vendorSearch} onChange={setVendorSearch}/>
          {searchQ && filteredPayApps.length === 0 && <NoSearchMatch query={vendorSearch}/>}

          {/* Bulk toolbar */}
          <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:8, marginBottom:12 }}>
            {[['all','All vendors'],['new',`New advices — not downloaded (${approvedApps.filter(a=>{ const r=payRec(`${a.vendorId}-${a.eventId}`); return (r.advice||r.advice2) && !payDocDownloads[`${a.vendorId}-${a.eventId}`]; }).length})`]].map(([id,label]) => (
              <button key={id} onClick={()=>{ setPayFilter(id); setPaySel({}); set({page:1}); }} style={{ background:payFilter===id?'#A6364E':'var(--bg-card)', border:`1px solid ${payFilter===id?'#A6364E':'var(--border-medium)'}`, color:payFilter===id?'#FAF8F5':'var(--text-secondary)', fontSize:12, fontWeight:600, borderRadius:999, padding:'8px 14px', cursor:'pointer' }}>{label}</button>
            ))}
            <div style={{ flex:1 }}/>
            <label style={{ display:'inline-flex', alignItems:'center', gap:7, fontSize:12, fontWeight:600, color:'var(--text-secondary)', cursor:'pointer', background:'var(--bg-card)', border:'1px solid var(--border-medium)', borderRadius:9, padding:'8px 12px' }}>
              <input type="checkbox" style={{ accentColor:'#A6364E', width:15, height:15, cursor:'pointer' }}
                checked={filteredPayApps.length>0 && filteredPayApps.every(a=>paySel[a.id])}
                onChange={()=>{ const all = filteredPayApps.length>0 && filteredPayApps.every(a=>paySel[a.id]); setPaySel(all ? {} : Object.fromEntries(filteredPayApps.map(a=>[a.id,true]))); }}/>
              Select all
            </label>
            <button disabled={zipBusy} onClick={bulkDownloadAdvices} style={{ display:'inline-flex', alignItems:'center', gap:6, background:selectedPayApps.length?'#A6364E':'var(--bg-subtle)', border:'none', color:selectedPayApps.length?'#FAF8F5':'var(--text-muted)', fontSize:12, fontWeight:600, borderRadius:9, padding:'9px 14px', cursor:zipBusy?'wait':'pointer' }}>
              <Icon name="download" size={14} color={selectedPayApps.length?'#FAF8F5':'var(--text-muted)'}/>Bulk download advices{selectedPayApps.length?` (${selectedPayApps.length})`:''}
            </button>
            <label title="Upload a folder with one sub-folder per business name" style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'#A6364E', fontSize:12, fontWeight:600, borderRadius:9, padding:'9px 14px', cursor:'pointer' }}>
              <input type="file" webkitdirectory="" directory="" multiple style={{ display:'none' }} onChange={bulkUploadPayDocs('invoice','Invoice')}/>
              <Icon name="upload" size={14} color="#A6364E"/>Bulk upload invoices
            </label>
            <label title="Upload a folder with one sub-folder per business name" style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'#A6364E', fontSize:12, fontWeight:600, borderRadius:9, padding:'9px 14px', cursor:'pointer' }}>
              <input type="file" webkitdirectory="" directory="" multiple style={{ display:'none' }} onChange={bulkUploadPayDocs('receipt','Receipt')}/>
              <Icon name="upload" size={14} color="#A6364E"/>Bulk upload receipts
            </label>
          </div>

          {payUpMsg && (
            <div style={{ display:'flex', gap:9, alignItems:'flex-start', background:payUpMsg.count?'var(--tint-green-bg)':'var(--tint-amber-bg)', border:`1px solid ${payUpMsg.count?'var(--tint-green-border)':'var(--tint-amber-border)'}`, borderRadius:12, padding:'11px 13px', marginBottom:12, fontSize:12, color:payUpMsg.count?'var(--tint-green-text)':'var(--tint-amber-text)', lineHeight:1.5 }}>
              <Icon name={payUpMsg.count?'check':'info'} size={15} color={payUpMsg.count?'var(--tint-green-text)':'var(--tint-amber-text)'} style={{ marginTop:1 }}/>
              <div style={{ flex:1 }}>
                {payUpMsg.count > 0 && <div><b>{payUpMsg.label}s</b> attached to <b>{payUpMsg.count} vendor(s)</b>. Vendors can view them in their portal.</div>}
                {payUpMsg.unmatched.length > 0 && <div style={{ marginTop:payUpMsg.count?4:0 }}>Folders that didn't match any vendor in this event: <b>{payUpMsg.unmatched.join(', ')}</b>.</div>}
              </div>
              <button onClick={()=>setPayUpMsg(null)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, flexShrink:0 }}><Icon name="x" size={14} color={payUpMsg.count?'var(--tint-green-text)':'var(--tint-amber-text)'}/></button>
            </div>
          )}
          <div className="admin-cards">
            {pagedPayments.map((a,idx) => {
              const v = vById(a.vendorId);
              const dep = deposits[a.vendorId]||{status:'unpaid'};
              const calc = payCalc(v, curEv, dep.status);
              const payKey = `${a.vendorId}-${curEv.id}`;
              const rec = payRec(payKey);
              const ref = refundRec(payKey);
              const isPartial = rec.status === 'partial';
              const overpaidAmt = rec.paid - calc.total;
              const cardBorder = paySel[a.id] ? '#A6364E' : rec.status==='paid' ? 'var(--tint-green-border)' : rec.status==='partial' ? 'var(--tint-amber-border)' : 'var(--border-light)';
              const notice = scanNotice(rec, calc);
              const advDl = payDocDownloads[payKey];
              return (
                <div key={a.id} style={{ background:'var(--bg-card)', border:`1px solid ${cardBorder}`, borderRadius:16, padding:15 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                    <input type="checkbox" checked={!!paySel[a.id]} onChange={()=>setPaySel(s=>({...s,[a.id]:!s[a.id]}))} style={{ accentColor:'#A6364E', width:16, height:16, cursor:'pointer', flexShrink:0, marginTop:2 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)' }}>#{(page-1)*PER_PAGE+idx+1}</span>
                        <span style={{ fontSize:14.5, fontWeight:700, color:'var(--text-primary)' }}>{v.business}</span>
                        {advDl && <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10.5, fontWeight:600, color:'var(--tint-green-text)', background:'var(--tint-green-bg)', borderRadius:6, padding:'2px 7px' }}><Icon name="check" size={11} color="var(--tint-green-text)"/>Advices downloaded {advDl}</span>}
                      </div>
                      <div style={{ fontSize:11.5, color:'var(--text-secondary)', marginTop:3 }}>{calc.tier} · RM {calc.rate}/day × {calc.days} days</div>
                    </div>
                    <Badge status={rec.status}/>
                  </div>
                  <div style={{ background:'var(--bg-subtle-alt)', borderRadius:12, padding:'11px 13px', marginTop:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-secondary)' }}><span>Rental subtotal</span><span>RM {money(calc.base)}</span></div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-secondary)', marginTop:5 }}><span>SST (6%)</span><span>RM {money(calc.sst)}</span></div>
                    {calc.needsDeposit && <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-secondary)', marginTop:5 }}><span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>Refundable deposit <span style={{ fontSize:9.5, fontWeight:700, background:'var(--tint-amber-bg)', color:'var(--tint-amber-text)', borderRadius:5, padding:'1px 5px' }}>NOT YET HELD</span></span><span>RM 100.00</span></div>}
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, fontWeight:700, color:'var(--text-primary)', marginTop:8, paddingTop:8, borderTop:'1px solid var(--border-light)' }}><span>Total due</span><span>RM {money(calc.total)}</span></div>
                    {isPartial && overpaidAmt <= 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginTop:6, color:'#C76A0D', fontWeight:600 }}><span>Paid RM {money(rec.paid)} · Outstanding</span><span>RM {money(calc.total-rec.paid)}</span></div>}
                  </div>
                  {overpaidAmt > 0 && ref.status !== 'closed' && (
                    <div style={{ background:'var(--tint-red-bg)', border:'1px solid var(--tint-red-border)', borderRadius:12, padding:'11px 13px', marginTop:11 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12.5, fontWeight:700, color:'var(--tint-red-text)' }}>
                        <Icon name="info" size={14} color="var(--tint-red-text)"/>Overpaid by RM {money(overpaidAmt)}
                      </div>
                      {ref.status === 'completed' ? (
                        <>
                          <div style={{ fontSize:11.5, color:'#8a4a3e', marginTop:6 }}>Refund completed · Ref {ref.refCode} · {ref.date} {fmtTime(ref.time)}</div>
                          <button onClick={()=>{ dispatch({type:'MERGE_REFUNDS',payload:{[payKey]:{...ref,status:'closed'}}}); logActivity('Admin', `closed the refund case for ${v.business}'s ${curEv.name} overpayment.`, {icon:'wallet', tint:'var(--tint-blue-bg)'}); showToast('Refund case closed','check'); }} style={{ marginTop:9, background:'var(--bg-card)', border:'1px solid var(--tint-red-border)', color:'var(--tint-red-text)', fontSize:12, fontWeight:600, borderRadius:9, padding:'7px 11px', cursor:'pointer' }}>Close case</button>
                        </>
                      ) : (
                        <button onClick={()=>set({refundModalKey:payKey,reff:{refCode:'',date:'',time:''}})} style={{ marginTop:9, background:'#B03A2E', color:'#fff', border:'none', fontSize:12, fontWeight:600, borderRadius:9, padding:'7px 11px', cursor:'pointer' }}>Arrange refund</button>
                      )}
                    </div>
                  )}
                  {overpaidAmt > 0 && ref.status === 'closed' && (
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:9 }}>Refund closed · Ref {ref.refCode} · {ref.date} {fmtTime(ref.time)}</div>
                  )}
                  {notice && notice.kind === 'unread' && (
                    <div style={{ background:'var(--bg-neutral-soft)', border:'1px solid var(--border-soft)', borderRadius:10, padding:'9px 12px', marginTop:10, fontSize:11.5, color:'var(--text-faint)', lineHeight:1.45 }}>
                      Auto-scan couldn't read an amount from the vendor's payment advice — verify and record manually.
                    </div>
                  )}
                  {notice && notice.kind === 'match' && (
                    <div style={{ background:'var(--tint-green-bg-soft)', border:'1px solid #E3EFE7', borderRadius:10, padding:'9px 12px', marginTop:10, fontSize:11.5, color:'var(--tint-green-text-soft)', lineHeight:1.45 }}>
                      Auto-scan: advice matches the total due (RM {money(notice.scanned)}).{notice.overridden ? ` Recorded amount RM ${money(rec.paid)} was set manually.` : ''}
                    </div>
                  )}
                  {notice && (notice.kind === 'short' || notice.kind === 'over') && (
                    <div style={{ background:'var(--tint-amber-bg-soft)', border:'1px solid var(--tint-amber-border-soft)', borderRadius:10, padding:'9px 12px', marginTop:10, fontSize:11.5, color:'var(--tint-amber-text-soft)', lineHeight:1.45 }}>
                      Auto-scan read RM {money(notice.scanned)} from the advice — {notice.kind==='short' ? `RM ${money(notice.diff)} short of` : `RM ${money(notice.diff)} more than`} the total due.{notice.overridden ? ` Recorded amount RM ${money(rec.paid)} was set manually.` : ' Please double-check.'}
                    </div>
                  )}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginTop:11 }}>
                    {rec.advice ? (
                      <button onClick={()=>set({docPreview:{payKey, field:'advice', editable:false}})} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--tint-green-bg)', border:'1px solid var(--tint-green-border)', color:'var(--tint-green-text)', fontSize:12, fontWeight:600, borderRadius:9, padding:'7px 11px', cursor:'pointer' }}>
                        <Icon name="eye" size={13} color="var(--tint-green-text)"/>Payment advice
                      </button>
                    ) : (
                      <span title="Uploaded by the vendor, not admin" style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--bg-subtle)', border:'1px solid #e7ddd0', color:'var(--text-muted)', fontSize:12, fontWeight:600, borderRadius:9, padding:'7px 11px' }}>
                        <Icon name="clock" size={13} color="var(--text-muted)"/>Payment advice — not yet uploaded by vendor
                      </span>
                    )}
                    {(isPartial || rec.advice2) && (rec.advice2 ? (
                      <button onClick={()=>set({docPreview:{payKey, field:'advice2', editable:false}})} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--tint-green-bg)', border:'1px solid var(--tint-green-border)', color:'var(--tint-green-text)', fontSize:12, fontWeight:600, borderRadius:9, padding:'7px 11px', cursor:'pointer' }}>
                        <Icon name="eye" size={13} color="var(--tint-green-text)"/>2nd payment advice
                      </button>
                    ) : (
                      <span title="Uploaded by the vendor, not admin" style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--bg-subtle)', border:'1px solid #e7ddd0', color:'var(--text-muted)', fontSize:12, fontWeight:600, borderRadius:9, padding:'7px 11px' }}>
                        <Icon name="clock" size={13} color="var(--text-muted)"/>2nd payment advice — not yet uploaded
                      </span>
                    ))}
                    {[['invoice','Invoice'],['receipt','Receipt']].map(([field,label]) => {
                      const f = rec[field];
                      if (f) return (
                        <button key={field} onClick={()=>set({docPreview:{payKey, field, editable:true}})} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--tint-green-bg)', border:'1px solid var(--tint-green-border)', color:'var(--tint-green-text)', fontSize:12, fontWeight:600, borderRadius:9, padding:'7px 11px', cursor:'pointer' }}>
                          <Icon name="eye" size={13} color="var(--tint-green-text)"/>{label}
                        </button>
                      );
                      return (
                        <label key={field} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'var(--text-secondary)', fontSize:12, fontWeight:600, borderRadius:9, padding:'7px 11px', cursor:'pointer' }}>
                          <input type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={async e=>{
                            const file = e.target.files[0]; e.target.value='';
                            if (!file) return;
                            const doc = await fileToPhoto(file);
                            dispatch({type:'MERGE_PAYMENTS', payload:{ [payKey]: { ...rec, [field]: doc } }});
                            logActivity('Admin', `uploaded the ${label.toLowerCase()} for ${v.business} — ${curEv.name}.`, {icon:'file', tint:'var(--tint-green-bg)'});
                            showToast(`${label} uploaded`,'file');
                          }}/>
                          <Icon name="upload" size={13} color="var(--text-secondary)"/>Upload {label.toLowerCase()}
                        </label>
                      );
                    })}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:12, paddingTop:12, borderTop:'1px solid var(--border-faint)' }}>
                    <button onClick={()=>set({payModalKey:payKey,payf:{amount:String(rec.paid||calc.total)}})} style={{ background:'var(--tint-green-bg)', border:'none', color:'var(--tint-green-text)', fontSize:11.5, fontWeight:600, borderRadius:9, padding:'7px 11px', cursor:'pointer' }}>Record payment</button>
                    <button onClick={()=>{ const p={...payments}; p[payKey]={...(p[payKey]||{}),status:'unpaid',paid:0}; dispatch({type:'MERGE_PAYMENTS',payload:p}); showToast('Reset to unpaid','check'); }} style={{ background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'var(--text-secondary)', fontSize:11.5, fontWeight:600, borderRadius:9, padding:'7px 11px', cursor:'pointer' }}>Reset to unpaid</button>
                    <div style={{ flex:1 }}/>
                    <button onClick={()=>showToast(`Payment reminder emailed to ${v.business}`,'bell')} title="Send payment reminder" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:34, height:34, border:'1px solid var(--border-medium)', background:'var(--bg-card)', color:'#A6364E', borderRadius:9, cursor:'pointer', flexShrink:0 }}><Icon name="bell" size={15} color="#A6364E"/></button>
                    <button onClick={()=>{ dispatch({type:'MERGE_APPS',payload:apps.filter(x=>x.id!==a.id)}); showToast(`${v.business} removed — slot released`,'info'); }} title="Remove from event" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:34, height:34, border:'1px solid var(--tint-red-border)', background:'var(--tint-red-bg)', color:'var(--tint-red-text)', borderRadius:9, cursor:'pointer', flexShrink:0 }}><Icon name="trash" size={15} color="var(--tint-red-text)"/></button>
                  </div>
                </div>
              );
            })}
          </div>
          <Pager total={filteredPayApps.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}/>
        </div>
      )}

      {/* ── Deposit Record ── */}
      {aTab === 'deposits' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:9, marginBottom:14 }}>
            <div style={{ flex:1, minWidth:120, background:'var(--tint-green-bg)', borderRadius:13, padding:'12px 14px' }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--tint-green-text)' }}>Deposits held</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:'var(--tint-green-text)', marginTop:3, lineHeight:1 }}>RM {money(Object.values(deposits).filter(d=>d.status==='paid').length*100)}</div>
              <div style={{ fontSize:10.5, color:'#6f9d8a', marginTop:3 }}>{Object.values(deposits).filter(d=>d.status==='paid').length} vendors · RM100 each</div>
            </div>
            <div style={{ flex:1, minWidth:120, background:'var(--tint-blue-bg)', borderRadius:13, padding:'12px 14px' }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--tint-blue-text)' }}>Refunded</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:'var(--tint-blue-text)', marginTop:3, lineHeight:1 }}>{Object.values(deposits).filter(d=>d.status==='refunded').length}</div>
              <div style={{ fontSize:10.5, color:'#7184c9', marginTop:3 }}>returned after market</div>
            </div>
          </div>
          <div style={{ fontSize:11.5, color:'var(--text-muted)', marginBottom:11, lineHeight:1.5 }}>The refundable RM100 deposit is tracked once per vendor. While unpaid, it is automatically added to that vendor's first event invoice.</div>
          <SearchBox value={vendorSearch} onChange={setVendorSearch}/>
          {searchQ && searchVendors(vendors).length === 0 && <NoSearchMatch query={vendorSearch}/>}
          <div className="admin-cards">
            {searchVendors(vendors).map((v,idx) => {
              const dep = depRec(v.id);
              return (
                <div key={v.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:14, padding:'13px 14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}><span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginRight:7 }}>#{idx+1}</span>{v.business}</div>
                      <div style={{ fontSize:11.5, color:'var(--text-secondary)', marginTop:2 }}>{v.owner}</div>
                    </div>
                    <Badge status={dep.status}/>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'7px 16px', marginTop:10, fontSize:11.5, color:'var(--text-secondary)' }}>
                    <span>Invoice <b style={{ color:'var(--text-primary)' }}>{dep.inv||'—'}</b></span>
                    <span>Paid <b style={{ color:'var(--text-primary)' }}>{dep.payDate||'—'}</b></span>
                    <span>Refunded <b style={{ color:'var(--text-primary)' }}>{dep.refundDate||'—'}</b></span>
                  </div>
                  <button onClick={()=>{ const d=depRec(v.id); set({depModalVendor:v.id,depf:{...d}}); }} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:11, width:'100%', background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'#A6364E', fontSize:13, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>
                    <Icon name="pencil" size={14} color="#A6364E"/>Update deposit status
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Parking ── */}
      {aTab === 'parking' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={lbl}>Select event</div>
          <select value={filterEvent} onChange={e=>set({filterEvent:e.target.value,page:1})} style={{ width:'100%', maxWidth:360, border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'12px 13px', fontSize:14, color:'var(--text-primary)', outline:'none', marginBottom:12 }}>
            {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <SearchBox value={vendorSearch} onChange={setVendorSearch}/>
          {(() => {
            const ev = curEv;
            const start = ev.startDate ? new Date(ev.startDate) : null;
            const end   = ev.endDate   ? new Date(ev.endDate)   : null;
            const inEvent = start && end && today >= start && today <= end;
            const editable = inEvent || parkOverride;
            return (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:9, background:editable?'var(--tint-green-bg)':'var(--tint-amber-bg)', border:`1px solid ${editable?'var(--tint-green-border)':'var(--tint-amber-border)'}`, borderRadius:12, padding:'11px 13px', marginBottom:14 }}>
                  <Icon name={editable?'check':'lock'} size={15} color={editable?'var(--tint-green-text)':'var(--tint-amber-text)'}/>
                  <div style={{ flex:1, fontSize:12, fontWeight:500, color:editable?'var(--tint-green-text)':'var(--tint-amber-text)', lineHeight:1.4 }}>
                    {editable ? 'Entry is open — market is currently in progress.' : 'Locked — ticket entry is only available during the event dates.'}
                  </div>
                  <button onClick={()=>set({parkOverride:!parkOverride})} style={{ flexShrink:0, background:'rgba(255,255,255,0.65)', border:`1px solid ${editable?'var(--tint-green-border)':'var(--tint-amber-border)'}`, color:editable?'var(--tint-green-text)':'var(--tint-amber-text)', fontSize:11, fontWeight:600, borderRadius:8, padding:'6px 10px', cursor:'pointer' }}>
                    {parkOverride ? 'Lock' : 'Override'}
                  </button>
                </div>
                {searchQ && searchedApprovedApps.length === 0 && <NoSearchMatch query={vendorSearch}/>}
                <div className="admin-cards">
                  {pagedPark.map((a,idx) => {
                    const v = vById(a.vendorId);
                    const cells = Array.from({length:ev.days||1},(_,i)=>({
                      dayLabel:`Day ${i+1}`, key:`${a.vendorId}-${ev.id}-${i+1}`,
                      value: parking[`${a.vendorId}-${ev.id}-${i+1}`]||'',
                    }));
                    return (
                      <div key={a.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:16, padding:13 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}><span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginRight:7 }}>#{(page-1)*PER_PAGE+idx+1}</span>{v.business}</div>
                            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>Vehicle owner on record</div>
                          </div>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11.5, fontWeight:600, color:'var(--text-secondary)', background:'var(--bg-subtle)', borderRadius:6, padding:'4px 9px', flexShrink:0 }}>
                            <Icon name="car" size={13} color="#A6364E"/>{v.plate}
                          </span>
                        </div>
                        <div style={{ display:'flex', gap:8, marginTop:11 }}>
                          {cells.map(c => (
                            <div key={c.key} style={{ flex:1 }}>
                              <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:4, textAlign:'center' }}>{c.dayLabel} ticket</div>
                              <input value={c.value} disabled={!editable} onChange={e=>{ const p={...parking}; p[c.key]=e.target.value; dispatch({type:'MERGE_PARKING',payload:p}); }} placeholder="—" style={{ width:'100%', border:'1px solid var(--border-medium)', background:editable?'var(--bg-card)':'var(--bg-subtle)', borderRadius:9, padding:'9px 8px', fontSize:13, fontWeight:600, textAlign:'center', outline:'none', color:'var(--text-primary)', cursor:editable?'text':'not-allowed' }}/>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Pager total={searchedApprovedApps.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}/>
              </>
            );
          })()}
        </div>
      )}

      {/* ── Event Pictures ── */}
      {aTab === 'photos' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={lbl}>Select event</div>
          <select value={filterEvent} onChange={e=>{ set({filterEvent:e.target.value,page:1}); setPhotoSel({}); setBulkUpMsg(null); }} style={{ width:'100%', maxWidth:360, border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'12px 13px', fontSize:14, color:'var(--text-primary)', outline:'none', marginBottom:8 }}>
            {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <div style={{ fontSize:11.5, color:'var(--text-muted)', marginBottom:12, lineHeight:1.5 }}>Vendor product photos come from their profile — always their latest set. Booth sharers are grouped with the main vendor. Bulk downloads save one folder per business, renamed "Vendor - 001 - Event".</div>
          <SearchBox value={vendorSearch} onChange={setVendorSearch}/>

          {/* Toolbar */}
          <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:8, marginBottom:12 }}>
            {[['all','All vendors'],['new',`New — not downloaded (${boothGroups.filter(g=>!groupDownloaded(g)).length})`]].map(([id,label]) => (
              <button key={id} onClick={()=>{ setPhotoFilter(id); setPhotoSel({}); set({page:1}); }} style={{ background:photoFilter===id?'#A6364E':'var(--bg-card)', border:`1px solid ${photoFilter===id?'#A6364E':'var(--border-medium)'}`, color:photoFilter===id?'#FAF8F5':'var(--text-secondary)', fontSize:12, fontWeight:600, borderRadius:999, padding:'8px 14px', cursor:'pointer' }}>{label}</button>
            ))}
            <div style={{ flex:1 }}/>
            <label style={{ display:'inline-flex', alignItems:'center', gap:7, fontSize:12, fontWeight:600, color:'var(--text-secondary)', cursor:'pointer', background:'var(--bg-card)', border:'1px solid var(--border-medium)', borderRadius:9, padding:'8px 12px' }}>
              <input type="checkbox" style={{ accentColor:'#A6364E', width:15, height:15, cursor:'pointer' }}
                checked={filteredGroups.length>0 && filteredGroups.every(g=>photoSel[g.id])}
                onChange={()=>{ const all = filteredGroups.length>0 && filteredGroups.every(g=>photoSel[g.id]); setPhotoSel(all ? {} : Object.fromEntries(filteredGroups.map(g=>[g.id,true]))); }}/>
              Select all
            </label>
            <button disabled={zipBusy} onClick={bulkDownloadSel} style={{ display:'inline-flex', alignItems:'center', gap:6, background:selectedGroups.length?'#A6364E':'var(--bg-subtle)', border:'none', color:selectedGroups.length?'#FAF8F5':'var(--text-muted)', fontSize:12, fontWeight:600, borderRadius:9, padding:'9px 14px', cursor:zipBusy?'wait':'pointer' }}>
              <Icon name="download" size={14} color={selectedGroups.length?'#FAF8F5':'var(--text-muted)'}/>Bulk download{selectedGroups.length?` (${selectedGroups.length})`:''}
            </button>
            <label title="Upload a folder containing one sub-folder per business name" style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'#A6364E', fontSize:12, fontWeight:600, borderRadius:9, padding:'9px 14px', cursor:'pointer' }}>
              <input type="file" webkitdirectory="" directory="" multiple style={{ display:'none' }} onChange={handleBulkUpload}/>
              <Icon name="upload" size={14} color="#A6364E"/>Bulk upload
            </label>
          </div>

          {bulkUpMsg && (
            <div style={{ display:'flex', gap:9, alignItems:'flex-start', background:bulkUpMsg.count?'var(--tint-green-bg)':'var(--tint-amber-bg)', border:`1px solid ${bulkUpMsg.count?'var(--tint-green-border)':'var(--tint-amber-border)'}`, borderRadius:12, padding:'11px 13px', marginBottom:12, fontSize:12, color:bulkUpMsg.count?'var(--tint-green-text)':'var(--tint-amber-text)', lineHeight:1.5 }}>
              <Icon name={bulkUpMsg.count?'check':'info'} size={15} color={bulkUpMsg.count?'var(--tint-green-text)':'var(--tint-amber-text)'} style={{ marginTop:1 }}/>
              <div style={{ flex:1 }}>
                {bulkUpMsg.count > 0 && <div><b>{bulkUpMsg.count} photo(s)</b> uploaded to <b>{bulkUpMsg.vendors} vendor(s)</b>. Vendors can now download them from their portal.</div>}
                {bulkUpMsg.unmatched.length > 0 && <div style={{ marginTop:bulkUpMsg.count?4:0 }}>Folders that didn't match any vendor in this event: <b>{bulkUpMsg.unmatched.join(', ')}</b>. Rename them to the exact business name and try again.</div>}
              </div>
              <button onClick={()=>setBulkUpMsg(null)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, flexShrink:0 }}><Icon name="x" size={14} color={bulkUpMsg.count?'var(--tint-green-text)':'var(--tint-amber-text)'}/></button>
            </div>
          )}

          {filteredGroups.length === 0 && (
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:16, padding:'24px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
              {searchQ ? `No vendors match "${vendorSearch}".` : photoFilter==='new' ? 'All booths for this event have been downloaded — nothing new.' : 'No approved vendors for this event yet.'}
            </div>
          )}

          <div className="admin-cards">
            {pagedGroups.map((g,idx) => {
              const isSel = !!photoSel[g.id];
              const mainV = vById(g.members[0]);
              return (
                <div key={g.id} style={{ background:'var(--bg-card)', border:`1.5px solid ${isSel?'#A6364E':'var(--border-light)'}`, borderRadius:16, padding:14 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                    <input type="checkbox" checked={isSel} onChange={()=>setPhotoSel(s=>({...s,[g.id]:!s[g.id]}))} style={{ accentColor:'#A6364E', width:16, height:16, cursor:'pointer', flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text-primary)' }}><span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginRight:7 }}>#{(page-1)*PER_PAGE+idx+1}</span>{mainV.business}</div>
                    </div>
                    {g.shared && (
                      <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'#A6364E', background:'var(--tint-pink-bg)', borderRadius:999, padding:'4px 10px', flexShrink:0 }}>
                        <Icon name="users" size={12} color="#A6364E"/>Shared booth · {g.members.length} vendors
                      </span>
                    )}
                  </label>
                  {g.members.map((vid, mi) => {
                    const v = vById(vid);
                    const key = `${vid}-${filterEvent}`;
                    const dl = photoDownloads[key];
                    const adminPhotos = eventPhotos[key] || [];
                    return (
                      <div key={vid} style={{ marginTop:12, paddingTop:mi>0?12:0, borderTop:mi>0?'1px dashed var(--border-light)':'none' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                          <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{v.business}</span>
                          {mi>0 && <span style={{ fontSize:10.5, fontWeight:600, color:'var(--text-muted)', background:'var(--bg-subtle)', borderRadius:6, padding:'2px 7px' }}>Booth sharer</span>}
                          {dl && <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10.5, fontWeight:600, color:'var(--tint-green-text)', background:'var(--tint-green-bg)', borderRadius:6, padding:'2px 7px' }}><Icon name="check" size={11} color="var(--tint-green-text)"/>Downloaded {dl}</span>}
                          <div style={{ flex:1 }}/>
                          <button disabled={zipBusy} onClick={()=>downloadVendorZip(v)} style={{ display:'inline-flex', alignItems:'center', gap:5, background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'#A6364E', fontSize:11.5, fontWeight:600, borderRadius:9, padding:'6px 10px', cursor:zipBusy?'wait':'pointer', flexShrink:0 }}>
                            <Icon name="download" size={12} color="#A6364E"/>Download ({(v.productPhotos||[]).length})
                          </button>
                        </div>
                        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', marginTop:9 }}>Product photos ({(v.productPhotos||[]).length}) — from vendor profile</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginTop:6 }}>
                          {(v.productPhotos||[]).map(ph=><PhotoTile key={ph.id} photo={ph} size={64}/>)}
                          {!(v.productPhotos||[]).length && <span style={{ fontSize:11.5, color:'var(--text-muted)' }}>None uploaded yet.</span>}
                        </div>
                        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', marginTop:11 }}>Event photos for vendor ({adminPhotos.length}) — vendor downloads these</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginTop:6, alignItems:'center' }}>
                          {adminPhotos.map(ph => (
                            <PhotoTile key={ph.id} photo={ph} size={64} onRemove={()=>{
                              dispatch({type:'MERGE_PHOTOS', payload:{ [key]: adminPhotos.filter(x=>x.id!==ph.id) }});
                              showToast('Photo removed','x');
                            }}/>
                          ))}
                          <label style={{ width:64, height:64, borderRadius:10, border:'2px dashed var(--border-dashed)', background:'var(--bg-subtle-alt)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, cursor:'pointer', flexShrink:0 }}>
                            <input type="file" accept="image/*" multiple style={{ display:'none' }} onChange={async e => {
                              const files = [...e.target.files]; e.target.value = '';
                              if (!files.length) return;
                              const added = await Promise.all(files.map(fileToPhoto));
                              dispatch({type:'MERGE_PHOTOS', payload:{ [key]: [...adminPhotos, ...added] }});
                              logActivity('Admin', `uploaded ${added.length} event photo(s) for ${v.business} — ${curEv.name}.`, {icon:'upload', tint:'var(--tint-green-bg)'});
                              showToast(`${added.length} photo(s) uploaded for ${v.business}`,'image');
                            }}/>
                            <Icon name="upload" size={16} color="#A6364E"/><span style={{ fontSize:8.5, fontWeight:600, color:'#A6364E' }}>Upload</span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <Pager total={filteredGroups.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}/>
        </div>
      )}

      {/* ── Vendor Pass ── */}
      {aTab === 'pass' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={lbl}>Select event</div>
          <select value={filterEvent} onChange={e=>set({filterEvent:e.target.value,page:1})} style={{ width:'100%', border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'12px 13px', fontSize:14, color:'var(--text-primary)', outline:'none', marginBottom:14 }}>
            {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <SearchBox value={vendorSearch} onChange={setVendorSearch}/>
          {searchQ && searchedApprovedApps.length === 0 && <NoSearchMatch query={vendorSearch}/>}
          <div className="admin-cards">
            {pagedPass.map((a,idx) => {
              const v = vById(a.vendorId);
              const p = passes[a.vendorId]||{status:'pending'};
              return (
                <div key={a.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:16, padding:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}><span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginRight:7 }}>#{(page-1)*PER_PAGE+idx+1}</span>{v.business}</div>
                      <div style={{ fontSize:11.5, color:'var(--text-secondary)', marginTop:3 }}>
                        {p.issued ? `${p.issued} tags issued` : 'No tags yet'}
                        {p.collectDate ? ` · collected ${p.collectDate}` : ''}
                      </div>
                    </div>
                    <Badge status={p.status}/>
                  </div>
                  <button onClick={()=>{ const ex=passes[a.vendorId]||{}; set({passModalVendor:a.vendorId,pf:{collector:ex.collector||'',phone:ex.phone||'',issued:ex.issued||'',collectDate:ex.collectDate||'',returned:ex.returned||'',returnDate:ex.returnDate||''}}); }} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:11, width:'100%', background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'#A6364E', fontSize:13, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>
                    <Icon name="pencil" size={14} color="#A6364E"/>Record collection / return
                  </button>
                </div>
              );
            })}
          </div>
          <Pager total={searchedApprovedApps.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}/>
        </div>
      )}

      {/* ── Categories ── */}
      {aTab === 'categories' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <button onClick={()=>set({catEditId:'new'})} style={{ background:'#A6364E', color:'#FAF8F5', border:'none', fontSize:14, fontWeight:600, borderRadius:11, padding:'11px 24px', cursor:'pointer', marginBottom:16 }}>+ Add Category</button>

          <SearchBox value={vendorSearch} onChange={setVendorSearch} placeholder="Search vendors by name"/>

          {/* Category Editor Modal */}
          {state.catEditId && (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }} onClick={()=>set({catEditId:null})}>
              <div onClick={e=>e.stopPropagation()} style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:20, padding:24, maxWidth:420, width:'90%', maxHeight:'80vh', overflowY:'auto' }}>
                <div style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', marginBottom:16 }}>
                  {state.catEditId==='new'?'Add Category':'Edit Category'}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:6, display:'block' }}>Category name</label>
                    <input value={state.cf?.name||''} onChange={e=>set({cf:{...state.cf,name:e.target.value}})} placeholder="e.g. Food & Beverage" style={{ width:'100%', border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'11px 13px', fontSize:14, outline:'none' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:6, display:'block' }}>Description</label>
                    <textarea value={state.cf?.desc||''} onChange={e=>set({cf:{...state.cf,desc:e.target.value}})} placeholder="What products or services are in this category?" style={{ width:'100%', border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'11px 13px', fontSize:14, outline:'none', minHeight:70, resize:'none' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:9, display:'block' }}>Icon</label>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:8 }}>
                      {['utensils','palette','shopbag','sparkles','droplet','home','pen','file','folder','settings','heart','star'].map(ic => (
                        <button key={ic} onClick={()=>set({cf:{...state.cf,icon:ic}})} style={{ width:'100%', aspectRatio:'1/1', border:`2px solid ${state.cf?.icon===ic?'#A6364E':'var(--border-medium)'}`, background:state.cf?.icon===ic?'var(--tint-pink-bg)':'var(--bg-card)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                          <Icon name={ic} size={18} color={state.cf?.icon===ic?'#A6364E':'var(--text-secondary)'}/>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:9, marginTop:16 }}>
                    <button onClick={()=>set({catEditId:null,cf:null})} style={{ flex:1, background:'var(--bg-subtle)', border:'1px solid var(--border-medium)', fontSize:14, fontWeight:600, borderRadius:11, padding:'11px 16px', cursor:'pointer', color:'var(--text-secondary)' }}>Cancel</button>
                    <button onClick={()=>{
                      const name=(state.cf?.name||'').trim(), desc=(state.cf?.desc||'').trim(), icon=state.cf?.icon||'folder';
                      if(!name) { showToast('Category name required','info'); return; }
                      if(state.catEditId==='new') {
                        dispatch({type:'MERGE_CATS',payload:[...cats,{id:'c'+Date.now(),name,desc,icon}]});
                        logActivity('Admin', `added the "${name}" category.`, {icon:'folder', tint:'var(--tint-pink-bg)'});
                        showToast('Category added','check');
                      }
                      set({catEditId:null,cf:null});
                    }} style={{ flex:1, background:'#A6364E', border:'none', fontSize:14, fontWeight:600, borderRadius:11, padding:'11px 16px', cursor:'pointer', color:'#FAF8F5' }}>Save</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Category Accordion Cards */}
          <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:16 }}>
            {cats.map(c => {
              const members = vendors.filter(v=>v.category===c.name);
              const shownMembers = searchVendors(members);
              const isExpanded = state.expandedCats[c.id];
              return (
                <div key={c.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:14, overflow:'hidden' }}>
                  <div onClick={()=>set({expandedCats:{...state.expandedCats,[c.id]:!isExpanded}})} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px', cursor:'pointer' }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:'var(--tint-pink-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Icon name={c.icon} size={18} color="#A6364E"/>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>{c.name}</div>
                      {c.desc && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{c.desc}</div>}
                    </div>
                    <span style={{ fontSize:11, fontWeight:600, color:'#A6364E', background:'var(--tint-pink-bg)', borderRadius:999, padding:'3px 9px', flexShrink:0 }}>{members.length}</span>
                    <Icon name={isExpanded?'chevron-down':'chevron-right'} size={16} color="var(--text-muted)" style={{flexShrink:0}}/>
                    <button onClick={e=>{ e.stopPropagation(); if(window.confirm(`Delete "${c.name}" category?`)) { dispatch({type:'MERGE_CATS',payload:cats.filter(x=>x.id!==c.id)}); showToast('Category removed','x'); } }} style={{ background:'var(--tint-red-bg)', border:'none', width:32, height:32, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--tint-red-text)', cursor:'pointer', flexShrink:0 }}>
                      <Icon name="x" size={15} color="var(--tint-red-text)"/>
                    </button>
                  </div>
                  {isExpanded && (
                    <div style={{ padding:'0 14px 14px', borderTop:'1px solid var(--border-light)' }}>
                      {shownMembers.length > 0 ? (
                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                          {shownMembers.map(v => (
                            <div key={v.id} style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg-subtle-alt)', borderRadius:11, padding:'9px 11px' }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{v.business}</div>
                                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{v.owner}</div>
                              </div>
                              <select onChange={e=>{ dispatch({type:'MERGE_VENDORS',payload:vendors.map(x=>x.id===v.id?{...x,category:e.target.value}:x)}); showToast('Vendor re-assigned','folder'); }} value={v.category} style={{ flexShrink:0, border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:9, padding:'7px 9px', fontSize:12, color:'var(--text-secondary)', outline:'none', cursor:'pointer' }}>
                                {cats.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                      ) : <div style={{ fontSize:11.5, color:'var(--text-muted)', padding:'8px' }}>{members.length > 0 ? `No vendors match "${vendorSearch}" in this category.` : 'No vendors in this category yet.'}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Activity ── */}
      {aTab === 'activity' && (
        <div style={{ padding:'16px 18px 20px' }}>
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            {[['all','All'],['admin','Admin'],['vendor','Vendor']].map(([id,label]) => (
              <button key={id} onClick={()=>set({actTab:id})} style={{ background:actTab===id?'#A6364E':'var(--bg-card)', border:`1px solid ${actTab===id?'#A6364E':'var(--border-medium)'}`, color:actTab===id?'#FAF8F5':'var(--text-secondary)', fontSize:12.5, fontWeight:600, borderRadius:999, padding:'8px 16px', cursor:'pointer' }}>{label}</button>
            ))}
          </div>
          <div style={{ display:'flex', flexDirection:'column' }}>
            {activity.filter(a => actTab==='all' || a.type===actTab).length === 0 && (
              <div style={{ fontSize:13, color:'var(--text-muted)', textAlign:'center', padding:'20px 0' }}>No activity yet.</div>
            )}
            {activity.filter(a => actTab==='all' || a.type===actTab).map((a,i,arr) => (
              <div key={i} style={{ display:'flex', gap:13 }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:a.tint, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Icon name={a.icon} size={15} color="#A6364E"/>
                  </div>
                  {i < arr.length-1 && <div style={{ width:2, flex:1, background:'var(--border-light)', margin:'4px 0' }}/>}
                </div>
                <div style={{ paddingBottom:18, flex:1 }}>
                  <div style={{ fontSize:13.5, color:'var(--text-primary)', lineHeight:1.45 }}><span style={{ fontWeight:700 }}>{a.who}</span> {a.what}</div>
                  <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:3 }}>{a.when}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Vendor Chart ── */}
      {aTab === 'chart' && (
        <div style={{ padding:'14px 16px 20px' }}>
          {(() => {
            const participation = {};
            apps.forEach(a => { participation[a.vendorId]=(participation[a.vendorId]||0)+1; });
            const sorted = Object.entries(participation).sort((a,b)=>b[1]-a[1]);
            const top = sorted[0] ? vById(sorted[0][0]) : {};
            const maxCount = sorted[0]?.[1]||1;
            const shownSorted = searchQ ? sorted.filter(([vid])=>vendorMatches(vById(vid))) : sorted;
            return (
              <>
                <div style={{ background:'linear-gradient(135deg,#A6364E,#7A2438)', borderRadius:18, padding:18, color:'#FAF8F5' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, fontWeight:600, opacity:0.85 }}><Icon name="trophy" size={15} color="#FAF8F5"/>Most active vendor</div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, marginTop:7, lineHeight:1.1 }}>{top.business||'—'}</div>
                  <div style={{ fontSize:12.5, opacity:0.85, marginTop:3 }}>{sorted[0]?.[1]||0} markets joined</div>
                </div>
                <div style={{ display:'flex', gap:8, margin:'15px 0 13px', flexWrap:'wrap' }}>
                  {['all','2026','last3'].map(p => (
                    <button key={p} onClick={()=>set({chartPeriod:p})} style={{ background:chartPeriod===p?'#A6364E':'var(--bg-card)', border:`1px solid ${chartPeriod===p?'#A6364E':'var(--border-medium)'}`, color:chartPeriod===p?'#FAF8F5':'var(--text-secondary)', fontSize:12.5, fontWeight:600, borderRadius:999, padding:'8px 14px', cursor:'pointer' }}>
                      {p==='all'?'All time':p==='2026'?'2026':'Last 3 events'}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', margin:'2px 2px 11px' }}>Participation ranking</div>
                <SearchBox value={vendorSearch} onChange={setVendorSearch}/>
                {shownSorted.length === 0 ? (
                  <NoSearchMatch query={vendorSearch}/>
                ) : (
                  <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:16, padding:14, display:'flex', flexDirection:'column', gap:13 }}>
                    {shownSorted.map(([vid,count]) => {
                      const v = vById(vid);
                      const pct = Math.round(count/maxCount*100);
                      const rankColors = ['#E8A04B','var(--text-muted)','#B87333'];
                      const rank = sorted.findIndex(([id])=>id===vid);
                      return (
                        <div key={vid} style={{ display:'flex', alignItems:'center', gap:11 }}>
                          <div style={{ width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0, background:rank<3?rankColors[rank]:'var(--bg-subtle)', color:rank<3?'#fff':'var(--text-secondary)' }}>{rank+1}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:5 }}>
                              <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{v.business}</span>
                              <span style={{ fontSize:11.5, fontWeight:600, color:'#A6364E' }}>{count} market{count!==1?'s':''}</span>
                            </div>
                            <div style={{ height:6, borderRadius:3, background:'var(--bg-subtle)', overflow:'hidden' }}>
                              <div style={{ height:'100%', borderRadius:3, background:'linear-gradient(90deg,#C75C84,#A6364E)', width:`${pct}%` }}/>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ── Compliance ── */}
      {aTab === 'compliance' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:14, padding:'13px 14px', marginBottom:13, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:200 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>Offence policy</div>
              <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:2, lineHeight:1.4 }}>Vendors with offences sit out this many upcoming markets. A reminder appears on their next applications, with an override option.</div>
            </div>
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
              {[1,2].map(n => (
                <button key={n} onClick={()=>{ set({settings:{...settings, skipMarkets:n}}); showToast(`Policy updated — skip ${n} market${n>1?'s':''}`,'shield'); }} style={{ background:skipN===n?'#A6364E':'var(--bg-card)', border:`1px solid ${skipN===n?'#A6364E':'var(--border-medium)'}`, color:skipN===n?'#FAF8F5':'var(--text-secondary)', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'9px 16px', cursor:'pointer' }}>
                  Skip {n} market{n>1?'s':''}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', background:'var(--bg-subtle)', borderRadius:12, padding:4, gap:4, marginBottom:14 }}>
            {[['log','Log offences'],['review','Vendor review']].map(([id,label]) => (
              <button key={id} onClick={()=>set({compTab:id})} style={{ flex:1, border:'none', fontSize:13, fontWeight:600, borderRadius:9, padding:'10px 4px', cursor:'pointer', background:compTab===id?'var(--bg-card)':'transparent', color:compTab===id?'var(--text-primary)':'var(--text-secondary)', boxShadow:compTab===id?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>{label}</button>
            ))}
          </div>

          {compTab === 'log' && (
            <>
              <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:14, padding:14, display:'flex', gap:9, marginBottom:14 }}>
                <input value={newOffType} onChange={e=>set({newOffType:e.target.value})} placeholder="New offence type, e.g. Smoking in booth" style={{ flex:1, border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'11px 13px', fontSize:14, outline:'none' }}/>
                <button onClick={()=>{
                  const n = newOffType.trim();
                  if (!n) return;
                  if (Object.values(offenseTypes).some(t=>t.label.toLowerCase()===n.toLowerCase())) { showToast('That offence type already exists','info'); return; }
                  const pal = OFFENSE_PALETTE[Object.keys(offenseTypes).length % OFFENSE_PALETTE.length];
                  dispatch({type:'MERGE_OFFENSE_TYPES', payload:{ ...offenseTypes, ['ot'+Date.now()]: { label:n, color:pal.color, bg:pal.bg } }});
                  set({newOffType:''});
                  logActivity('Admin', `added the "${n}" offence type.`, {icon:'shield', tint:'var(--tint-pink-bg)'});
                  showToast('Offence type added','shield');
                }} style={{ background:'#A6364E', color:'#FAF8F5', border:'none', fontSize:14, fontWeight:600, borderRadius:11, padding:'11px 16px', cursor:'pointer' }}>Add</button>
              </div>
              <div style={lbl}>Event</div>
              <select value={filterEvent} onChange={e=>set({filterEvent:e.target.value,compSel:{}})} style={{ width:'100%', maxWidth:360, border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'12px 13px', fontSize:14, color:'var(--text-primary)', outline:'none', marginBottom:14 }}>
                {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <div className="admin-cards">
                {Object.entries(offenseTypes).map(([type,ot]) => {
                  const sel = compSel[type]||[];
                  const eventVendors = [...new Set(apps.filter(a=>a.eventId===filterEvent&&a.status==='approved').map(a=>a.vendorId))];
                  return (
                    <div key={type} style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:14, padding:'13px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                        <span style={{ width:10, height:10, borderRadius:'50%', background:ot.color, flexShrink:0 }}/>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text-primary)' }}>{ot.label}</div>
                        </div>
                        {offenses.every(o=>o.type!==type) && (
                          <button title="Remove this offence type" onClick={()=>{ const t={...offenseTypes}; delete t[type]; dispatch({type:'MERGE_OFFENSE_TYPES', payload:t}); showToast('Offence type removed','x'); }} style={{ background:'var(--bg-subtle)', border:'none', width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                            <Icon name="x" size={13} color="var(--text-muted)"/>
                          </button>
                        )}
                      </div>
                      {sel.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>
                          {sel.map(vid => (
                            <button key={vid} onClick={()=>{ const s={...compSel}; s[type]=(s[type]||[]).filter(x=>x!==vid); set({compSel:s}); }} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--tint-pink-bg)', border:'1px solid #eccdd6', color:'#A6364E', fontSize:11.5, fontWeight:600, borderRadius:999, padding:'5px 7px 5px 11px', cursor:'pointer' }}>
                              {vById(vid).business}<Icon name="x" size={13} color="#A6364E"/>
                            </button>
                          ))}
                        </div>
                      )}
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:9 }}>
                        {eventVendors.filter(vid=>!sel.includes(vid)).map(vid => (
                          <button key={vid} onClick={()=>{ const s={...compSel}; s[type]=[...(s[type]||[]),vid]; set({compSel:s}); }} style={{ display:'inline-flex', alignItems:'center', gap:5, background:'var(--bg-card)', border:'1px dashed var(--border-dashed)', color:'var(--text-secondary)', fontSize:11.5, fontWeight:500, borderRadius:999, padding:'5px 11px', cursor:'pointer' }}>+ {vById(vid).business}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={()=>{
                const sel=compSel; const ev=filterEvent; const added=[]; let id=Date.now();
                Object.entries(sel).forEach(([type,vids])=>(vids||[]).forEach(vid=>added.push({id:'o'+(id++),vendorId:vid,eventId:ev,type})));
                if(!added.length){ showToast('Select at least one vendor first','info'); return; }
                dispatch({type:'MERGE_OFFENSES',payload:[...offenses,...added]});
                set({compSel:{}});
                logActivity('Admin', `logged ${added.length} offence${added.length>1?'s':''} for ${curEv.name}.`, {icon:'shield', tint:'var(--tint-pink-bg)'});
                showToast(`${added.length} offence${added.length>1?'s':''} logged`,'shield');
              }} className="cta" style={{ marginTop:14, width:'100%', background:'#A6364E', color:'#FAF8F5', border:'none', fontSize:14, fontWeight:600, borderRadius:12, padding:13, cursor:'pointer' }}>
                Log selected offences for {curEv.name}
              </button>
            </>
          )}

          {compTab === 'review' && (
            <>
              <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:14, padding:'13px 14px', marginBottom:13 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', marginBottom:9 }}>Offence legend</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'8px 16px' }}>
                  {Object.entries(offenseTypes).map(([type,ot]) => (
                    <span key={type} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11.5, color:'var(--text-secondary)' }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:ot.color }}/>
                      {ot.label}
                    </span>
                  ))}
                </div>
              </div>
              <SearchBox value={vendorSearch} onChange={setVendorSearch}/>
              {searchQ && searchVendors(vendors).length === 0 && <NoSearchMatch query={vendorSearch}/>}
              <div className="admin-cards">
                {searchVendors(vendors).map((v,idx) => {
                  const vOff = offenses.filter(o=>o.vendorId===v.id);
                  return (
                    <div key={v.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:14, padding:'13px 14px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                        <div style={{ minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                            <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)' }}>#{idx+1}</span>
                            <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{v.business}</span>
                          </div>
                          <div style={{ fontSize:11.5, color:'var(--text-secondary)', marginTop:1 }}>{v.category}</div>
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)', background:'var(--bg-subtle)', borderRadius:999, padding:'5px 11px', flexShrink:0 }}>{vOff.length} total</span>
                      </div>
                      {vOff.length === 0 && (
                        <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:9 }}>No offences on record.</div>
                      )}
                      {vOff.map(o => {
                        const ot = offenseTypes[o.type]||{};
                        const oPhotos = o.photos||[];
                        const updOffense = (patch) => dispatch({type:'MERGE_OFFENSES', payload: offenses.map(x=>x.id===o.id?{...x,...patch}:x)});
                        return (
                          <div key={o.id} style={{ background:'var(--bg-subtle-alt)', borderRadius:11, padding:'10px 11px', marginTop:9 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                              <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, borderRadius:999, padding:'4px 10px', background:ot.bg, color:ot.color }}><span style={{ width:6, height:6, borderRadius:'50%', background:ot.color }}/>{ot.label}</span>
                              <span style={{ fontSize:11.5, color:'var(--text-secondary)' }}>{eById(o.eventId).name || 'Unknown event'}</span>
                              <button title="Remove this offence" onClick={()=>{ if(!window.confirm(`Remove this ${ot.label||'offence'} record for ${v.business}?`)) return; dispatch({type:'MERGE_OFFENSES', payload: offenses.filter(x=>x.id!==o.id)}); logActivity('Admin', `removed a ${ot.label||'offence'} record for ${v.business}.`, {icon:'shield', tint:'var(--bg-subtle)'}); showToast('Offence removed','x'); }} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', padding:2, flexShrink:0 }}>
                                <Icon name="x" size={13} color="var(--text-muted)"/>
                              </button>
                            </div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginTop:9, alignItems:'center' }}>
                              {oPhotos.map(ph => (
                                <PhotoTile key={ph.id} photo={ph} size={56} onRemove={()=>{ updOffense({photos: oPhotos.filter(x=>x.id!==ph.id)}); showToast('Evidence photo removed','x'); }}/>
                              ))}
                              <label title="Upload evidence photos the vendor can see" style={{ width:56, height:56, borderRadius:10, border:'2px dashed var(--border-dashed)', background:'var(--bg-card)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1, cursor:'pointer', flexShrink:0 }}>
                                <input type="file" accept="image/*" multiple style={{ display:'none' }} onChange={async e=>{
                                  const files = [...e.target.files]; e.target.value='';
                                  if (!files.length) return;
                                  const added = await Promise.all(files.map(fileToPhoto));
                                  updOffense({photos:[...oPhotos, ...added]});
                                  logActivity('Admin', `added ${added.length} evidence photo(s) to ${v.business}'s ${ot.label||'offence'} record.`, {icon:'camera', tint:'var(--tint-pink-bg)'});
                                  showToast(`${added.length} photo(s) added — visible to the vendor`,'camera');
                                }}/>
                                <Icon name="upload" size={14} color="#A6364E"/><span style={{ fontSize:8, fontWeight:600, color:'#A6364E' }}>Photo</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Content ── */}
      {aTab === 'content' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:18, padding:16 }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:600, color:'var(--text-primary)' }}>Homepage content</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>Update public-facing branding without code.</div>
            <div style={{ marginTop:16 }}>
              <div style={lbl}>Badge / status text</div>
              <input value={state.cf?.purpose ?? content.purpose} onChange={e=>set({cf:{...(state.cf||content),purpose:e.target.value}})} style={inp}/>
            </div>
            <div style={{ marginTop:14 }}><div style={lbl}>Homepage title</div><textarea value={state.cf?.title ?? content.title} onChange={e=>set({cf:{...(state.cf||content),title:e.target.value}})} style={{ ...inp, minHeight:64, resize:'none' }}/></div>
            <div style={{ marginTop:14 }}><div style={lbl}>Intro / purpose</div><textarea value={state.cf?.subtitle ?? content.subtitle} onChange={e=>set({cf:{...(state.cf||content),subtitle:e.target.value}})} style={{ ...inp, minHeight:84, resize:'none' }}/></div>
            <div style={{ borderTop:'1px solid var(--border-faint)', marginTop:18, paddingTop:16 }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:600, color:'var(--text-primary)' }}>Application — market terms</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>Shown on the last step of the vendor application. Vendors must accept before submitting.</div>
              <textarea value={state.cf?.terms ?? content.terms} onChange={e=>set({cf:{...(state.cf||content),terms:e.target.value}})} style={{ ...inp, minHeight:240, marginTop:12, fontSize:13, lineHeight:1.6, resize:'vertical' }}/>
            </div>
            <button onClick={()=>{ set({content:{...state.cf},cf:null}); logActivity('Admin', 'updated the homepage content.', {icon:'pen', tint:'var(--tint-pink-bg)'}); showToast('Content updated','check'); }} className="cta" style={{ marginTop:16, width:'100%', background:'#A6364E', color:'#FAF8F5', border:'none', fontSize:14.5, fontWeight:600, borderRadius:12, padding:14, cursor:'pointer' }}>Save changes</button>
          </div>
        </div>
      )}

      {/* ── Settings ── */}
      {aTab === 'settings' && (
        <div style={{ padding:'14px 16px 20px', display:'flex', flexDirection:'column', gap:11 }}>
          {[
            { key:'autoApprove', title:'Auto-approve vendors', desc:'Automatically approve all new vendor registrations without manual review.' },
            { key:'publicEvents', title:'Show events publicly', desc:'Display upcoming markets on the public home page.' },
            { key:'emailAlerts', title:'Email alerts', desc:'Send email notifications to vendors on status changes.' },
          ].map(s => {
            const on = settings[s.key];
            return (
              <div key={s.key} style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:14, padding:14, display:'flex', alignItems:'center', gap:13 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:'var(--text-primary)' }}>{s.title}</div>
                  <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:2, lineHeight:1.4 }}>{s.desc}</div>
                </div>
                <div onClick={()=>set({settings:{...settings,[s.key]:!on}})} style={{ width:48, height:28, borderRadius:14, background:on?'#A6364E':'var(--border-dashed)', position:'relative', cursor:'pointer', flexShrink:0, transition:'background .2s' }}>
                  <div style={{ position:'absolute', top:3, left:on?22:3, width:22, height:22, borderRadius:'50%', background:'var(--bg-card)', transition:'left .2s', boxShadow:'0 1px 4px rgba(0,0,0,0.15)' }}/>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Admin Roles (super admin only) ── */}
      {aTab === 'roles' && isSuperActing && (() => {
        const grantableTabs = ADMIN_TABS.filter(t => !t.superOnly);
        const permOf = (a, tab) => a.perms?.[tab] || 'none';
        const setPerm = (adminId, tab, level) => {
          dispatch({ type:'MERGE_ADMINS', payload: admins.map(x => {
            if (x.id !== adminId) return x;
            const perms = { ...x.perms };
            if (level === 'none') delete perms[tab]; else perms[tab] = level;
            return { ...x, perms };
          })});
        };
        const setAllPerms = (adminId, level) => {
          dispatch({ type:'MERGE_ADMINS', payload: admins.map(x => x.id === adminId
            ? { ...x, perms: level === 'none' ? {} : Object.fromEntries(grantableTabs.map(t => [t.id, level])) }
            : x)});
          showToast(level === 'none' ? 'All access cleared' : `All tabs set to ${level}`, 'lock');
        };
        const createAdmin = () => {
          const id = newAdmin.id.trim().toLowerCase().replace(/\s+/g, '');
          const name = newAdmin.name.trim();
          if (!id || !name) { showToast('Fill in both the admin ID and full name', 'info'); return; }
          if (!/^[a-z0-9_.-]+$/.test(id)) { showToast('Admin ID can only use letters, numbers, dots, dashes', 'info'); return; }
          if (admins.some(a => a.id === id)) { showToast('That admin ID already exists', 'info'); return; }
          dispatch({ type:'MERGE_ADMINS', payload: [...admins, { id, name, role:'staff', password:DEFAULT_ADMIN_PASSWORD, mustReset:true, perms:{} }] });
          setNewAdmin({ id:'', name:'' });
          logActivity('Admin', `created the admin ID "${id}" for ${name}.`, { icon:'lock', tint:'var(--tint-pink-bg)' });
          showToast(`Admin created — they sign in with ${id} / ${DEFAULT_ADMIN_PASSWORD}`, 'check');
        };
        const resetPassword = (a) => {
          if (!window.confirm(`Reset ${a.name}'s password back to the default (${DEFAULT_ADMIN_PASSWORD})? They'll set a new one on their next sign-in.`)) return;
          dispatch({ type:'MERGE_ADMINS', payload: admins.map(x => x.id === a.id ? { ...x, password:DEFAULT_ADMIN_PASSWORD, mustReset:true } : x) });
          logActivity('Admin', `reset the password for admin "${a.id}".`, { icon:'lock', tint:'var(--tint-amber-bg)' });
          showToast(`${a.name}'s password reset to ${DEFAULT_ADMIN_PASSWORD}`, 'lock');
        };
        const removeAdmin = (a) => {
          if (!window.confirm(`Remove admin "${a.id}" (${a.name})? They will no longer be able to sign in.`)) return;
          dispatch({ type:'MERGE_ADMINS', payload: admins.filter(x => x.id !== a.id) });
          logActivity('Admin', `removed the admin ID "${a.id}".`, { icon:'x', tint:'var(--tint-red-bg)' });
          showToast('Admin removed', 'x');
        };
        const staffAdmins = admins.filter(a => a.role !== 'super');
        const target = admins.find(a => a.id === transferTo);
        const transferReady = target && transferConfirm.trim().toLowerCase() === target.id.toLowerCase();
        const transferSuperAdmin = () => {
          if (!transferReady) return;
          const outgoingId = acting?.id;
          dispatch({ type:'MERGE_ADMINS', payload: admins.map(x => {
            if (x.id === target.id) return { ...x, role:'super' };
            if (x.id === outgoingId) return { ...x, role:'staff', perms: Object.fromEntries(grantableTabs.map(t => [t.id,'edit'])) };
            return x;
          })});
          logActivity('Admin', `transferred the super admin role to "${target.id}" (${target.name}).`, { icon:'lock', tint:'var(--tint-pink-bg)' });
          showToast(`Super admin transferred to ${target.name} — you're now a regular admin with full edit access`, 'lock');
          setExpandedAdmin(null); setTransferTo(''); setTransferConfirm('');
        };
        const segStyle = (on, color) => ({ flex:1, border:'none', fontSize:11, fontWeight:600, borderRadius:7, padding:'6px 4px', cursor:'pointer', background:on?color:'transparent', color:on?'#fff':'var(--text-secondary)' });
        return (
          <div style={{ padding:'14px 16px 20px' }}>
            {/* Create admin */}
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:18, padding:16 }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:600, color:'var(--text-primary)' }}>Create admin ID</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3, lineHeight:1.5 }}>New admins start with the default password <b style={{ color:'var(--text-secondary)' }}>{DEFAULT_ADMIN_PASSWORD}</b> and must set their own the first time they sign in.</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginTop:14 }}>
                <input value={newAdmin.id} onChange={e=>setNewAdmin(s=>({...s,id:e.target.value}))} placeholder="Admin ID, e.g. staff02" style={{ flex:1, minWidth:150, border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'11px 13px', fontSize:14, outline:'none' }}/>
                <input value={newAdmin.name} onChange={e=>setNewAdmin(s=>({...s,name:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&createAdmin()} placeholder="Full name" style={{ flex:1, minWidth:150, border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'11px 13px', fontSize:14, outline:'none' }}/>
                <button onClick={createAdmin} style={{ background:'#A6364E', color:'#FAF8F5', border:'none', fontSize:14, fontWeight:600, borderRadius:11, padding:'11px 18px', cursor:'pointer' }}>Create</button>
              </div>
            </div>
            <div style={{ display:'flex', gap:9, background:'var(--bg-subtle-alt)', border:'1px solid var(--border-light)', borderRadius:12, padding:'11px 13px', margin:'13px 0', fontSize:11.5, color:'var(--text-muted)', lineHeight:1.5 }}>
              <Icon name="info" size={14} color="var(--text-muted)" style={{ marginTop:1, flexShrink:0 }}/>
              New console tabs appear in this list automatically. Access is <b style={{ color:'var(--text-secondary)' }}>off by default</b> — grant View (browse only) or Edit (make changes) per tab.
            </div>
            {/* Admin list — compact rows, click to expand permissions */}
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:16, overflow:'hidden' }}>
              {admins.map((a,i) => {
                const isOpen = expandedAdmin === a.id;
                const grantedCount = grantableTabs.filter(t => permOf(a,t.id) !== 'none').length;
                const editCount = grantableTabs.filter(t => permOf(a,t.id) === 'edit').length;
                const summary = a.role === 'super' ? 'Full access · all tabs'
                  : grantedCount === 0 ? 'No tab access granted'
                  : `${grantedCount} tab${grantedCount>1?'s':''} granted${editCount ? ` · ${editCount} editable` : ' · view only'}`;
                return (
                  <div key={a.id} style={{ borderTop: i>0 ? '1px solid var(--border-faint)' : 'none' }}>
                    <button
                      onClick={()=> setExpandedAdmin(isOpen ? null : a.id)}
                      style={{ width:'100%', display:'flex', alignItems:'center', gap:11, padding:'12px 14px', background:'none', border:'none', cursor:'pointer', textAlign:'left' }}
                    >
                      <div style={{ width:36, height:36, borderRadius:'50%', background: a.role==='super' ? '#3A1622' : 'var(--tint-pink-bg)', display:'flex', alignItems:'center', justifyContent:'center', color: a.role==='super' ? '#FAF8F5' : '#A6364E', fontWeight:700, fontSize:13, flexShrink:0 }}>
                        {a.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                          <span style={{ fontSize:13.5, fontWeight:700, color:'var(--text-primary)' }}>{a.name}</span>
                          <span style={{ fontSize:11, color:'var(--text-muted)' }}>{a.id}</span>
                          {a.role === 'super' ? (
                            <span style={{ fontSize:10, fontWeight:700, color:'#FAF8F5', background:'#3A1622', borderRadius:999, padding:'2px 8px' }}>Super admin</span>
                          ) : a.mustReset ? (
                            <span style={{ fontSize:10, fontWeight:600, color:'var(--tint-amber-text)', background:'var(--tint-amber-bg)', borderRadius:999, padding:'2px 8px' }}>Awaiting first sign-in</span>
                          ) : (
                            <span style={{ fontSize:10, fontWeight:600, color:'var(--tint-green-text)', background:'var(--tint-green-bg)', borderRadius:999, padding:'2px 8px' }}>Active</span>
                          )}
                        </div>
                        <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:2 }}>{summary}</div>
                      </div>
                      <Icon name={isOpen ? 'x' : 'pencil'} size={14} color="var(--text-muted)" style={{ flexShrink:0 }}/>
                    </button>
                    {isOpen && a.role === 'super' && (
                      <div style={{ padding:'0 14px 16px' }}>
                        <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 }}>You have full access to every tab and manage all other admin accounts. Only one admin can hold this role at a time.</div>
                        {staffAdmins.length === 0 ? (
                          <div style={{ background:'var(--bg-subtle-alt)', border:'1px solid var(--border-light)', borderRadius:11, padding:'11px 13px', marginTop:12, fontSize:12, color:'var(--text-muted)' }}>
                            Create another admin ID first — you'll be able to transfer the super admin role to them here.
                          </div>
                        ) : (
                          <div style={{ background:'var(--bg-subtle-alt)', border:'1px solid var(--border-light)', borderRadius:14, padding:14, marginTop:12 }}>
                            <div style={{ fontSize:12.5, fontWeight:700, color:'var(--text-primary)' }}>Transfer super admin role</div>
                            <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:3, lineHeight:1.5 }}>You'll immediately become a regular admin with full edit access on every tab, and can no longer manage admin accounts. This can be undone by having the new super admin transfer it back to you.</div>
                            <div style={{ marginTop:11 }}>
                              <div style={{ fontSize:11.5, fontWeight:600, color:'var(--text-primary)', marginBottom:6 }}>Transfer to</div>
                              <select value={transferTo} onChange={e=>{ setTransferTo(e.target.value); setTransferConfirm(''); }} style={{ width:'100%', border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:10, padding:'10px 12px', fontSize:13, color:'var(--text-primary)', outline:'none' }}>
                                <option value="">Select an admin…</option>
                                {staffAdmins.map(x => <option key={x.id} value={x.id}>{x.name} ({x.id})</option>)}
                              </select>
                            </div>
                            {target && (
                              <div style={{ marginTop:11 }}>
                                <div style={{ fontSize:11.5, fontWeight:600, color:'var(--text-primary)', marginBottom:6 }}>Type "{target.id}" to confirm</div>
                                <input value={transferConfirm} onChange={e=>setTransferConfirm(e.target.value)} placeholder={target.id} style={{ width:'100%', border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:10, padding:'10px 12px', fontSize:13, color:'var(--text-primary)', outline:'none' }}/>
                              </div>
                            )}
                            <button onClick={transferSuperAdmin} disabled={!transferReady} style={{ marginTop:12, width:'100%', background:transferReady?'#A6364E':'var(--bg-subtle)', color:transferReady?'#FAF8F5':'var(--text-muted)', border:'none', fontSize:13, fontWeight:600, borderRadius:10, padding:11, cursor:transferReady?'pointer':'not-allowed' }}>
                              Transfer super admin role{target ? ` to ${target.name}` : ''}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {isOpen && a.role !== 'super' && (
                      <div style={{ padding:'0 14px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:2 }}>
                          <span style={{ fontSize:11, fontWeight:700, color:'var(--text-primary)' }}>Tab access</span>
                          <div style={{ flex:1 }}/>
                          <button onClick={()=>setAllPerms(a.id,'view')} style={{ background:'none', border:'none', color:'#A6364E', fontSize:11, fontWeight:600, cursor:'pointer', textDecoration:'underline', textUnderlineOffset:2 }}>All view</button>
                          <button onClick={()=>setAllPerms(a.id,'edit')} style={{ background:'none', border:'none', color:'#A6364E', fontSize:11, fontWeight:600, cursor:'pointer', textDecoration:'underline', textUnderlineOffset:2 }}>All edit</button>
                          <button onClick={()=>setAllPerms(a.id,'none')} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:11, fontWeight:600, cursor:'pointer', textDecoration:'underline', textUnderlineOffset:2 }}>Clear</button>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:9 }}>
                          {grantableTabs.map(t => {
                            const p = permOf(a, t.id);
                            return (
                              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:9 }}>
                                <span style={{ flex:1, fontSize:12, color: p==='none' ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: p==='none' ? 400 : 600, display:'flex', alignItems:'center', gap:7, minWidth:0 }}>
                                  <Icon name={t.icon} size={13} color={p==='none' ? 'var(--text-faint)' : '#A6364E'}/>{t.label}
                                </span>
                                <div style={{ display:'flex', background:'var(--bg-subtle)', borderRadius:9, padding:3, gap:2, width:186, flexShrink:0 }}>
                                  <button onClick={()=>setPerm(a.id,t.id,'none')} style={segStyle(p==='none','var(--text-muted)')}>None</button>
                                  <button onClick={()=>setPerm(a.id,t.id,'view')} style={segStyle(p==='view','var(--tint-amber-text)')}>View</button>
                                  <button onClick={()=>setPerm(a.id,t.id,'edit')} style={segStyle(p==='edit','var(--tint-green-text)')}>Edit</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display:'flex', gap:9, marginTop:14, paddingTop:12, borderTop:'1px solid var(--border-faint)' }}>
                          <button onClick={()=>resetPassword(a)} style={{ flex:1, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'#A6364E', fontSize:12, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>
                            <Icon name="lock" size={13} color="#A6364E"/>Reset password to default
                          </button>
                          <button onClick={()=>{ removeAdmin(a); setExpandedAdmin(null); }} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, background:'var(--tint-red-bg)', border:'none', color:'var(--tint-red-text)', fontSize:12, fontWeight:600, borderRadius:10, padding:'9px 13px', cursor:'pointer' }}>
                            <Icon name="trash" size={13} color="var(--tint-red-text)"/>Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Admin Profile ── */}
      {aTab === 'profile' && (
        <div style={{ padding:'16px 16px 20px', display:'flex', flexDirection:'column', gap:13 }}>
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:18, padding:18, display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:54, height:54, borderRadius:'50%', background:'#3A1622', display:'flex', alignItems:'center', justifyContent:'center', color:'#FAF8F5', fontWeight:700, fontSize:18, flexShrink:0 }}>SA</div>
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:600, color:'var(--text-primary)' }}>Siti Aminah</div>
              <div style={{ fontSize:12.5, color:'var(--text-secondary)', marginTop:2 }}>Portal Administrator</div>
            </div>
          </div>
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:16, padding:'4px 16px' }}>
            {[['Email','admin@sulapartisan.com'],['Role','Super admin'],['Last sign-in','Today, 9:12 AM']].map(([k,v],i,arr) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'13px 0', borderBottom:i<arr.length-1?'1px solid var(--border-faint)':'none' }}>
                <span style={{ fontSize:12.5, color:'var(--text-muted)' }}>{k}</span>
                <span style={{ fontSize:13.5, fontWeight:600, color:'var(--text-primary)' }}>{v}</span>
              </div>
            ))}
          </div>
          <button onClick={logout} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'var(--tint-red-bg)', border:'1px solid var(--tint-red-border)', color:'var(--tint-red-text)', fontSize:14, fontWeight:600, borderRadius:14, padding:14, cursor:'pointer', marginTop:4 }}>
            <Icon name="x" size={16} color="var(--tint-red-text)"/>Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const lbl = { display:'block', fontSize:12, fontWeight:600, color:'var(--text-primary)', marginBottom:6 };
const inp = { width:'100%', border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'12px 13px', fontSize:14, outline:'none', display:'block' };
