import { useState, useEffect, useRef } from 'react';
import Icon from '../components/Icon';
import Badge from '../components/Badge';
import PhotoTile from '../components/PhotoTile';
import VendorAvatar from '../components/VendorAvatar';
import PasswordInput from '../components/PasswordInput';
import MobileNavDrawer from '../components/MobileNavDrawer';
import PortalHeader from '../components/PortalHeader';
import PortalFooter from '../components/PortalFooter';
import { ModernPager, TableShell, MiniTablePanel, FilterPill, IconBtn } from '../components/TableShell';
import RichTextEditor from '../components/RichTextEditor';
import { useStore } from '../lib/store';
import { money, fmt, fmtShort, fmtTime, payCalc, badge, dayCount, eventStatus, parseDateOnly, EINVOICE_FIELDS, DETAILS_FIELDS, orderTabs, reorderIds } from '../lib/helpers';
import { VENDOR_TABS } from './VendorDashboard';
import { OFFENSE_PALETTE, EVENT_IMG_PALETTE, isEventPhoto, eventImgFromFile, DEFAULT_ADMIN_PASSWORD, PASS_REJECT_REASONS } from '../data/mockData';
import { fileToPhoto, downloadZip, safeName, photoExt, renamedFile } from '../lib/photoFiles';
import { downloadCsv } from '../lib/csv';
import { scanNotice } from '../lib/payScan';
import { downloadSignupForm, downloadSignupFormsZip } from '../lib/signupForm';
import { downloadPassReport } from '../lib/passReport';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchAllAdminProfiles, updateAdminPerms, updateAdminRole, updateAdminName, updateAdminStaffId, displayStaffId, createAdminAccount, resetAdminPassword, removeAdminAccount } from '../lib/supaAdmins';
import { fetchAllVendors, updateVendorStatus, updateVendorDetails, updateVendorEinvoice } from '../lib/supaVendors';
import { insertEvent } from '../lib/supaEvents';
import { fetchAllApps, updateAppStatus, deleteApp } from '../lib/supaApps';
import { fetchAllPayments, fetchAllDeposits, savePaymentRecord, fetchAllRefunds, saveRefundRecord } from '../lib/supaPayments';
import { fetchAllProfileRequests, updateProfileRequestStatus } from '../lib/supaProfileRequests';
import { fetchAllActivity } from '../lib/supaActivity';
import { updateContent } from '../lib/supaContent';
import { fetchAllOffenses, fetchOffenseTypes, insertOffenseType, deleteOffenseType, insertOffense, updateOffensePhotos, deleteOffense } from '../lib/supaOffences';
import { fetchAllParking, upsertParkingSerial } from '../lib/supaParking';
import { fetchAllPassApps, decidePassPerson, updatePassBooth, grantExtraPassSlots } from '../lib/supaVendorPasses';
import { uploadPrivateFile } from '../lib/supaStorage';
import { fetchDocTypes, insertDocType, deleteDocType, updateDocTypeRequired } from '../lib/supaDocTypes';
import { PASSWORD_HINT, isStrongPassword, PasswordChecklist, friendlyAuthError } from '../lib/passwordPolicy';
import { useModalA11y } from '../lib/useModalA11y';
import { clickable } from '../lib/a11yClickable';

// Single source of truth for console tabs — the sidebar, mobile pills, AND the
// Admin Roles permission matrix all render from this list, so adding or
// removing a tab here automatically updates role management too.
export const ADMIN_TABS = [
  { id:'overview',   label:'Dashboard',           icon:'grid' },
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
  { id:'compliance', label:'Compliance',          icon:'shield' },
  { id:'content',    label:'Content',             icon:'pen' },
  { id:'settings',   label:'Settings',            icon:'settings', superOnly:true },
  { id:'roles',      label:'Admin Roles',         icon:'lock', superOnly:true },
  // Reached only via the header profile card click, not the sidebar/mobile nav
  // or Admin Roles' permission matrix — every admin can always view/edit their
  // own account regardless of role or granted tab perms (see store.jsx's
  // adminLocked bypass for aTab === 'account').
  { id:'account',    label:'My Account',          icon:'user', hidden:true },
];

// Settings → "Portal tab order" (super admin only): one reorderable list per portal.
// Rows can be dragged (desktop) or nudged with the arrows (works on touch too); the
// resulting order applies globally — every admin's console and every vendor's portal
// render their tabs in this order, with no reorder controls of their own.
function TabOrderCard({ title, desc, tabs, onOrder, onReset, isCustom }) {
  const [dragId, setDragId] = useState(null); // visual feedback
  const [overId, setOverId] = useState(null);
  const dragIdRef = useRef(null); // drop logic reads the ref — state may lag a render behind
  const ids = tabs.map(t => t.id);
  const drop = (targetId) => {
    const dragId = dragIdRef.current;
    if (dragId && dragId !== targetId) onOrder(reorderIds(ids, dragId, targetId));
  };
  const nudgeBtn = (disabled) => ({
    width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border-medium)',
    background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1, flexShrink: 0,
  });
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:14, padding:14 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13.5, fontWeight:600, color:'var(--text-primary)' }}>{title}</div>
          <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:2, lineHeight:1.4 }}>{desc}</div>
        </div>
        {isCustom && (
          <button onClick={onReset} style={{ background:'none', border:'none', color:'#9A5B26', fontSize:11.5, fontWeight:600, cursor:'pointer', padding:'2px 0', flexShrink:0 }}>
            Reset to default
          </button>
        )}
      </div>
      <div style={{ marginTop:11, display:'flex', flexDirection:'column', gap:3 }}>
        {tabs.map((t, i) => (
          <div key={t.id} draggable title="Drag or use the arrows to rearrange"
            onDragStart={e => { if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; dragIdRef.current = t.id; setDragId(t.id); }}
            onDragOver={e => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; if (overId !== t.id) setOverId(t.id); }}
            onDragLeave={() => { if (overId === t.id) setOverId(null); }}
            onDrop={e => { e.preventDefault(); drop(t.id); dragIdRef.current = null; setDragId(null); setOverId(null); }}
            onDragEnd={() => { dragIdRef.current = null; setDragId(null); setOverId(null); }}
            style={{
              display:'flex', alignItems:'center', gap:9, padding:'7px 10px', borderRadius:10,
              border:'1px solid var(--border-light)', background:'var(--bg-subtle)', cursor:'grab',
              opacity: dragId === t.id ? 0.45 : 1,
              boxShadow: overId === t.id && dragId && dragId !== t.id ? 'inset 0 2px 0 0 #B97434' : 'none',
            }}>
            <span style={{ fontSize:11, color:'var(--text-muted)', width:18, textAlign:'right', flexShrink:0 }}>{i+1}.</span>
            <Icon name={t.icon} size={15} color="var(--text-muted)" />
            <span style={{ flex:1, minWidth:0, fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>{t.label}</span>
            <button onClick={() => { if (i > 0) onOrder(reorderIds(ids, t.id, ids[i-1])); }} disabled={i === 0} style={nudgeBtn(i === 0)} aria-label={`Move ${t.label} up`}>
              <Icon name="arrowLeft" size={12} color="var(--text-primary)" style={{ transform:'rotate(90deg)' }} />
            </button>
            <button onClick={() => { if (i < tabs.length - 1) onOrder(reorderIds(ids, t.id, ids[i+1])); }} disabled={i === tabs.length - 1} style={nudgeBtn(i === tabs.length - 1)} aria-label={`Move ${t.label} down`}>
              <Icon name="arrowLeft" size={12} color="var(--text-primary)" style={{ transform:'rotate(-90deg)' }} />
            </button>
          </div>
        ))}
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

export default function AdminDashboard() {
  const { state, set, dispatch, showToast, closeModals, logActivity, acting, canViewTab, canEditTab } = useStore();
  const { aTab, events, vendors, apps, payments, refunds, deposits, offenses, offenseTypes, docTypes, compOverrides, eventPhotos, photoDownloads, payDocDownloads, parking, passApps, cats, content, settings, activity, filterEvent, page, PER_PAGE, compTab, actTab, parkOverride, newOffType, admins, currentAdminId, appsTab, darkMode, catFilter, profileRequests } = state;
  const isSuperActing = !acting || acting.role === 'super';
  const visibleTabs = orderTabs(ADMIN_TABS.filter(t => !t.hidden && (t.superOnly ? isSuperActing : canViewTab(t.id))), state.aTabOrder);
  const [newAdmin, setNewAdmin] = useState({ id:'', name:'', email:'', password:'' });
  const [newDocType, setNewDocType] = useState({ label:'', required:false });
  const [expandedAdmin, setExpandedAdmin] = useState(null); // admin id whose permission matrix (or transfer panel) is open
  const [resettingAdminId, setResettingAdminId] = useState(null); // admin whose "reset password" inline form is open
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferConfirm, setTransferConfirm] = useState('');
  const [acctName, setAcctName] = useState(acting?.name || '');
  const [acctStaffId, setAcctStaffId] = useState(acting?.staffId || '');
  const [acctPw, setAcctPw] = useState({ current:'', next:'', confirm:'' });
  // The Category editor is a bespoke inline modal (not the shared `Sheet`
  // wrapper), so it needs its own dialog accessibility wiring — same hook,
  // called unconditionally here (gated by `active`) since this whole
  // component is one giant function and hooks can't be called conditionally
  // deep inside the JSX where the modal actually renders.
  const closeCatEditor = () => set({ catEditId:null, cf:null });
  const catDialogRef = useModalA11y(closeCatEditor, !!state.catEditId);
  const [acctPwMsg, setAcctPwMsg] = useState(null);
  const [compVendorOpen, setCompVendorOpen] = useState(null); // vendor id whose offence checklist is expanded in Log Offences
  const [compTypeSel, setCompTypeSel] = useState([]); // offence types checked in that open checklist
  const [staffIdDraft, setStaffIdDraft] = useState({}); // adminId -> draft value, for the Admin Roles panel's Staff ID field

  // Keep the Account tab's name/Staff ID drafts in sync when a different admin signs in
  useEffect(() => { setAcctName(acting?.name || ''); setAcctStaffId(acting?.staffId || ''); }, [acting?.id]);

  // If the signed-in admin can't view the current tab, land on their first visible tab
  useEffect(() => {
    const cur = ADMIN_TABS.find(t => t.id === aTab);
    const allowed = cur && (cur.hidden || (cur.superOnly ? isSuperActing : canViewTab(aTab)));
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
  const [eventSearch, setEventSearch] = useState('');

  // ── Dashboard tab (rule: renamed from Overview, 2026-07) ──
  const todayYear = new Date().getFullYear();
  const [dashMarket, setDashMarket] = useState('all');                 // Booth Bookings donut filter
  const [dashRevFrom, setDashRevFrom] = useState(`${todayYear}-01-01`); // Vendor Revenue date range
  const [dashRevUntil, setDashRevUntil] = useState(`${todayYear}-12-31`);
  const [dashAppSearch, setDashAppSearch] = useState('');              // Recent Applications search
  const [dashAppPeriod, setDashAppPeriod] = useState('all');           // 'week' | 'month' | 'all'
  const now = new Date();
  const [dashCalMonth, setDashCalMonth] = useState(now.getMonth());
  const [dashCalYear, setDashCalYear] = useState(now.getFullYear());
  const [eventSearchOpen, setEventSearchOpen] = useState(false);
  useEffect(() => { setEventSearch(''); setEventSearchOpen(false); }, [aTab]);
  const [rejectingPersonId, setRejectingPersonId] = useState(null); // pass-holder id currently showing the reject-reason picker
  const [rejectReasonKey, setRejectReasonKey] = useState('');
  const [rejectReasonOther, setRejectReasonOther] = useState('');
  const [addingPassFor, setAddingPassFor] = useState(null); // passApp id currently showing the "grant extra passes" control
  const [addPassCount, setAddPassCount] = useState(1);
  const [passReportBusy, setPassReportBusy] = useState(false);
  const [eventStep, setEventStep] = useState(0); // Create Event wizard step (0=Picture,1=Details,2=Schedule,3=Pricing) — presentational only
  const eventRailRef = useRef(null); // Existing-events horizontal rail scroll container
  useEffect(() => { setEventStep(0); }, [aTab]);

  // The Admin Roles tab needs the REAL, complete admin list — not just
  // whoever has happened to log in during this browser session (UPSERT_ADMIN
  // only ever adds the acting admin's own row). Only a super admin's session
  // can actually read every profile (RLS), so this only fires for one.
  useEffect(() => {
    if (!isSupabaseConfigured || !isSuperActing || !acting) return;
    fetchAllAdminProfiles()
      .then(list => dispatch({ type: 'MERGE_ADMINS_FROM_SERVER', payload: list }))
      .catch(e => console.error('Failed to load admin list:', e));
  }, [isSuperActing, acting?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The real vendor roster (Vendor Applications/Listing tabs need to see
  // actual registrations, not just the seeded demo vendors). Any confirmed
  // admin session can read every vendor row (RLS: is_admin()), not just super
  // — vendor visibility isn't a super-only concern the way admin management is.
  // Re-runs on every tab switch (not just once at login) — otherwise a vendor
  // applying/paying while the admin's session stays open never shows up until
  // they log out and back in, which is exactly the friction this refetch avoids.
  useEffect(() => {
    if (!isSupabaseConfigured || !acting) return;
    fetchAllVendors()
      .then(list => dispatch({ type: 'MERGE_VENDORS_FROM_SERVER', payload: list }))
      .catch(e => console.error('Failed to load vendor list:', e));
    // Real event applications, same gating: Event Applications/Payments/
    // Dashboard need actual submissions merged in alongside the demo rows.
    fetchAllApps()
      .then(list => { if (list.length) dispatch({ type: 'MERGE_APPS_FROM_SERVER', payload: list }); })
      .catch(e => console.error('Failed to load applications:', e));
    // Real payment + deposit records. These arrive as keyed objects, so the
    // existing MERGE_PAYMENTS/MERGE_DEPOSITS (object-spread merges) suffice —
    // real keys (UUID-based) can never collide with the seeded demo keys.
    fetchAllPayments()
      .then(map => { if (Object.keys(map).length) dispatch({ type: 'MERGE_PAYMENTS', payload: map }); })
      .catch(e => console.error('Failed to load payments:', e));
    fetchAllDeposits()
      .then(map => { if (Object.keys(map).length) dispatch({ type: 'MERGE_DEPOSITS', payload: map }); })
      .catch(e => console.error('Failed to load deposits:', e));
    // Real vendor-submitted "Vendor details"/E-Invoice-edit change requests.
    fetchAllProfileRequests()
      .then(list => { if (list.length) dispatch({ type: 'MERGE_PROFILE_REQUESTS_FROM_SERVER', payload: list }); })
      .catch(e => console.error('Failed to load profile requests:', e));
    fetchAllRefunds()
      .then(map => { if (Object.keys(map).length) dispatch({ type: 'MERGE_REFUNDS', payload: map }); })
      .catch(e => console.error('Failed to load refunds:', e));
    fetchAllActivity()
      .then(list => { if (list.length) dispatch({ type: 'MERGE_ACTIVITY_FROM_SERVER', payload: list }); })
      .catch(e => console.error('Failed to load activity:', e));
    fetchAllOffenses()
      .then(list => { if (list.length) dispatch({ type: 'MERGE_OFFENSES_FROM_SERVER', payload: list }); })
      .catch(e => console.error('Failed to load offenses:', e));
    fetchOffenseTypes()
      .then(types => { if (Object.keys(types).length) dispatch({ type: 'SET', payload: { offenseTypes: { ...offenseTypes, ...types } } }); })
      .catch(e => console.error('Failed to load offense types:', e));
    fetchDocTypes()
      .then(types => { if (types.length) dispatch({ type: 'MERGE_DOC_TYPES', payload: types }); })
      .catch(e => console.error('Failed to load doc types:', e));
    fetchAllParking()
      .then(map => { if (Object.keys(map).length) dispatch({ type: 'MERGE_PARKING', payload: map }); })
      .catch(e => console.error('Failed to load parking:', e));
    fetchAllPassApps()
      .then(list => { if (list.length) dispatch({ type: 'MERGE_PASS_APPS_FROM_SERVER', payload: list }); })
      .catch(e => console.error('Failed to load vendor passes:', e));
  }, [acting?.id, aTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const vById = id => vendors.find(v=>v.id===id)||{};
  const eById = id => events.find(e=>e.id===id)||{};

  // Shared by every status-changing vendor action (approve/reject/reconsider/
  // suspend/reinstate). Real vendors (identified by userId — only present on
  // rows that came from Supabase, never on the seeded demo vendors) write
  // to the database FIRST and only update local state on success; demo
  // vendors keep the old local-only behavior unchanged. `then` runs after
  // either path succeeds (the activity-log + toast call, which differs
  // slightly per call site).
  const setVendorStatus = async (v, status, then) => {
    if (isSupabaseConfigured && v.userId) {
      try { await updateVendorStatus(v.id, status); }
      catch (e) { showToast("Couldn't save — " + e.message, 'lock'); return; }
    }
    dispatch({ type:'MERGE_VENDORS', payload: vendors.map(x=>x.id===v.id?{...x,status}:x) });
    then?.();
  };
  // Event-application counterparts of setVendorStatus — same write-then-
  // reflect contract. Real applications carry `remote` (set by rowToApp, only
  // on rows that round-tripped through Supabase); demo rows stay local-only.
  const setAppStatus = async (a, status, then) => {
    if (isSupabaseConfigured && a.remote) {
      try { await updateAppStatus(a.id, status); }
      catch (e) { showToast("Couldn't save — " + e.message, 'lock'); return; }
    }
    dispatch({ type:'MERGE_APPS', payload: apps.map(x=>x.id===a.id?{...x,status}:x) });
    then?.();
  };
  const removeApp = async (a, then) => {
    if (isSupabaseConfigured && a.remote) {
      try { await deleteApp(a.id); }
      catch (e) { showToast("Couldn't remove — " + e.message, 'lock'); return; }
    }
    dispatch({ type:'MERGE_APPS', payload: apps.filter(x=>x.id!==a.id) });
    then?.();
  };
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

  const logout = () => {
    if (isSupabaseConfigured) supabase.auth.signOut();
    set({ aScreen:'login', currentAdminId:null });
    showToast('Signed out','leaf');
  };
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeTabLabel = ADMIN_TABS.find(t => t.id === aTab)?.label || 'Menu';

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
  const catFilteredVendors = vendors.filter(v => catFilter === 'all' || v.category === catFilter);
  const searchedCatVendors = searchVendors(catFilteredVendors);
  const pagedCatVendors = searchedCatVendors.slice((page-1)*PER_PAGE, page*PER_PAGE);

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
    const unmatched = new Set(); const matched = new Set();
    for (const f of files) {
      const parts = (f.webkitRelativePath || f.name).split('/');
      const folder = parts.length >= 2 ? parts[parts.length-2] : '';
      const vid = nameMap[folder.toLowerCase().trim()];
      if (!vid) { unmatched.add(folder || f.name); continue; }
      if (matched.has(vid)) continue; // one document per vendor — first file wins
      const targetVendor = vById(vid);
      let doc;
      if (isSupabaseConfigured && targetVendor.userId && curEv?.remote) {
        try { doc = await uploadPrivateFile('payment-files', targetVendor.userId, f); }
        catch { continue; } // skip this vendor on upload failure — not counted as matched
      } else {
        doc = await fileToPhoto(f);
      }
      const key = `${vid}-${filterEvent}`;
      // Persisted (and counted) one vendor at a time — a real pair that the
      // server rejects shows its toast and simply isn't counted as matched.
      const ok = await savePaymentRecord(key, { ...payRec(key), [field]: doc }, { vendors, events, dispatch, showToast });
      if (ok) matched.add(vid);
    }
    if (matched.size) {
      logActivity('Admin', `bulk uploaded ${label.toLowerCase()}s for ${matched.size} vendor(s) — ${curEv.name}.`, {icon:'file', tint:'var(--tint-green-bg)'});
    }
    setPayUpMsg({ label, count:matched.size, unmatched:[...unmatched] });
    showToast(matched.size ? `${label}s attached to ${matched.size} vendor(s)` : 'No folders matched vendor names', matched.size ? 'check' : 'info');
  };

  return (
    <div>
      <PortalHeader title={activeTabLabel} eyebrow={aTab === 'overview' ? 'At a glance' : undefined} />

      {/* Mobile nav trigger — opens the tab drawer instead of a wrapping pill row */}
      <button className="admin-tabs-bar" onClick={() => setDrawerOpen(true)} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'13px 16px', background:'var(--bg-card)', border:'none', borderBottom:'1px solid var(--border-faint)', cursor:'pointer', textAlign:'left' }}>
        <Icon name="menu" size={18} color="#9A5B26" />
        <span style={{ fontFamily:"'Karla'", fontSize:14, fontWeight:700, color:'var(--text-primary)', flex:1 }}>{activeTabLabel}</span>
        <Icon name="arrowLeft" size={15} color="var(--text-muted)" style={{ transform:'rotate(180deg)' }} />
      </button>
      <MobileNavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Admin Console"
        subtitle={acting ? `${acting.name}${isSuperActing ? ' · Super admin' : ''}` : undefined}
        tabs={visibleTabs}
        activeId={aTab}
        onSelect={id => { closeModals(); set({ aTab:id, page:1 }); }}
        dark
        showThemeToggle
        darkMode={darkMode}
        onToggleDark={() => set({ darkMode: !darkMode })}
        onLogout={logout}
      />

      {/* View-only notice for restricted admins */}
      {acting && !isSuperActing && canViewTab(aTab) && !canEditTab(aTab) && (
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--tint-amber-bg-soft)', borderBottom:'1px solid var(--tint-amber-border-soft)', padding:'9px 18px', fontSize:12, color:'var(--tint-amber-text-soft)', fontWeight:500 }}>
          <Icon name="eye" size={14} color="var(--tint-amber-text-soft)"/>View-only access — you can browse this tab but changes are disabled.
        </div>
      )}

      {/* Keyed per tab so switching remounts the wrapper and replays the tabIn animation */}
      <div key={aTab} className="tab-panel">

      {/* ── Overview ── */}
      {aTab === 'overview' && (() => {
        const vById = id => vendors.find(v => v.id === id) || {};
        const evById = id => events.find(e => e.id === id) || {};
        const glassCard = { background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:24, padding:22, boxSizing:'border-box', boxShadow:'0 20px 50px rgba(58,34,16,0.12)' };
        const pillSelect = { padding:'8px 14px', borderRadius:999, border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', fontSize:12.5, fontWeight:700, color:'var(--text-secondary)', cursor:'pointer', fontFamily:"'Karla',sans-serif" };

        // ── Stat cards ──
        const statCards = [
          { icon:'calendar', value:events.length, label:'Number of Markets' },
          { icon:'users',    value:vendors.length, label:'Total Vendors' },
          { icon:'check',    value:apps.filter(a=>a.status==='approved').length, label:'Booths Confirmed' },
        ];

        // ── Booth Bookings donut (Confirmed / Shortlisted / Pending, by market) ──
        const marketOptions = [{ id:'all', name:'All Markets' }, ...events.map(e=>({ id:e.id, name:e.name }))];
        const boothApps = dashMarket === 'all' ? apps : apps.filter(a => a.eventId === dashMarket);
        const confirmedN = boothApps.filter(a=>a.status==='approved').length;
        const shortlistedN = boothApps.filter(a=>a.status==='shortlisted').length;
        const pendingN = boothApps.filter(a=>a.status==='pending').length;
        const boothTotal = confirmedN + shortlistedN + pendingN;
        const pct = n => boothTotal ? Math.round((n / boothTotal) * 100) : 0;
        const confPct = pct(confirmedN), shortPct = pct(shortlistedN), pendPct = pct(pendingN);

        // ── Vendor Revenue (X = market, Y = revenue collected), From/To date filter ──
        const revFromD = parseDateOnly(dashRevFrom), revUntilD = parseDateOnly(dashRevUntil);
        const revByMarket = events
          .filter(ev => ev.startDate && parseDateOnly(ev.startDate) >= revFromD && parseDateOnly(ev.startDate) <= revUntilD)
          .map(ev => ({
            id: ev.id, name: ev.name,
            total: apps.filter(a => a.eventId === ev.id && a.status === 'approved')
              .reduce((sum,a) => sum + (payments[`${a.vendorId}-${ev.id}`]?.paid || 0), 0),
          }));
        const totalRevenue = revByMarket.reduce((s,m) => s + m.total, 0);
        const maxRev = Math.max(1, ...revByMarket.map(m => m.total));

        // ── Popular Categories (share of approved vendors) ──
        const approvedVendors = vendors.filter(v => v.status === 'approved');
        const catCounts = {};
        approvedVendors.forEach(v => { catCounts[v.category] = (catCounts[v.category] || 0) + 1; });
        const catGradients = ['linear-gradient(90deg,#B97434,#7A431A)', 'linear-gradient(90deg,#3A2210,#5C3A1E)', 'linear-gradient(90deg,#5FAF97,#2F6E5B)', 'linear-gradient(90deg,#6B4F8C,#4A3564)'];
        const popularCats = Object.entries(catCounts).sort((a,b) => b[1]-a[1]).slice(0,4)
          .map(([name,count], i) => ({ name, count, pct: approvedVendors.length ? Math.round((count/approvedVendors.length)*100) : 0, color: catGradients[i % catGradients.length] }));

        // ── Events snapshot: recently concluded, ongoing (or nearest upcoming),
        // and the next upcoming after that — a dashboard highlight, not a full
        // listing (that's what "View All Events" is for). Events with no
        // startDate/endDate ("Dates TBC") have nothing to rank by, so they're
        // left out of this snapshot entirely.
        const withStatus = events.map(ev => ({ ...ev, _status: eventStatus(ev).key }));
        const concludedEvents = withStatus.filter(ev => ev._status === 'concluded').sort((a,b) => parseDateOnly(b.endDate) - parseDateOnly(a.endDate));
        const ongoingEvents = withStatus.filter(ev => ev._status === 'ongoing').sort((a,b) => parseDateOnly(a.endDate) - parseDateOnly(b.endDate));
        const upcomingEvents = withStatus.filter(ev => ev._status === 'upcoming').sort((a,b) => parseDateOnly(a.startDate) - parseDateOnly(b.startDate));
        const recentlyConcluded = concludedEvents[0] || null;
        const currentOrNearest = ongoingEvents[0] || upcomingEvents[0] || null;
        const anotherUpcoming = upcomingEvents.find(ev => ev.id !== currentOrNearest?.id) || null;
        const snapshotEvents = [recentlyConcluded, currentOrNearest, anotherUpcoming].filter(Boolean);

        // ── Recent Applications (event applications, most recent first) ──
        const periodCutoff = dashAppPeriod === 'week' ? Date.now() - 7*86400000 : dashAppPeriod === 'month' ? Date.now() - 30*86400000 : null;
        const q = dashAppSearch.trim().toLowerCase();
        let recentApps = apps
          .filter(a => !periodCutoff || (a.appliedAt && new Date(a.appliedAt).getTime() >= periodCutoff))
          .filter(a => {
            if (!q) return true;
            const v = vById(a.vendorId), ev = evById(a.eventId);
            return (v.business||'').toLowerCase().includes(q) || (ev.name||'').toLowerCase().includes(q);
          })
          .sort((a,b) => new Date(b.appliedAt||0) - new Date(a.appliedAt||0));
        const recentAppsTotal = recentApps.length;
        recentApps = recentApps.slice(0, 8);

        // ── Upcoming Event (nearest future by start date) ──
        const today0 = new Date(); today0.setHours(0,0,0,0);
        const upcoming = events
          .filter(ev => ev.startDate && parseDateOnly(ev.startDate) >= today0)
          .sort((a,b) => parseDateOnly(a.startDate) - parseDateOnly(b.startDate))[0];

        // ── Calendar (current month grid + agenda from real event/deadline dates) ──
        const firstDay = new Date(dashCalYear, dashCalMonth, 1).getDay();
        const daysInMonth = new Date(dashCalYear, dashCalMonth+1, 0).getDate();
        const daysInPrevMonth = new Date(dashCalYear, dashCalMonth, 0).getDate();
        const eventDaySet = new Set();
        events.forEach(ev => {
          if (!ev.startDate || !ev.endDate) return;
          let d = parseDateOnly(ev.startDate); const end = parseDateOnly(ev.endDate);
          while (d <= end) {
            if (d.getFullYear()===dashCalYear && d.getMonth()===dashCalMonth) eventDaySet.add(d.getDate());
            d = new Date(d.getFullYear(), d.getMonth(), d.getDate()+1);
          }
        });
        const calCells = [];
        for (let i=0;i<firstDay;i++) calCells.push({ label:daysInPrevMonth-firstDay+i+1, muted:true, hasDot:false, isToday:false });
        for (let d=1; d<=daysInMonth; d++) calCells.push({ label:d, muted:false, hasDot:eventDaySet.has(d), isToday: d===now.getDate() && dashCalMonth===now.getMonth() && dashCalYear===now.getFullYear() });
        let nextD=1; while (calCells.length % 7 !== 0) calCells.push({ label:nextD++, muted:true, hasDot:false, isToday:false });
        const agendaItems = [];
        events.forEach(ev => {
          if (ev.startDate) {
            const d = parseDateOnly(ev.startDate);
            if (d.getFullYear()===dashCalYear && d.getMonth()===dashCalMonth) agendaItems.push({ day:d.getDate(), title:ev.name, subtitle:ev.location, time:`${fmtTime(ev.startTime)} - ${fmtTime(ev.endTime)}`, badge:'event' });
          }
          if (ev.lastApp) {
            const d = parseDateOnly(ev.lastApp);
            if (d.getFullYear()===dashCalYear && d.getMonth()===dashCalMonth) agendaItems.push({ day:d.getDate(), title:'Application deadline', subtitle:ev.name, time:'', badge:'deadline' });
          }
        });
        agendaItems.sort((a,b) => a.day-b.day);
        const monthLabel = new Date(dashCalYear, dashCalMonth, 1).toLocaleDateString('en-US', { month:'long', year:'numeric' });

        return (
        <div style={{ position:'relative', padding:'20px 20px 32px', display:'flex', flexWrap:'wrap', alignItems:'flex-start', gap:24 }}>

          {/* MAIN COLUMN */}
          <div style={{ flex:'1 1 700px', minWidth:0, display:'flex', flexDirection:'column', gap:20 }}>

            {/* Stat cards */}
            <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              {statCards.map(c => (
                <div key={c.label} style={{ flex:'1 1 200px', display:'flex', alignItems:'center', gap:14, ...glassCard, padding:18 }}>
                  <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--accent-gradient)', display:'flex', alignItems:'center', justifyContent:'center', color:'#FFF8EE', flexShrink:0 }}>
                    <Icon name={c.icon} size={19} color="#FFF8EE"/>
                  </div>
                  <div>
                    <div style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:3 }}>{c.label}</div>
                    <div style={{ fontFamily:"'Marcellus',serif", fontSize:24, color:'var(--text-primary)' }}>{c.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Booth Bookings + Vendor Revenue/Categories */}
            <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'stretch' }}>
              <div style={{ flex:'1 1 280px', minWidth:260, ...glassCard, display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, gap:10, flexWrap:'wrap' }}>
                  <div style={{ fontFamily:"'Marcellus',serif", fontSize:17, color:'var(--text-primary)' }}>Booth Bookings</div>
                  <select value={dashMarket} onChange={e=>setDashMarket(e.target.value)} style={pillSelect}>
                    {marketOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div style={{ position:'relative', width:170, height:170, margin:'4px auto 18px', borderRadius:'50%', background:`conic-gradient(#B97434 0% ${confPct}%, #3A2210 ${confPct}% ${confPct+shortPct}%, rgba(154,91,38,0.3) ${confPct+shortPct}% 100%)` }}>
                  <div style={{ position:'absolute', inset:20, borderRadius:'50%', background:'var(--donut-hole)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                    <div style={{ fontSize:11.5, color:'var(--text-muted)', marginBottom:3 }}>Total Applicants</div>
                    <div style={{ fontFamily:"'Marcellus',serif", fontSize:22, color:'var(--text-primary)' }}>{boothTotal}</div>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {[['Confirmed', confirmedN, confPct, '#B97434'], ['Shortlisted', shortlistedN, shortPct, 'var(--text-primary)'], ['Pending', pendingN, pendPct, 'rgba(154,91,38,0.5)']].map(([label,val,p,color]) => (
                    <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:4, height:26, borderRadius:3, background:color }}/>
                        <div>
                          <div style={{ fontSize:12, color:'var(--text-muted)' }}>{label}</div>
                          <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>{val}</div>
                        </div>
                      </div>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', background:'var(--glass-divider)', padding:'4px 10px', borderRadius:999 }}>{p}%</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ flex:'1 1 380px', minWidth:300, display:'flex', flexDirection:'column', gap:16 }}>
                <div style={glassCard}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4, gap:10, flexWrap:'wrap' }}>
                    <div style={{ fontFamily:"'Marcellus',serif", fontSize:17, color:'var(--text-primary)' }}>Vendor Revenue</div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                      <input type="date" value={dashRevFrom} onChange={e=>setDashRevFrom(e.target.value)} style={{ ...pillSelect, fontWeight:600 }}/>
                      <span style={{ fontSize:12, color:'var(--text-muted)' }}>to</span>
                      <input type="date" value={dashRevUntil} onChange={e=>setDashRevUntil(e.target.value)} style={{ ...pillSelect, fontWeight:600 }}/>
                    </div>
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:2 }}>Total Revenue</div>
                  <div style={{ fontFamily:"'Marcellus',serif", fontSize:22, color:'var(--text-primary)', marginBottom:14 }}>RM {money(totalRevenue)}</div>
                  {revByMarket.length === 0 ? (
                    <div style={{ fontSize:12.5, color:'var(--text-muted)', padding:'14px 0' }}>No markets in this date range.</div>
                  ) : (
                    <div style={{ display:'flex', alignItems:'flex-end', gap:16, height:150, borderTop:'1px solid var(--glass-divider)', paddingTop:10 }}>
                      {revByMarket.map(m => (
                        <div key={m.id} style={{ flex:'1 1 0', minWidth:0, display:'flex', flexDirection:'column', alignItems:'center', gap:8, height:'100%', justifyContent:'flex-end' }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'var(--text-primary)' }}>RM {fmt(m.total)}</div>
                          <div style={{ width:28, borderRadius:'6px 6px 0 0', background:'var(--accent-gradient)', height:`${Math.max(4, Math.round((m.total/maxRev)*110))}px` }}/>
                          <div style={{ fontSize:11, color:'var(--text-muted)', textAlign:'center', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:80 }}>{m.name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ ...glassCard, flex:'1 1 auto' }}>
                  <div style={{ fontFamily:"'Marcellus',serif", fontSize:17, color:'var(--text-primary)', marginBottom:16 }}>Popular Categories</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
                    {popularCats.length === 0 ? (
                      <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>No approved vendors yet.</div>
                    ) : popularCats.map(c => (
                      <div key={c.name} style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ width:90, fontSize:12.5, fontWeight:700, color:'var(--text-primary)', flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
                        <div style={{ flex:'1 1 auto', height:26, borderRadius:8, background:'var(--glass-divider)', position:'relative', overflow:'hidden' }}>
                          <div style={{ position:'absolute', inset:0, width:`${c.pct}%`, background:c.color, borderRadius:8, display:'flex', alignItems:'center', paddingLeft:10 }}>
                            <span style={{ fontSize:11, fontWeight:700, color:'#FFF8EE', whiteSpace:'nowrap' }}>{c.pct}%</span>
                          </div>
                        </div>
                        <div style={{ fontSize:12, color:'var(--text-secondary)', whiteSpace:'nowrap', flexShrink:0 }}><b style={{ color:'var(--text-primary)' }}>{c.count}</b> vendors</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Events snapshot — recently concluded / ongoing (or nearest) / next upcoming.
                A highlight, not the full list — "View All Events" opens that. */}
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontFamily:"'Marcellus',serif", fontSize:18, color:'var(--text-primary)' }}>Recent &amp; Upcoming Events</div>
                <button onClick={()=>set({aTab:'events',page:1})} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:700, color:'#7A431A' }}>
                  View All Events<Icon name="arrowLeft" size={12} color="#7A431A" style={{ transform:'rotate(180deg)' }}/>
                </button>
              </div>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                {snapshotEvents.map(ev => {
                  const st = eventStatus(ev);
                  return (
                  <div key={ev.id} className="dc-row-hover" style={{ flex:'1 1 200px', minWidth:180, maxWidth:240, background:'var(--glass-card-solid, var(--bg-card))', border:'1px solid var(--glass-divider)', borderRadius:20, overflow:'hidden', boxShadow:'0 12px 30px rgba(122,67,26,0.1)' }}>
                    <div style={{ position:'relative', width:'100%', aspectRatio:'4/5', background: ev.img || 'var(--accent-gradient)' }}>
                      <div style={{ position:'absolute', top:10, left:10, padding:'4px 11px', borderRadius:999, fontSize:11, fontWeight:700, background:st.bg, color:st.color }}>{st.label}</div>
                    </div>
                    <div style={{ padding:14 }}>
                      <div style={{ fontFamily:"'Marcellus',serif", fontSize:15, color:'var(--text-primary)', marginBottom:5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ev.name}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ev.location}</div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11.5, color:'var(--text-secondary)' }}>
                          <Icon name="calendar" size={12} color="var(--text-muted)"/>{ev.dateRange}
                        </div>
                        <div style={{ fontSize:13, fontWeight:700, color:'#7A431A' }}>From RM {Math.min(ev.fnb, ev.nonfnb)}</div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Applications */}
            <div style={glassCard}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, flexWrap:'wrap', marginBottom:16 }}>
                <div style={{ fontFamily:"'Marcellus',serif", fontSize:18, color:'var(--text-primary)' }}>Recent Applications</div>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 14px', borderRadius:12, border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', minWidth:180 }}>
                    <Icon name="search" size={14} color="#9A5B26"/>
                    <input value={dashAppSearch} onChange={e=>setDashAppSearch(e.target.value)} placeholder="Search vendor, event…" style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color:'var(--text-primary)', width:'100%', fontFamily:"'Karla',sans-serif" }}/>
                  </div>
                  <select value={dashAppPeriod} onChange={e=>setDashAppPeriod(e.target.value)} style={pillSelect}>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="all">All Time</option>
                  </select>
                </div>
              </div>
              <div style={{ overflowX:'auto' }}>
                <div style={{ minWidth:760 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,1.4fr) minmax(0,1.6fr) minmax(0,1.2fr) minmax(0,0.9fr) minmax(0,1fr)', gap:10, padding:'0 10px 12px', fontSize:11, fontWeight:700, letterSpacing:'0.06em', color:'var(--text-muted)', textTransform:'uppercase', borderBottom:'1px solid var(--glass-divider)' }}>
                    <div>App ID</div><div>Date</div><div>Vendor</div><div>Event</div><div>Category</div><div>Amount</div><div>Status</div>
                  </div>
                  {recentApps.length === 0 ? (
                    <div style={{ padding:'24px 10px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No applications match this filter.</div>
                  ) : recentApps.map(a => {
                    const v = vById(a.vendorId), ev = evById(a.eventId);
                    const amt = payments[`${a.vendorId}-${a.eventId}`]?.paid || 0;
                    const st = badge(a.status);
                    return (
                      <div key={a.id} className="dc-row-hover" style={{ display:'grid', gridTemplateColumns:'minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,1.4fr) minmax(0,1.6fr) minmax(0,1.2fr) minmax(0,0.9fr) minmax(0,1fr)', gap:10, alignItems:'center', padding:'12px 10px', borderBottom:'1px solid var(--glass-divider)' }}>
                        <div style={{ fontSize:12.5, fontWeight:700, color:'var(--text-primary)' }}>#{a.id}</div>
                        <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{a.appliedAt ? fmtShort(a.appliedAt) : '—'}</div>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.business}</div>
                        <div style={{ fontSize:12, color:'var(--text-secondary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ev.name}</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.category}</div>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{amt ? `RM ${fmt(amt)}` : '—'}</div>
                        <div><span style={{ display:'inline-block', padding:'4px 11px', borderRadius:999, fontSize:11, fontWeight:700, background:st.bg, color:st.color }}>{st.label}</span></div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ paddingTop:12, fontSize:12, color:'var(--text-muted)' }}>Showing {recentApps.length} of {recentAppsTotal} applications</div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ flex:'1 1 300px', minWidth:280, maxWidth:360, display:'flex', flexDirection:'column', gap:20 }}>

            {/* Upcoming Event */}
            <div>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:18, color:'var(--text-primary)', marginBottom:12 }}>Upcoming Event</div>
              {upcoming ? (
                <div style={{ ...glassCard, padding:0, overflow:'hidden' }}>
                  <div style={{ width:'100%', aspectRatio:'4/5', background: upcoming.img || 'var(--accent-gradient)' }}/>
                  <div style={{ padding:16 }}>
                    <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, color:'var(--text-primary)', marginBottom:5 }}>{upcoming.name}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10 }}>{upcoming.location}</div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:'var(--text-secondary)' }}>
                        <Icon name="calendar" size={13} color="var(--text-muted)"/>
                        <div>
                          <div style={{ fontWeight:700, color:'var(--text-primary)' }}>{upcoming.dateRange}</div>
                          <div>{fmtTime(upcoming.startTime)} - {fmtTime(upcoming.endTime)}</div>
                        </div>
                      </div>
                      <button onClick={()=>set({eventDetailId:upcoming.id})} style={{ padding:'9px 16px', border:'none', borderRadius:999, fontSize:12.5, fontWeight:700, color:'#FFF8EE', background:'var(--accent-gradient)', cursor:'pointer' }}>View Details</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ ...glassCard, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No upcoming markets scheduled.</div>
              )}
            </div>

            {/* Calendar */}
            <div style={glassCard}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontFamily:"'Marcellus',serif", fontSize:15.5, color:'var(--text-primary)' }}>{monthLabel}</div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={()=>{ const m=dashCalMonth-1; if(m<0){setDashCalMonth(11);setDashCalYear(dashCalYear-1);} else setDashCalMonth(m); }} style={{ width:26, height:26, borderRadius:'50%', border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', color:'var(--text-secondary)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                    <Icon name="arrowLeft" size={12} color="currentColor"/>
                  </button>
                  <button onClick={()=>{ const m=dashCalMonth+1; if(m>11){setDashCalMonth(0);setDashCalYear(dashCalYear+1);} else setDashCalMonth(m); }} style={{ width:26, height:26, borderRadius:'50%', border:'none', background:'var(--accent-gradient)', color:'#FFF8EE', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                    <Icon name="arrowLeft" size={12} color="currentColor" style={{ transform:'rotate(180deg)' }}/>
                  </button>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:4 }}>
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(wd => <div key={wd} style={{ textAlign:'center', fontSize:10.5, fontWeight:700, color:'var(--text-muted)', padding:'3px 0' }}>{wd}</div>)}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:16 }}>
                {calCells.map((c,i) => (
                  <div key={i} style={{ position:'relative', textAlign:'center', padding:'6px 0', borderRadius:'50%', fontSize:12, fontWeight: c.isToday?700:500, color: c.isToday?'#FFF8EE':c.muted?'var(--text-muted)':'var(--text-primary)', background: c.isToday?'var(--accent-gradient)':'transparent' }}>
                    {c.label}
                    {c.hasDot && <span style={{ position:'absolute', bottom:1, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:'#B97434' }}/>}
                  </div>
                ))}
              </div>
              <div style={{ height:1, background:'var(--glass-divider)', marginBottom:14 }}/>
              {agendaItems.length === 0 ? (
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>Nothing scheduled this month.</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {agendaItems.map((ag,i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:11 }}>
                      <div style={{ width:40, height:40, borderRadius:12, background: ag.badge==='deadline' ? 'var(--glass-card-border)' : 'var(--accent-gradient)', color: ag.badge==='deadline' ? '#7A431A' : '#FFF8EE', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:14, fontWeight:700 }}>
                        {ag.day}
                      </div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ag.title}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ag.subtitle}{ag.time ? ` · ${ag.time}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activity — reuses the live app-wide activity log */}
            <div style={glassCard}>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:16.5, color:'var(--text-primary)', marginBottom:14 }}>Recent Activity</div>
              {activity.length === 0 ? (
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>No activity yet.</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  {activity.slice(0,6).map((act,i) => (
                    <div key={act.id ?? i} className="dc-row-hover" style={{ display:'flex', alignItems:'flex-start', gap:11, padding:6 }}>
                      <div style={{ width:30, height:30, borderRadius:'50%', background:act.tint, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <Icon name={act.icon} size={13} color="#7A431A"/>
                      </div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:12.5, color:'var(--text-primary)', lineHeight:1.45 }}><b>{act.who}</b> {act.what}</div>
                        <div style={{ fontSize:10.5, color:'var(--text-muted)', marginTop:2 }}>{act.when}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── Vendor Applications (new sign-ups awaiting a decision) ── */}
      {aTab === 'vendors' && (() => {
        const vaGrid = 'minmax(0,2.1fr) minmax(0,1fr) minmax(0,1.7fr) minmax(0,0.9fr) minmax(0,1.6fr)';
        return (
        <TableShell
          title="Vendor Applications" subtitle="New sign-ups awaiting a decision."
          headerAction={
            <button onClick={()=>{
              downloadCsv('vendor-applications.csv',
                ['Business','Owner','Category','Email','Phone','Registered','Status'],
                searchedPending.map(v=>[v.business,v.owner,v.category,v.email,v.phone,v.regDate,v.status]));
              logActivity('Admin', `exported ${searchedPending.length} pending vendor application(s) as CSV.`, {icon:'download', tint:'var(--tint-blue-bg)'});
              showToast(`Exported ${searchedPending.length} application(s) to vendor-applications.csv`,'download');
            }} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 20px', border:'1px solid var(--glass-chip-border)', borderRadius:999, fontSize:13.5, fontWeight:700, color:'var(--text-secondary)', background:'var(--glass-input)', cursor:'pointer', fontFamily:"'Karla',sans-serif" }}>
              <Icon name="download" size={14} color="#6B4E33"/>Export CSV
            </button>
          }
          panelTitle="Pending Applications"
          searchValue={vendorSearch} onSearchChange={setVendorSearch} searchPlaceholder="Search by business or owner name"
          headerCells={<><div>Vendor</div><div>Category</div><div>Contact</div><div>Registered</div><div style={{ textAlign:'right' }}>Actions</div></>}
          gridTemplate={vaGrid} minWidth={860}
          isEmpty={pagedVendors.length===0}
          emptyMessage={searchQ ? `No vendors match "${vendorSearch}".` : 'No new applications right now.'}
          total={searchedPending.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}
        >
          {pagedVendors.map((v,idx) => (
            <div key={v.id} className="dc-row-hover" style={{ display:'grid', gridTemplateColumns:vaGrid, gap:10, alignItems:'center', padding:'13px 14px', borderBottom:'1px solid var(--glass-divider)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                <VendorAvatar v={v} size={36}/>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}><span style={{ fontSize:11, fontWeight:700, color:'#B8A48C', marginRight:6 }}>#{(page-1)*PER_PAGE+idx+1}</span>{v.business}</div>
                  <div style={{ fontSize:11.5, color:'var(--text-muted)' }}>{v.owner}</div>
                </div>
              </div>
              <div style={{ minWidth:0, overflow:'hidden' }}><span style={{ display:'inline-block', maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', padding:'5px 12px', borderRadius:999, fontSize:11.5, fontWeight:700, background:'var(--glass-divider)', color:'#9A5B26', whiteSpace:'nowrap' }}>{v.category}</span></div>
              <div style={{ fontSize:12, color:'var(--text-secondary)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}><Icon name="mail" size={12} color="#B8A48C"/>{v.email}</div>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:2 }}><Icon name="phone" size={12} color="#B8A48C"/>{v.phone}</div>
              </div>
              <div style={{ fontSize:12.5, color:'var(--text-secondary)' }}>{v.regDate}</div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6, flexWrap:'wrap' }}>
                <IconBtn title="View details" onClick={()=>set({vendorDetailId:v.id, vendorDetailReturnAppId:null})}><Icon name="eye" size={14} color="#6B4E33"/></IconBtn>
                <button onClick={()=>setVendorStatus(v,'approved',()=>{ logActivity('Admin', `approved ${v.business} as a vendor.`, {icon:'check', tint:'var(--tint-pink-bg)'}); showToast('Vendor approved'+(settings.emailAlerts?' · vendor emailed':''),'check'); })} style={{ background:'rgba(90,145,110,0.16)', border:'none', color:'#3F7A54', fontSize:12, fontWeight:700, borderRadius:9, padding:'8px 12px', cursor:'pointer' }}>Approve</button>
                <button onClick={()=>setVendorStatus(v,'rejected',()=>{ logActivity('Admin', `rejected ${v.business}'s vendor application.`, {icon:'x', tint:'var(--tint-red-bg)'}); showToast('Vendor rejected'+(settings.emailAlerts?' · vendor emailed':''),'x'); })} style={{ background:'rgba(196,74,74,0.1)', border:'none', color:'#B03A2E', fontSize:12, fontWeight:700, borderRadius:9, padding:'8px 12px', cursor:'pointer' }}>Reject</button>
              </div>
            </div>
          ))}
          {searchedRejected.length > 0 && (
            <div style={{ marginTop:18 }}>
              <button onClick={()=>setShowRejected(s=>!s)} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:12.5, fontWeight:700, padding:0, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                <Icon name={showRejected?'x':'eye'} size={13} color="#8A6A4A"/>
                {showRejected ? 'Hide' : 'Show'} {searchedRejected.length} rejected application{searchedRejected.length>1?'s':''}
              </button>
              {showRejected && (
                <MiniTablePanel gridTemplate="minmax(0,2.1fr) minmax(0,1fr) minmax(0,0.9fr) minmax(0,1.6fr)" minWidth={620}
                  headerCells={<><div>Vendor</div><div>Category</div><div>Registered</div><div style={{ textAlign:'right' }}>Action</div></>}>
                  {searchedRejected.map(v => (
                    <div key={v.id} className="dc-row-hover" style={{ display:'grid', gridTemplateColumns:'minmax(0,2.1fr) minmax(0,1fr) minmax(0,0.9fr) minmax(0,1.6fr)', gap:10, alignItems:'center', padding:'12px', borderBottom:'1px solid var(--glass-divider)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                        <VendorAvatar v={v} size={32}/>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.business}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>{v.owner}</div>
                        </div>
                      </div>
                      <div style={{ minWidth:0, overflow:'hidden' }}><span style={{ display:'inline-block', maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', padding:'4px 10px', borderRadius:999, fontSize:11, fontWeight:700, background:'var(--glass-divider)', color:'#9A5B26', whiteSpace:'nowrap' }}>{v.category}</span></div>
                      <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{v.regDate}</div>
                      <div style={{ display:'flex', justifyContent:'flex-end' }}>
                        <button onClick={()=>setVendorStatus(v,'pending',()=>{ logActivity('Admin', `moved ${v.business}'s application back to pending review.`, {icon:'info', tint:'var(--tint-amber-bg)'}); showToast(`${v.business} moved back to pending review`,'info'); })} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--glass-input)', border:'1px solid var(--glass-chip-border)', color:'var(--text-secondary)', fontSize:11.5, fontWeight:700, borderRadius:9, padding:'7px 11px', cursor:'pointer' }}>
                          <Icon name="pencil" size={12} color="#6B4E33"/>Reconsider
                        </button>
                      </div>
                    </div>
                  ))}
                </MiniTablePanel>
              )}
            </div>
          )}
        </TableShell>
        );
      })()}

      {/* ── Vendor Listing (master list of approved/suspended vendors) ── */}
      {aTab === 'vendorList' && (() => {
        const vlGrid = 'minmax(0,2fr) minmax(0,0.9fr) minmax(0,1.5fr) minmax(0,1.7fr) minmax(0,1.7fr)';
        return (
        <TableShell
          title="Vendor Listing" subtitle="Master list of decided vendors, eligible to apply for events."
          headerAction={
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <button
                onClick={async ()=>{
                  const list = searchedApprovedList.length ? searchedApprovedList : approvedVendors;
                  showToast(`Preparing ${list.length} sign-up forms…`,'download');
                  await downloadSignupFormsZip(list, content.terms);
                  logActivity('Admin', `bulk-downloaded ${list.length} vendor sign-up forms.`, {icon:'download', tint:'var(--tint-pink-bg)'});
                }}
                style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 18px', border:'1px solid var(--glass-chip-border)', borderRadius:999, fontSize:13, fontWeight:700, color:'var(--text-secondary)', background:'var(--glass-input)', cursor:'pointer', fontFamily:"'Karla',sans-serif" }}>
                <Icon name="file" size={14} color="#6B4E33"/>Download all forms
              </button>
              <button onClick={()=>{
                downloadCsv('vendor-listing.csv',
                  ['Business','Owner','Category','Email','Phone','Registered','Status','Offences'],
                  searchedApprovedList.map(v=>[v.business,v.owner,v.category,v.email,v.phone,v.regDate,v.status,offenses.filter(o=>o.vendorId===v.id).length]));
                logActivity('Admin', `exported ${searchedApprovedList.length} vendor(s) from the Vendor Listing as CSV.`, {icon:'download', tint:'var(--tint-blue-bg)'});
                showToast(`Exported ${searchedApprovedList.length} vendor(s) to vendor-listing.csv`,'download');
              }} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 20px', border:'1px solid var(--glass-chip-border)', borderRadius:999, fontSize:13.5, fontWeight:700, color:'var(--text-secondary)', background:'var(--glass-input)', cursor:'pointer', fontFamily:"'Karla',sans-serif" }}>
                <Icon name="download" size={14} color="#6B4E33"/>Export CSV
              </button>
            </div>
          }
          panelTitle={`${approvedVendors.filter(v=>v.status==='approved').length} Approved Vendors`}
          searchValue={vendorSearch} onSearchChange={setVendorSearch} searchPlaceholder="Search by business or owner name"
          headerCells={<><div>Vendor</div><div>Category</div><div>Contact</div><div>Compliance</div><div style={{ textAlign:'right' }}>Actions</div></>}
          gridTemplate={vlGrid} minWidth={900}
          isEmpty={pagedVendorList.length===0}
          emptyMessage={searchQ ? `No vendors match "${vendorSearch}".` : 'No approved vendors yet.'}
          total={searchedApprovedList.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}
        >
          {pagedVendorList.map((v,idx) => {
            const vOff = offenses.filter(o=>o.vendorId===v.id);
            const typeCounts = {};
            vOff.forEach(o=>{ typeCounts[o.type]=(typeCounts[o.type]||0)+1; });
            return (
              <div key={v.id} className="dc-row-hover" style={{ display:'grid', gridTemplateColumns:vlGrid, gap:10, alignItems:'center', padding:'13px 14px', borderBottom:'1px solid var(--glass-divider)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                  <VendorAvatar v={v} size={36}/>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}><span style={{ fontSize:11, fontWeight:700, color:'#B8A48C', marginRight:6 }}>#{(page-1)*PER_PAGE+idx+1}</span>{v.business}</div>
                    <div style={{ fontSize:11.5, color:'var(--text-muted)' }}>{v.owner} · Reg. {v.regDate}</div>
                  </div>
                </div>
                <div style={{ minWidth:0, overflow:'hidden' }}><span style={{ display:'inline-block', maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', padding:'5px 12px', borderRadius:999, fontSize:11.5, fontWeight:700, background:'var(--glass-divider)', color:'#9A5B26', whiteSpace:'nowrap' }}>{v.category}</span></div>
                <div style={{ fontSize:12, color:'var(--text-secondary)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}><Icon name="mail" size={12} color="#B8A48C"/>{v.email}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:2 }}><Icon name="phone" size={12} color="#B8A48C"/>{v.phone}</div>
                </div>
                <div>
                  {vOff.length === 0 ? (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, borderRadius:999, padding:'4px 10px', background:'rgba(90,145,110,0.14)', color:'#3F7A54' }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:'#3F7A54' }}/>Clean record
                    </span>
                  ) : (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      {Object.entries(typeCounts).map(([type,count]) => {
                        const ot = offenseTypes[type]||{};
                        return <span key={type} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:10.5, fontWeight:700, borderRadius:999, padding:'3px 9px', background:ot.bg, color:ot.color }}><span style={{ width:5, height:5, borderRadius:'50%', background:ot.color }}/>{ot.label} ×{count}</span>;
                      })}
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6, flexWrap:'wrap' }}>
                  <IconBtn title="View details" onClick={()=>set({vendorDetailId:v.id, vendorDetailReturnAppId:null})}><Icon name="eye" size={14} color="#6B4E33"/></IconBtn>
                  <IconBtn title="Download sign-up form" onClick={async ()=>{
                    await downloadSignupForm(v, content.terms);
                    showToast(`Downloaded ${v.business}'s sign-up form`,'download');
                    logActivity('Admin', `downloaded ${v.business}'s sign-up form.`, {icon:'download', tint:'var(--tint-pink-bg)'});
                  }}><Icon name="file" size={14} color="#6B4E33"/></IconBtn>
                </div>
              </div>
            );
          })}
        </TableShell>
        );
      })()}

      {/* ── Profile Requests (vendor-submitted changes to locked profile fields) ── */}
      {aTab === 'profileReq' && (() => {
        const pending = profileRequests.filter(r=>r.status==='pending');
        const decided = profileRequests.filter(r=>r.status!=='pending').sort((a,b)=>b.id.localeCompare(a.id));
        // A real request (submitted by a Supabase-backed vendor — see
        // rowToRequest's `remote` marker) writes the decision to Supabase
        // first, local state only updates on success; a demo request keeps
        // the old local-only behavior unchanged.
        const decide = async (req, decision) => {
          const v = vendors.find(x=>x.id===req.vendorId);
          if (isSupabaseConfigured && req.remote) {
            try {
              if (decision === 'approved') {
                if (req.section === 'einvoice') await updateVendorEinvoice(req.vendorId, req.changes);
                else await updateVendorDetails(req.vendorId, req.changes);
              }
              await updateProfileRequestStatus(req.id, decision);
            } catch (e) { showToast("Couldn't save — " + e.message, 'lock'); return; }
          }
          if (decision === 'approved') {
            const patch = req.section === 'einvoice' ? { einvoice: req.changes } : req.changes;
            dispatch({ type:'MERGE_VENDORS', payload: vendors.map(x=>x.id===req.vendorId?{...x,...patch}:x) });
          }
          dispatch({ type:'MERGE_PROFILE_REQUESTS', payload: profileRequests.map(r=>r.id===req.id?{...r,status:decision}:r) });
          logActivity('Admin', `${decision==='approved'?'approved':'rejected'} ${v?.business||'a vendor'}'s ${req.section==='einvoice'?'E-Invoice':'profile'} change request.`, {icon: decision==='approved'?'check':'x', tint: decision==='approved'?'var(--tint-pink-bg)':'var(--tint-red-bg)'});
          showToast(`Request ${decision}`, decision==='approved'?'check':'x');
        };
        const prGrid = 'minmax(0,2fr) minmax(0,1.4fr) minmax(0,1fr) minmax(0,1.8fr)';
        return (
          <TableShell
            title="Profile Requests" subtitle="Vendor-submitted changes to locked profile fields."
            panelTitle={`${pending.length} Pending Request${pending.length!==1?'s':''}`}
            headerCells={<><div>Vendor</div><div>Section</div><div>Submitted</div><div style={{ textAlign:'right' }}>Actions</div></>}
            gridTemplate={prGrid} minWidth={720}
            isEmpty={pending.length===0}
            emptyMessage="No pending profile change requests."
            total={pending.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}
          >
            {pending.map(req => {
              const v = vendors.find(x=>x.id===req.vendorId)||{};
              const fields = req.section==='einvoice' ? EINVOICE_FIELDS : DETAILS_FIELDS;
              const changedFields = fields.filter(([k]) => {
                const newVal = req.changes[k];
                const oldVal = req.section==='einvoice' ? (v.einvoice&&v.einvoice[k]) : v[k];
                return (oldVal||'') !== (newVal||'');
              });
              return (
                <div key={req.id} className="dc-row-hover" style={{ borderBottom:'1px solid var(--glass-divider)' }}>
                  <div style={{ display:'grid', gridTemplateColumns:prGrid, gap:10, alignItems:'center', padding:'13px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                      <VendorAvatar v={v} size={34}/>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.business}</div>
                    </div>
                    <div><span style={{ display:'inline-block', padding:'5px 12px', borderRadius:999, fontSize:11.5, fontWeight:700, background:'var(--glass-divider)', color:'#9A5B26', whiteSpace:'nowrap' }}>{req.section==='einvoice' ? 'E-Invoice & bank' : 'Profile details'}</span></div>
                    <div style={{ fontSize:12.5, color:'var(--text-secondary)' }}>{req.submittedAt}</div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6, flexWrap:'wrap' }}>
                      <button onClick={()=>decide(req,'approved')} style={{ background:'rgba(90,145,110,0.16)', border:'none', color:'#3F7A54', fontSize:12, fontWeight:700, borderRadius:9, padding:'8px 12px', cursor:'pointer' }}>Approve</button>
                      <button onClick={()=>decide(req,'rejected')} style={{ background:'rgba(196,74,74,0.1)', border:'none', color:'#B03A2E', fontSize:12, fontWeight:700, borderRadius:9, padding:'8px 12px', cursor:'pointer' }}>Reject</button>
                      <IconBtn title="View vendor" onClick={()=>set({vendorDetailId:v.id, vendorDetailReturnAppId:null})}><Icon name="eye" size={14} color="#6B4E33"/></IconBtn>
                    </div>
                  </div>
                  <div style={{ margin:'0 14px 13px', background:'rgba(154,91,38,0.06)', border:'1px solid var(--glass-divider)', borderRadius:10, padding:'9px 12px', display:'flex', flexDirection:'column', gap:5 }}>
                    {changedFields.map(([k,label]) => {
                      const newVal = req.changes[k];
                      const oldVal = req.section==='einvoice' ? (v.einvoice&&v.einvoice[k]) : v[k];
                      return (
                        <div key={k} style={{ fontSize:11.5, color:'var(--text-secondary)' }}>
                          <span style={{ fontWeight:700, color:'var(--text-primary)' }}>{label}:</span>{' '}
                          <span style={{ color:'#B8A48C', textDecoration:'line-through' }}>{oldVal||'—'}</span>{' → '}
                          <span style={{ color:'var(--text-primary)', fontWeight:700 }}>{newVal||'—'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {decided.length > 0 && (
              <div style={{ marginTop:18 }}>
                <button onClick={()=>setShowDecidedReq(s=>!s)} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:12.5, fontWeight:700, padding:0, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                  <Icon name={showDecidedReq?'x':'eye'} size={13} color="#8A6A4A"/>
                  {showDecidedReq ? 'Hide' : 'Show'} {decided.length} decided request{decided.length!==1?'s':''}
                </button>
                {showDecidedReq && (
                  <MiniTablePanel gridTemplate="minmax(0,2fr) minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)" minWidth={620}
                    headerCells={<><div>Vendor</div><div>Section</div><div>Submitted</div><div style={{ textAlign:'right' }}>Result</div></>}>
                    {decided.map(req => {
                      const v = vendors.find(x=>x.id===req.vendorId)||{};
                      return (
                        <div key={req.id} className="dc-row-hover" style={{ display:'grid', gridTemplateColumns:'minmax(0,2fr) minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)', gap:10, alignItems:'center', padding:'12px', borderBottom:'1px solid var(--glass-divider)' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                            <VendorAvatar v={v} size={30}/>
                            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.business}</div>
                          </div>
                          <div style={{ fontSize:11.5, color:'var(--text-secondary)' }}>{req.section==='einvoice' ? 'E-Invoice & bank' : 'Profile details'}</div>
                          <div style={{ fontSize:11.5, color:'var(--text-secondary)' }}>{req.submittedAt}</div>
                          <div style={{ display:'flex', justifyContent:'flex-end' }}>
                            <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, borderRadius:999, padding:'4px 10px', background: req.status==='approved'?'rgba(90,145,110,0.16)':'rgba(196,74,74,0.1)', color: req.status==='approved'?'#3F7A54':'#B03A2E' }}>
                              {req.status==='approved' ? 'Approved' : 'Rejected'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </MiniTablePanel>
                )}
              </div>
            )}
          </TableShell>
        );
      })()}

      {/* ── Events ── */}
      {aTab === 'events' && (() => {
        const stepLabels = ['Picture','Details','Schedule','Pricing'];
        const d = dayCount(state.ef.start,state.ef.end)||1;
        const fnbTotal = Number(state.ef.fnb||0)*d*1.06;
        const nfTotal  = Number(state.ef.nonfnb||0)*d*1.06;
        const openEdit = (ev) => set({eventDetailId:ev.id,eef:{name:ev.name,location:ev.location||'',start:ev.startDate||'',end:ev.endDate||'',startTime:ev.startTime||'',endTime:ev.endTime||'',lastApp:ev.lastApp||'',fnb:ev.fnb||'',nonfnb:ev.nonfnb||'',img:ev.img||EVENT_IMG_PALETTE[0]}});
        const scrollRail = (dir) => { const el = eventRailRef.current; if (el) el.scrollBy({left: dir*208, behavior:'smooth'}); };
        const eventSearchQ = eventSearch.trim().toLowerCase();
        const railEvents = eventSearchQ ? events.filter(ev => (ev.name||'').toLowerCase().includes(eventSearchQ)) : events;
        const createEvent = async () => {
          if (!state.ef.name) { showToast('Add an event name first','info'); return; }
          if (state.ef.start && state.ef.end && state.ef.end < state.ef.start) { showToast('End date is before the start date','info'); return; }
          if (!(Number(state.ef.fnb) > 0) || !(Number(state.ef.nonfnb) > 0)) { showToast('Set both daily rates (F&B and Non-F&B) first','info'); return; }
          const dd = dayCount(state.ef.start,state.ef.end)||1;
          let ev = { id:'e'+Date.now(), name:state.ef.name, dateRange:state.ef.start&&state.ef.end ? `${fmtShort(state.ef.start)} – ${fmtShort(state.ef.end)} ${new Date(state.ef.end).getFullYear()}` : 'Dates TBC', location:state.ef.location.trim()||'Suria Sabah Mall', days:dd, applied:0, fnb:Number(state.ef.fnb)||0, nonfnb:Number(state.ef.nonfnb)||0, startTime:state.ef.startTime||'10:00', endTime:state.ef.endTime||'22:00', lastApp:state.ef.lastApp||'', startDate:state.ef.start||'', endDate:state.ef.end||'', img:state.ef.img||EVENT_IMG_PALETTE[0] };
          if (isSupabaseConfigured) {
            // Write-then-reflect: the event only lands in local state once the
            // insert succeeds, carrying the DB's UUID id + `remote` marker.
            try { ev = await insertEvent(ev); }
            catch (e) { showToast("Couldn't create the event — " + e.message, 'lock'); return; }
          }
          dispatch({type:'MERGE_EVENTS',payload:[ev,...events]});
          set({ef:{name:'',location:'',start:'',end:'',startTime:'',endTime:'',lastApp:'',fnb:'',nonfnb:'',img:EVENT_IMG_PALETTE[0]}});
          setEventStep(0);
          logActivity('Admin', `created the ${ev.name} event.`, {icon:'tent', tint:'var(--tint-green-bg)'});
          showToast('Event created','tent');
        };
        return (
        <div style={{ padding:'14px 16px 24px' }}>
          <div className="event-wizard-wrap">

            {/* CREATE EVENT — layered wizard card */}
            <div className="event-wizard-card" style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:22, padding:'18px 18px 20px', boxShadow:'0 20px 44px -20px rgba(60,40,20,0.4)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:11 }}>
                <div style={{ width:38, height:38, borderRadius:11, background:'linear-gradient(135deg,#E8A05C,#9A5B26)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Icon name="tent" size={18} color="#FFF8EE"/>
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontFamily:"'Marcellus',serif", fontSize:19, fontWeight:400, color:'var(--text-primary)' }}>Create event</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:1 }}>Step {eventStep+1} of 4 · {stepLabels[eventStep]}</div>
                </div>
              </div>

              <div style={{ display:'flex', alignItems:'center', margin:'18px 0 2px' }}>
                {stepLabels.map((label,i) => {
                  const done = i < eventStep, active = i === eventStep;
                  return (
                    <div key={label} style={{ display:'flex', alignItems:'center', flex: i<stepLabels.length-1 ? '1 1 0' : '0 0 auto' }}>
                      <button onClick={()=>setEventStep(i)} title={label} style={{ flexShrink:0, width:26, height:26, borderRadius:'50%', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, background: done?'#B97434':active?'#7A431A':'var(--border-light)', color:(done||active)?'#FFF8EE':'var(--text-muted)', boxShadow: active?'0 4px 10px rgba(122,67,26,0.4)':'none' }}>
                        {done ? <Icon name="check" size={12} color="#FFF8EE"/> : i+1}
                      </button>
                      {i < stepLabels.length-1 && <div style={{ flex:1, height:2, background: i<eventStep ? '#B97434' : 'var(--border-light)', margin:'0 4px', borderRadius:2 }}/>}
                    </div>
                  );
                })}
              </div>

              <div key={eventStep} className="tab-panel" style={{ minHeight:264, display:'flex', flexDirection:'column', justifyContent:'center', padding:'16px 0 4px' }}>

                {eventStep === 0 && (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <div style={{ position:'relative', width:164, aspectRatio:'4 / 5', borderRadius:16, overflow:'hidden', background:state.ef.img||EVENT_IMG_PALETTE[0], boxShadow:'0 10px 26px rgba(90,55,20,0.22)' }}>
                      {!isEventPhoto(state.ef.img) && <Icon name="image" size={40} color="rgba(255,255,255,0.35)" style={{ position:'absolute', top:'40%', left:'50%', transform:'translate(-50%,-50%)' }}/>}
                      <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(29,16,6,0) 55%, rgba(29,16,6,0.6) 100%)' }}/>
                      <div style={{ position:'absolute', left:12, right:12, bottom:12, fontSize:13.5, fontWeight:700, color:'#FFF8EE', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{state.ef.name || 'Your event name'}</div>
                    </div>
                    <div style={{ marginTop:16, display:'flex', gap:9 }}>
                      <label style={{ display:'inline-flex', alignItems:'center', gap:6, border:'1px solid var(--border-medium)', background:'var(--bg-card)', color:'#9A5B26', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'9px 14px', cursor:'pointer' }}>
                        <Icon name="upload" size={13} color="#9A5B26"/>{isEventPhoto(state.ef.img) ? 'Change photo' : 'Upload photo'}
                        <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{
                          const file = e.target.files?.[0]; if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => set({ef:{...state.ef,img:eventImgFromFile(reader.result)}});
                          reader.readAsDataURL(file);
                          e.target.value='';
                        }}/>
                      </label>
                      {isEventPhoto(state.ef.img) && (
                        <button onClick={()=>set({ef:{...state.ef,img:EVENT_IMG_PALETTE[0]}})} style={{ background:'var(--bg-subtle)', border:'none', color:'var(--text-secondary)', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'9px 12px', cursor:'pointer' }}>Remove</button>
                      )}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:12, textAlign:'center', lineHeight:1.4 }}>Shown wherever this event is listed.</div>
                  </div>
                )}

                {eventStep === 1 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
                    <div>
                      <div style={lbl}>Event name</div>
                      <input value={state.ef.name} onChange={e=>set({ef:{...state.ef,name:e.target.value}})} placeholder="e.g. Harvest Night Market" style={inp}/>
                    </div>
                    <div>
                      <div style={lbl}>Location</div>
                      <input value={state.ef.location} onChange={e=>set({ef:{...state.ef,location:e.target.value}})} placeholder="Blank = Suria Sabah Mall" style={inp}/>
                    </div>
                  </div>
                )}

                {eventStep === 2 && (
                  <div className="form-grid">
                    <div><div style={lbl}>Start date</div><input type="date" value={state.ef.start} onChange={e=>set({ef:{...state.ef,start:e.target.value}})} style={inp}/></div>
                    <div><div style={lbl}>End date</div><input type="date" value={state.ef.end} onChange={e=>set({ef:{...state.ef,end:e.target.value}})} style={inp}/></div>
                    <div><div style={lbl}>Daily start time</div><input type="time" value={state.ef.startTime} onChange={e=>set({ef:{...state.ef,startTime:e.target.value}})} style={inp}/></div>
                    <div><div style={lbl}>Daily end time</div><input type="time" value={state.ef.endTime} onChange={e=>set({ef:{...state.ef,endTime:e.target.value}})} style={inp}/></div>
                    {state.ef.start && state.ef.end && (
                      <div className="span2" style={{ display:'flex', alignItems:'center', gap:7, background:'var(--tint-pink-bg)', borderRadius:10, padding:'9px 12px', fontSize:12.5, color:'#9A5B26', fontWeight:600 }}>
                        <Icon name="calendar" size={15} color="#9A5B26"/>Duration: {dayCount(state.ef.start,state.ef.end)} day(s)
                      </div>
                    )}
                    <div className="span2">
                      <div style={lbl}>Last date to apply</div>
                      <input type="date" value={state.ef.lastApp} onChange={e=>set({ef:{...state.ef,lastApp:e.target.value}})} style={inp}/>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:5 }}>Applications close automatically after this date.</div>
                    </div>
                  </div>
                )}

                {eventStep === 3 && (
                  <div>
                    <div className="form-grid">
                      <div><div style={{ ...lbl, minHeight:32 }}>F&amp;B / day (RM) + 6% SST</div><input inputMode="numeric" value={state.ef.fnb} onChange={e=>set({ef:{...state.ef,fnb:e.target.value}})} placeholder="300" style={inp}/></div>
                      <div><div style={{ ...lbl, minHeight:32 }}>Non-F&amp;B / day (RM) + 6% SST</div><input inputMode="numeric" value={state.ef.nonfnb} onChange={e=>set({ef:{...state.ef,nonfnb:e.target.value}})} placeholder="250" style={inp}/></div>
                    </div>
                    <div style={{ marginTop:13, border:'1px solid var(--border-light)', borderRadius:14, padding:13, background:'var(--bg-subtle-alt)' }}>
                      <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:'0.05em', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}><Icon name="receipt" size={12} color="var(--text-muted)"/>Pricing preview · {d} day(s)</div>
                      <div style={{ display:'flex', gap:9, flexWrap:'wrap' }}>
                        <div style={{ flex:'1 1 140px', background:'var(--tint-green-bg)', borderRadius:10, padding:'10px 12px' }}><div style={{ fontSize:10.5, color:'var(--tint-green-text)', fontWeight:600 }}>F&amp;B rental total</div><div style={{ fontSize:15, fontWeight:700, color:'var(--tint-green-text)', marginTop:2 }}>RM {money(fnbTotal)}</div><div style={{ fontSize:9.5, color:'#6f9d8a', marginTop:1 }}>inclusive of 6% SST</div></div>
                        <div style={{ flex:'1 1 140px', background:'var(--tint-pink-bg)', borderRadius:10, padding:'10px 12px' }}><div style={{ fontSize:10.5, color:'#9A5B26', fontWeight:600 }}>Non-F&amp;B rental total</div><div style={{ fontSize:15, fontWeight:700, color:'#9A5B26', marginTop:2 }}>RM {money(nfTotal)}</div><div style={{ fontSize:9.5, color:'#A9834D', marginTop:1 }}>inclusive of 6% SST</div></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:6 }}>
                {eventStep > 0 && (
                  <button onClick={()=>setEventStep(s=>s-1)} style={{ flexShrink:0, display:'flex', alignItems:'center', gap:6, padding:'13px 16px', borderRadius:999, border:'1px solid var(--border-medium)', background:'var(--bg-subtle)', color:'#7A431A', fontSize:13.5, fontWeight:700, cursor:'pointer' }}>
                    <Icon name="arrowLeft" size={14} color="#7A431A"/>Back
                  </button>
                )}
                <button onClick={()=> eventStep===3 ? createEvent() : setEventStep(s=>s+1)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:14.5, fontWeight:600, borderRadius:999, padding:14, cursor:'pointer' }}>
                  {eventStep===3 ? <><Icon name="plus" size={15} color="#FAF8F5"/>Create event</> : <>Next<Icon name="arrowLeft" size={14} color="#FAF8F5" style={{ transform:'rotate(180deg)' }}/></>}
                </button>
              </div>
            </div>

            {/* EXISTING EVENTS — horizontal rail */}
            <div className="event-rail-panel" style={{ background:'var(--bg-subtle-alt)', border:'1px solid var(--border-light)', borderRadius:22, padding:'18px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, gap:10 }}>
                <div style={{ fontSize:12, fontWeight:700, letterSpacing:'0.06em', color:'var(--text-secondary)', textTransform:'uppercase', flexShrink:0 }}>Existing events</div>
                {eventSearchOpen ? (
                  <div style={{ position:'relative', flex:'1 1 auto', maxWidth:220 }}>
                    <Icon name="search" size={13} color="var(--text-muted)" style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)' }}/>
                    <input autoFocus value={eventSearch} onChange={e=>setEventSearch(e.target.value)} placeholder="Search events…" style={{ width:'100%', border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:999, padding:'7px 30px', fontSize:12.5, color:'var(--text-primary)', outline:'none' }}/>
                    <button onClick={()=>{ setEventSearchOpen(false); setEventSearch(''); }} aria-label="Close search" style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:2, display:'flex' }}>
                      <Icon name="x" size={12} color="var(--text-muted)"/>
                    </button>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>{events.length} total</div>
                    <button onClick={()=>setEventSearchOpen(true)} aria-label="Search events" style={{ width:30, height:30, borderRadius:'50%', border:'1px solid var(--border-medium)', background:'var(--bg-card)', boxShadow:'0 2px 8px rgba(58,34,16,0.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                      <Icon name="search" size={13} color="#7A431A"/>
                    </button>
                  </div>
                )}
              </div>
              <div style={{ position:'relative' }}>
                <div ref={eventRailRef} className="event-rail">
                  {railEvents.map(ev => {
                    const st = eventStatus(ev);
                    const appsClosed = ev.lastApp && new Date() > new Date(ev.lastApp);
                    return (
                      <div key={ev.id} className="event-rail-card" style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:18, overflow:'hidden' }}>
                        <div style={{ position:'relative', width:'100%', aspectRatio:'4 / 5', background:ev.img }}>
                          <Icon name="tent" size={60} color="rgba(255,255,255,0.16)" style={{ position:'absolute', right:-12, bottom:-12 }}/>
                          <span style={{ position:'absolute', top:9, right:9, fontSize:10, fontWeight:700, borderRadius:999, padding:'4px 9px', background:st.bg, color:st.color, boxShadow:'0 1px 5px rgba(0,0,0,0.18)' }}>{st.label}</span>
                          <button onClick={()=>openEdit(ev)} aria-label={`Edit ${ev.name}`} style={{ position:'absolute', top:9, left:9, width:28, height:28, borderRadius:'50%', border:'none', background:'rgba(29,16,6,0.45)', backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)', color:'#FFF8EE', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                            <Icon name="pencil" size={12} color="#FFF8EE"/>
                          </button>
                        </div>
                        <div {...clickable(()=>openEdit(ev))} aria-label={`Edit ${ev.name}`} style={{ padding:'12px 12px 14px', cursor:'pointer' }}>
                          <div style={{ fontFamily:"'Marcellus',serif", fontSize:14.5, fontWeight:400, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ev.name}</div>
                          <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:7 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-secondary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}><Icon name="pin" size={11} color="var(--text-muted)"/>{ev.location || 'Location TBC'}</div>
                            <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-muted)' }}><Icon name="calendar" size={11} color="var(--text-muted)"/>{ev.dateRange}</div>
                            <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-muted)' }}><Icon name="clock" size={11} color="var(--text-muted)"/>{ev.startTime && ev.endTime ? `${fmtTime(ev.startTime)} – ${fmtTime(ev.endTime)}` : 'Time TBC'}</div>
                          </div>
                          <div style={{ height:1, background:'var(--border-light)', margin:'10px 0' }}/>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
                            <div><div style={{ fontSize:14.5, fontWeight:700, color:'var(--text-primary)' }}>{apps.filter(a=>a.eventId===ev.id).length}</div><div style={{ fontSize:9, color:'var(--text-muted)' }}>Applied</div></div>
                            <div><div style={{ fontSize:14.5, fontWeight:700, color:'var(--text-primary)' }}>{ev.days||1}</div><div style={{ fontSize:9, color:'var(--text-muted)' }}>Day(s)</div></div>
                          </div>
                          <div style={{ marginTop:8, padding:'4px 10px', borderRadius:999, fontSize:9.5, fontWeight:700, textAlign:'center', background:appsClosed?'var(--bg-subtle)':'var(--tint-green-bg)', color:appsClosed?'var(--text-muted)':'var(--tint-green-text)' }}>{appsClosed?'Applications closed':'Applications open'}</div>
                        </div>
                      </div>
                    );
                  })}
                  {railEvents.length===0 && (
                    <div style={{ flex:'1 1 auto', textAlign:'center', color:'var(--text-muted)', fontSize:13, padding:'30px 10px' }}>
                      {events.length===0 ? 'No events yet — create one to get started.' : `No events match "${eventSearch.trim()}".`}
                    </div>
                  )}
                </div>
                {railEvents.length > 1 && (
                  <>
                    <button onClick={()=>scrollRail(-1)} aria-label="Previous events" style={{ position:'absolute', left:2, top:'50%', transform:'translateY(-50%)', width:34, height:34, borderRadius:'50%', border:'1px solid var(--border-medium)', background:'var(--bg-card)', boxShadow:'0 8px 18px rgba(58,34,16,0.18)', color:'#7A431A', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', zIndex:3 }}>
                      <Icon name="arrowLeft" size={15} color="#7A431A"/>
                    </button>
                    <button onClick={()=>scrollRail(1)} aria-label="Next events" style={{ position:'absolute', right:2, top:'50%', transform:'translateY(-50%)', width:34, height:34, borderRadius:'50%', border:'1px solid var(--border-medium)', background:'var(--bg-card)', boxShadow:'0 8px 18px rgba(58,34,16,0.18)', color:'#7A431A', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', zIndex:3 }}>
                      <Icon name="arrowLeft" size={15} color="#7A431A" style={{ transform:'rotate(180deg)' }}/>
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
        );
      })()}

      {/* ── Event Applications ── */}
      {aTab === 'apps' && (() => {
        const eaGrid = 'minmax(0,2.2fr) minmax(0,1.9fr) minmax(0,1fr) minmax(0,1.6fr)';
        const eventFilterRow = (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:12, marginBottom:14, flexWrap:'wrap' }}>
            <div style={{ flex:'1 1 240px', minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Filter by event</div>
              <select value={filterEvent} onChange={e=>set({filterEvent:e.target.value,page:1})} style={{ width:'100%', maxWidth:320, border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', borderRadius:12, padding:'11px 14px', fontSize:14, color:'var(--text-primary)', outline:'none', fontFamily:"'Karla',sans-serif" }}>
                {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', background:'rgba(154,91,38,0.08)', borderRadius:12, padding:4, gap:4 }}>
              {[['apps','Applications'],['shortlist',`Shortlist${apps.filter(a=>a.eventId===filterEvent&&(a.status==='shortlisted'||a.status==='approved')).length ? ` (${apps.filter(a=>a.eventId===filterEvent&&(a.status==='shortlisted'||a.status==='approved')).length})` : ''}`]].map(([id,label]) => (
                <button key={id} onClick={()=>set({appsTab:id,page:1})} style={{ border:'none', fontSize:13, fontWeight:700, borderRadius:9, padding:'10px 14px', cursor:'pointer', background:appsTab===id?'var(--glass-card-solid)':'transparent', color:appsTab===id?'var(--text-primary)':'var(--text-muted)', boxShadow:appsTab===id?'0 1px 4px rgba(58,34,16,0.1)':'none', fontFamily:"'Karla',sans-serif" }}>{label}</button>
              ))}
            </div>
            <button onClick={()=>{
              const evApps = apps.filter(a=>a.eventId===filterEvent);
              downloadCsv(`${safeName(curEv.name)} - applications.csv`,
                ['Business','Owner','Category','Status','Booth','Applied'],
                evApps.map(a=>{ const v=vById(a.vendorId); return [v.business,v.owner,v.category,a.status,a.shared?`Shared (${(a.partners||[]).length+1} vendors)`:'Solo',a.appliedAt?fmtShort(a.appliedAt):'']; }));
              logActivity('Admin', `exported ${evApps.length} event application(s) for ${curEv.name} as CSV.`, {icon:'download', tint:'var(--tint-blue-bg)'});
              showToast(`Exported ${evApps.length} application(s) to CSV`,'download');
            }} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 18px', border:'1px solid var(--glass-chip-border)', borderRadius:999, fontSize:13, fontWeight:700, color:'var(--text-secondary)', background:'var(--glass-input)', cursor:'pointer', fontFamily:"'Karla',sans-serif" }}>
              <Icon name="download" size={14} color="#6B4E33"/>Export
            </button>
          </div>
        );

        if (appsTab === 'shortlist') {
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
            <div style={{ position:'relative', padding:'28px 24px 32px', minHeight:560 }}>
              <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
                <div style={{ position:'absolute', top:-120, right:-80, width:420, height:420, borderRadius:'50%', background:'radial-gradient(circle at 40% 40%, rgba(233,160,92,0.35), transparent 70%)', filter:'blur(50px)' }}/>
                <div style={{ position:'absolute', bottom:-160, left:-100, width:460, height:460, borderRadius:'50%', background:'radial-gradient(circle at 40% 40%, var(--glass-chip-border), transparent 70%)', filter:'blur(60px)' }}/>
              </div>
              <div style={{ position:'relative', zIndex:1 }}>
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontFamily:"'Marcellus',serif", fontWeight:400, fontSize:26, margin:'0 0 6px', color:'var(--text-primary)' }}>Event Applications</div>
                  <div style={{ fontSize:14, color:'var(--text-muted)' }}>The final roster for {curEv.name}, grouped by category.</div>
                </div>
                {eventFilterRow}
                {rosterApps.length === 0 && (
                  <div style={{ background:'var(--glass-card)', border:'1px solid var(--glass-card-border)', borderRadius:16, padding:'24px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:13.5, marginBottom:14 }}>
                    No vendors shortlisted or approved yet — shortlist pending applications from the Applications tab.
                  </div>
                )}
                {groups.map(g => (
                  <div key={g.cat.id} style={{ background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:20, padding:'18px 20px', boxShadow:'0 20px 50px rgba(58,34,16,0.12)', marginBottom:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:9, flexWrap:'wrap' }}>
                      <span style={{ fontFamily:"'Marcellus',serif", fontSize:17, color:'var(--text-primary)' }}>{g.cat.name}</span>
                      <span style={{ fontSize:11, fontWeight:700, color: g.roster.length ? '#9A6A1E' : 'var(--text-muted)', background: g.roster.length ? 'rgba(214,152,66,0.16)' : 'rgba(154,91,38,0.08)', borderRadius:999, padding:'3px 10px' }}>
                        {g.roster.length} of {g.totalVendors} vendor{g.totalVendors!==1?'s':''}
                      </span>
                      {g.roster.length > 0 && (
                        <span style={{ fontSize:11.5, color:'var(--text-muted)' }}>{g.approvedCount} approved · {g.shortlistedCount} shortlisted</span>
                      )}
                    </div>
                    {g.roster.length === 0 ? (
                      <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:10 }}>No vendors shortlisted or approved yet in this category.</div>
                    ) : (
                      <div style={{ marginTop:12 }}>
                        {g.roster.map((a,idx) => {
                          const v = vById(a.vendorId);
                          const holdOffs = complianceHold(a.vendorId, a.eventId);
                          const overridden = !!compOverrides[`${a.vendorId}-${a.eventId}`];
                          const onHold = a.status==='shortlisted' && holdOffs.length > 0 && !overridden;
                          return (
                            <div key={a.id} style={{ borderTop: idx>0 ? '1px solid var(--glass-divider)' : 'none', padding:'12px 0' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                                <VendorAvatar v={v} size={34}/>
                                <div style={{ flex:1, minWidth:150 }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                                    <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text-primary)' }}>
                                      <span style={{ fontSize:11, fontWeight:700, color:'#B8A48C', marginRight:6 }}>#{idx+1}</span>{v.business}
                                    </div>
                                    {a.status==='approved' && <span style={{ fontSize:11, fontWeight:700, color:'#3F7A54' }}>Approved</span>}
                                    {a.shared && (
                                      <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10.5, fontWeight:700, color:'var(--text-secondary)', background:'var(--glass-divider)', borderRadius:999, padding:'2px 8px' }}>
                                        <Icon name="users" size={10} color="#6B4E33"/>{(a.partners||[]).length+1} vendors
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:1 }}>{v.owner}</div>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', justifyContent:'flex-end' }}>
                                  <IconBtn title="View & share booth" onClick={()=>set({appDetailId:a.id})}><Icon name="eye" size={14} color="#6B4E33"/></IconBtn>
                                  {a.status==='approved' && (
                                    <button onClick={()=>{ if (!window.confirm(`Release ${v.business} from this market? They'll be moved back to Event Applications as pending.`)) return; setAppStatus(a,'pending',()=>{ logActivity('Admin', `released ${v.business} from the approved roster for ${eById(a.eventId).name} — moved back to Event Applications.`, {icon:'x', tint:'var(--tint-red-bg)'}); showToast('Vendor released — moved back to Event Applications','x'); }); }} style={{ background:'none', border:'none', color:'#B03A2E', fontSize:11, fontWeight:700, padding:'0 4px', cursor:'pointer', textDecoration:'underline', textUnderlineOffset:3 }}>Release</button>
                                  )}
                                  {a.status==='shortlisted' && (onHold ? (
                                    <button onClick={()=>{ set({compOverrides:{...compOverrides, [`${a.vendorId}-${a.eventId}`]:true}}); logActivity('Admin', `overrode the compliance hold for ${v.business} — ${eById(a.eventId).name}.`, {icon:'shield', tint:'var(--tint-amber-bg)'}); showToast('Hold overridden — you can now approve this vendor','shield'); }} style={{ background:'var(--glass-input)', border:'1px solid rgba(214,152,66,0.35)', color:'#9A6A1E', fontSize:11.5, fontWeight:700, borderRadius:9, padding:'8px 12px', cursor:'pointer' }}>Override hold</button>
                                  ) : (
                                    <button onClick={()=>setAppStatus(a,'approved',()=>{ logActivity('Admin', `approved ${v.business}'s application for ${eById(a.eventId).name}.`, {icon:'check', tint:'var(--tint-pink-bg)'}); showToast('Application approved'+(settings.emailAlerts?' · vendor emailed':''),'check'); })} style={{ background:'rgba(90,145,110,0.16)', border:'none', color:'#3F7A54', fontSize:12, fontWeight:700, borderRadius:9, padding:'8px 12px', cursor:'pointer' }}>Approve</button>
                                  ))}
                                  {a.status==='shortlisted' && (
                                    <button onClick={()=>setAppStatus(a,'pending',()=>{ logActivity('Admin', `rejected ${v.business} from the shortlist for ${eById(a.eventId).name} — moved back to Event Applications.`, {icon:'x', tint:'var(--tint-red-bg)'}); showToast('Vendor moved back to Event Applications','x'); })} style={{ background:'rgba(196,74,74,0.1)', border:'none', color:'#B03A2E', fontSize:12, fontWeight:700, borderRadius:9, padding:'8px 12px', cursor:'pointer' }}>Reject</button>
                                  )}
                                </div>
                              </div>
                              {onHold && (
                                <div style={{ display:'flex', alignItems:'flex-start', gap:7, background:'rgba(214,152,66,0.12)', border:'1px solid rgba(214,152,66,0.28)', borderRadius:10, padding:'9px 11px', marginTop:9, fontSize:11.5, color:'#9A6A1E', lineHeight:1.5 }}>
                                  <Icon name="shield" size={13} color="#9A6A1E" style={{ marginTop:1, flexShrink:0 }}/>
                                  <div style={{ flex:1 }}>Compliance hold — {holdOffs.length} offence{holdOffs.length>1?'s':''} in the last {skipN} market{skipN>1?'s':''}.</div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        return (
          <TableShell
            title="Event Applications" subtitle={`Awaiting a decision for ${curEv.name}. Shortlist a vendor to move them for review.`}
            aboveControls={eventFilterRow}
            panelTitle="Applications"
            searchValue={vendorSearch} onSearchChange={setVendorSearch} searchPlaceholder="Search by business or owner name"
            headerCells={<><div>Vendor</div><div>Booth</div><div>Category</div><div style={{ textAlign:'right' }}>Actions</div></>}
            gridTemplate={eaGrid} minWidth={820}
            isEmpty={pagedApps.length===0}
            emptyMessage={searchQ ? `No vendors match "${vendorSearch}".` : 'No applications awaiting a decision for this market.'}
            total={filteredApps.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}
          >
            {pagedApps.map((a,idx) => {
              const v = vById(a.vendorId);
              const vOffenses = offenses.filter(o=>o.vendorId===a.vendorId);
              const holdOffs = complianceHold(a.vendorId, a.eventId);
              const overridden = !!compOverrides[`${a.vendorId}-${a.eventId}`];
              const onHold = holdOffs.length > 0 && !overridden;
              const h = vendorHistory(a.vendorId);
              return (
                <div key={a.id} className="dc-row-hover" style={{ borderBottom:'1px solid var(--glass-divider)' }}>
                  <div style={{ display:'grid', gridTemplateColumns:eaGrid, gap:10, alignItems:'center', padding:'13px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                      <VendorAvatar v={v} size={36}/>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}><span style={{ fontSize:11, fontWeight:700, color:'#B8A48C', marginRight:6 }}>#{(page-1)*PER_PAGE+idx+1}</span>{v.business}</div>
                        <div style={{ fontSize:11.5, color:'var(--text-muted)' }}>{v.owner}</div>
                        <div style={{ fontSize:10.5, color:'#B8A48C', marginTop:1 }}>{h.total === 0 ? 'No markets joined yet' : `${h.total} market${h.total>1?'s':''} joined`}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:10.5, fontWeight:700, color:'var(--text-secondary)', background:'var(--glass-divider)', borderRadius:999, padding:'3px 9px' }}>
                        <Icon name={a.shared?'users':'tent'} size={11} color="#6B4E33"/>{a.shared?`Sharing · ${(a.partners||[]).length+1}`:'Solo'}
                      </span>
                      {vOffenses.slice(0,2).map((o,i) => {
                        const ot = offenseTypes[o.type]||{};
                        return <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10.5, fontWeight:700, borderRadius:999, padding:'3px 9px', background:ot.bg, color:ot.color }}><span style={{ width:5, height:5, borderRadius:'50%', background:ot.color }}/>{ot.label}</span>;
                      })}
                    </div>
                    <div style={{ minWidth:0, overflow:'hidden' }}><span style={{ display:'inline-block', maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', padding:'5px 12px', borderRadius:999, fontSize:11.5, fontWeight:700, background:'var(--glass-divider)', color:'#9A5B26', whiteSpace:'nowrap' }}>{v.category}</span></div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6 }}>
                      <IconBtn title="View & share booth" onClick={()=>set({appDetailId:a.id})}><Icon name="eye" size={14} color="#6B4E33"/></IconBtn>
                      <button onClick={()=>setAppStatus(a,'shortlisted',()=>{ logActivity('Admin', `shortlisted ${v.business} for ${eById(a.eventId).name}.`, {icon:'clipboard', tint:'var(--tint-amber-bg)'}); showToast('Vendor shortlisted','clipboard'); })} style={{ background:'rgba(214,152,66,0.16)', border:'none', color:'#9A6A1E', fontSize:12, fontWeight:700, borderRadius:9, padding:'8px 12px', cursor:'pointer' }}>Shortlist</button>
                    </div>
                  </div>
                  {holdOffs.length > 0 && (
                    onHold ? (
                      <div style={{ margin:'0 14px 13px', display:'flex', alignItems:'flex-start', gap:8, background:'rgba(214,152,66,0.12)', border:'1px solid rgba(214,152,66,0.28)', borderRadius:10, padding:'9px 12px', fontSize:11.5, color:'#9A6A1E', lineHeight:1.5 }}>
                        <Icon name="shield" size={14} color="#9A6A1E" style={{ marginTop:1, flexShrink:0 }}/>
                        <div style={{ flex:1 }}>
                          <b>Compliance hold</b> — {v.business} logged {holdOffs.length} offence{holdOffs.length>1?'s':''} at {[...new Set(holdOffs.map(o=>eById(o.eventId).name))].join(', ')}. Policy: sit out the next {skipN} market{skipN>1?'s':''} — this can still be shortlisted, but approval will need an override in the Shortlist tab.
                        </div>
                      </div>
                    ) : (
                      <div style={{ margin:'0 14px 13px', display:'flex', alignItems:'center', gap:7, background:'rgba(154,91,38,0.06)', border:'1px solid var(--glass-divider)', borderRadius:10, padding:'9px 12px', fontSize:11.5, color:'var(--text-muted)', lineHeight:1.45 }}>
                        <Icon name="shield" size={13} color="#8A6A4A"/>Compliance hold overridden for this vendor.
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </TableShell>
        );
      })()}

      {/* ── Payments ── */}
      {aTab === 'payments' && (
        <div style={{ position:'relative', padding:'28px 24px 32px', minHeight:560 }}>
          {/* Decorative ambient glow — same treatment as the Categories tab's "All
              Vendors" table (Canvas-4.dc.html handoff) so the two table-style admin
              views share one visual language. Clipped by its own absolutely-positioned
              layer (not `overflow:hidden` on this whole tab wrapper) so the sticky
              pagination footer below isn't blocked from sticking to the real page
              scroll container — an `overflow` value other than `visible` on any
              ancestor between a sticky element and its scrolling container defeats
              `position:sticky` entirely. */}
          <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
            <div style={{ position:'absolute', top:-120, right:-80, width:420, height:420, borderRadius:'50%', background:'radial-gradient(circle at 40% 40%, rgba(233,160,92,0.35), transparent 70%)', filter:'blur(50px)' }}/>
            <div style={{ position:'absolute', bottom:-160, left:-100, width:460, height:460, borderRadius:'50%', background:'radial-gradient(circle at 40% 40%, var(--glass-chip-border), transparent 70%)', filter:'blur(60px)' }}/>
          </div>

          <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:20, flexWrap:'wrap', marginBottom:20 }}>
            <div>
              <div style={{ fontFamily:"'Marcellus',serif", fontWeight:400, fontSize:26, margin:'0 0 6px', color:'var(--text-primary)' }}>Payments</div>
              <div style={{ margin:0, fontSize:14, color:'var(--text-muted)' }}>Rental payment status for every approved event application.</div>
            </div>
            <button onClick={()=>{
              const rows = approvedApps.map(a=>{
                const v=vById(a.vendorId); const dep=depRec(a.vendorId);
                const calc=payCalc(v,curEv,dep.status,a.tier); const rec=payRec(`${a.vendorId}-${a.eventId}`);
                return [v.business,v.owner,calc.tier,money(calc.total),money(rec.paid||0),badge(rec.status).label,badge(dep.status).label];
              });
              downloadCsv(`${safeName(curEv.name)} - payments.csv`,
                ['Business','Owner','Tier','Total due (RM)','Paid (RM)','Payment status','Deposit status'], rows);
              logActivity('Admin', `exported ${rows.length} payment record(s) for ${curEv.name} as CSV.`, {icon:'download', tint:'var(--tint-blue-bg)'});
              showToast(`Exported ${rows.length} payment record(s) to CSV`,'download');
            }} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 20px', border:'1px solid var(--glass-chip-border)', borderRadius:999, fontSize:13.5, fontWeight:700, color:'var(--text-secondary)', background:'var(--glass-input)', cursor:'pointer', fontFamily:"'Karla',sans-serif" }}>
              <Icon name="download" size={14} color="#6B4E33"/>Export
            </button>
          </div>

          <div style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-end', gap:12, marginBottom:14 }}>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Filter by event</div>
              <select value={filterEvent} onChange={e=>{ set({filterEvent:e.target.value,page:1}); setPaySel({}); setPayUpMsg(null); }} style={{ width:'100%', maxWidth:320, border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', borderRadius:12, padding:'11px 14px', fontSize:14, color:'var(--text-primary)', outline:'none', fontFamily:"'Karla',sans-serif" }}>
                {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, borderRadius:10, padding:'10px 13px', background:'var(--glass-card)', border:'1px solid var(--glass-card-border)', color:'var(--text-secondary)' }}>
              <Icon name="calendar" size={13} color="#8A6A4A"/>Payment due by {curEv.lastApp ? fmtShort(curEv.lastApp) : 'TBC'}
            </span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, borderRadius:10, padding:'10px 13px', background:'rgba(90,145,110,0.16)', color:'#3F7A54' }}>
              {filteredPayApps.filter(a=>payRec(`${a.vendorId}-${a.eventId}`).status==='paid').length} of {filteredPayApps.length} fully paid
            </span>
          </div>

          {payUpMsg && (
            <div style={{ display:'flex', gap:9, alignItems:'flex-start', background:payUpMsg.count?'rgba(90,145,110,0.14)':'rgba(214,152,66,0.14)', border:`1px solid ${payUpMsg.count?'rgba(90,145,110,0.3)':'rgba(214,152,66,0.3)'}`, borderRadius:14, padding:'11px 13px', marginBottom:14, fontSize:12, color:payUpMsg.count?'#3F7A54':'#9A6A1E', lineHeight:1.5 }}>
              <Icon name={payUpMsg.count?'check':'info'} size={15} color={payUpMsg.count?'#3F7A54':'#9A6A1E'} style={{ marginTop:1 }}/>
              <div style={{ flex:1 }}>
                {payUpMsg.count > 0 && <div><b>{payUpMsg.label}s</b> attached to <b>{payUpMsg.count} vendor(s)</b>. Vendors can view them in their portal.</div>}
                {payUpMsg.unmatched.length > 0 && <div style={{ marginTop:payUpMsg.count?4:0 }}>Folders that didn't match any vendor in this event: <b>{payUpMsg.unmatched.join(', ')}</b>.</div>}
              </div>
              <button onClick={()=>setPayUpMsg(null)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, flexShrink:0 }}><Icon name="x" size={14} color={payUpMsg.count?'#3F7A54':'#9A6A1E'}/></button>
            </div>
          )}

          {/* Payment Records table — glass panel + header-row grid, matching the
              Categories tab's "All Vendors" table exactly (rule 30 in PROJECT_NOTES). */}
          <div style={{ background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:24, padding:'22px 24px 8px', boxSizing:'border-box', boxShadow:'0 20px 50px rgba(58,34,16,0.12)' }}>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap', marginBottom:16 }}>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:19, color:'var(--text-primary)' }}>Payment Records</div>
              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px', borderRadius:12, border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', minWidth:200 }}>
                  <Icon name="search" size={15} color="#9A5B26"/>
                  <input value={vendorSearch} onChange={e=>setVendorSearch(e.target.value)} placeholder="Search vendor…" style={{ border:'none', outline:'none', background:'transparent', fontSize:13.5, color:'var(--text-primary)', width:'100%', fontFamily:"'Karla',sans-serif" }}/>
                </div>
                <div style={{ position:'relative', display:'inline-flex', alignItems:'center', gap:8, padding:'10px 16px', borderRadius:12, border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', color:'var(--text-secondary)', fontSize:13.5, fontWeight:700, cursor:'pointer', fontFamily:"'Karla',sans-serif" }}>
                  <Icon name="sliders" size={14} color="#6B4E33"/>
                  <span style={{ whiteSpace:'nowrap' }}>{payFilter === 'all' ? 'All vendors' : 'New advices'}</span>
                  <select value={payFilter} onChange={e=>{ setPayFilter(e.target.value); setPaySel({}); set({page:1}); }} style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%' }}>
                    <option value="all">All vendors</option>
                    <option value="new">New advices — not downloaded ({approvedApps.filter(a=>{ const r=payRec(`${a.vendorId}-${a.eventId}`); return (r.advice||r.advice2) && !payDocDownloads[`${a.vendorId}-${a.eventId}`]; }).length})</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:8, marginBottom:16 }}>
              <button disabled={zipBusy} onClick={bulkDownloadAdvices} style={{ display:'inline-flex', alignItems:'center', gap:6, background:selectedPayApps.length?'linear-gradient(135deg, #B97434, #7A431A)':'var(--glass-divider)', border:'none', color:selectedPayApps.length?'#FFF8EE':'#B8A48C', fontSize:12, fontWeight:700, borderRadius:10, padding:'9px 14px', cursor:zipBusy?'wait':'pointer', fontFamily:"'Karla',sans-serif" }}>
                <Icon name="download" size={14} color={selectedPayApps.length?'#FFF8EE':'#B8A48C'}/>Bulk download advices{selectedPayApps.length?` (${selectedPayApps.length})`:''}
              </button>
              <label title="Upload a folder with one sub-folder per business name" style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--glass-input)', border:'1px solid var(--glass-chip-border)', color:'var(--text-secondary)', fontSize:12, fontWeight:700, borderRadius:10, padding:'9px 14px', cursor:'pointer', fontFamily:"'Karla',sans-serif" }}>
                <input type="file" webkitdirectory="" directory="" multiple style={{ display:'none' }} onChange={bulkUploadPayDocs('invoice','Invoice')}/>
                <Icon name="upload" size={14} color="#6B4E33"/>Bulk upload invoices
              </label>
              <label title="Upload a folder with one sub-folder per business name" style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--glass-input)', border:'1px solid var(--glass-chip-border)', color:'var(--text-secondary)', fontSize:12, fontWeight:700, borderRadius:10, padding:'9px 14px', cursor:'pointer', fontFamily:"'Karla',sans-serif" }}>
                <input type="file" webkitdirectory="" directory="" multiple style={{ display:'none' }} onChange={bulkUploadPayDocs('receipt','Receipt')}/>
                <Icon name="upload" size={14} color="#6B4E33"/>Bulk upload receipts
              </label>
            </div>

            <div style={{ overflowX:'auto' }}>
            <div style={{ minWidth:820 }}>
            <div style={{ display:'grid', gridTemplateColumns:'26px minmax(0,1.9fr) minmax(0,0.95fr) minmax(0,0.8fr) minmax(0,1.4fr) minmax(0,2fr)', gap:10, alignItems:'center', padding:'0 14px 12px', fontSize:12, fontWeight:700, letterSpacing:'0.06em', color:'var(--text-muted)', textTransform:'uppercase', borderBottom:'1px solid var(--glass-divider)' }}>
              <input type="checkbox" checked={filteredPayApps.length>0 && filteredPayApps.every(a=>paySel[a.id])}
                onChange={()=>{ const all = filteredPayApps.length>0 && filteredPayApps.every(a=>paySel[a.id]); setPaySel(all ? {} : Object.fromEntries(filteredPayApps.map(a=>[a.id,true]))); }}
                style={{ accentColor:'#9A5B26', width:15, height:15, cursor:'pointer' }}/>
              <div>Vendor</div><div>Total Due</div><div>Status</div><div>Documents</div><div style={{ textAlign:'right' }}>Actions</div>
            </div>

            {pagedPayments.length === 0 ? (
              <div style={{ padding:'28px 14px', textAlign:'center', color:'var(--text-muted)', fontSize:13.5 }}>
                {searchQ || payFilter !== 'all' ? 'No vendors match your search or filter.' : 'No approved applications for this event yet.'}
              </div>
            ) : pagedPayments.map((a,idx) => {
              const v = vById(a.vendorId);
              const dep = deposits[a.vendorId]||{status:'unpaid'};
              const calc = payCalc(v, curEv, dep.status, a.tier);
              const payKey = `${a.vendorId}-${curEv.id}`;
              const rec = payRec(payKey);
              const ref = refundRec(payKey);
              const isPartial = rec.status === 'partial';
              const overpaidAmt = rec.paid - calc.total;
              const notice = scanNotice(rec, calc);
              const advDl = payDocDownloads[payKey];
              const docs = [
                { key:'advice', label:'Payment advice', present:!!rec.advice, adminUpload:false },
                ...((isPartial || rec.advice2) ? [{ key:'advice2', label:'2nd payment advice', present:!!rec.advice2, adminUpload:false }] : []),
                { key:'invoice', label:'Invoice', present:!!rec.invoice, adminUpload:true, uploadIcon:'file' },
                { key:'receipt', label:'Receipt', present:!!rec.receipt, adminUpload:true, uploadIcon:'receipt' },
              ];
              const iconBtn = (tone) => ({
                width:30, height:30, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer',
                border: tone==='green' ? '1px solid rgba(90,145,110,0.3)' : tone==='muted' ? '1px solid var(--glass-divider)' : '1px solid var(--glass-chip-border)',
                background: tone==='green' ? 'rgba(90,145,110,0.14)' : tone==='muted' ? 'rgba(154,91,38,0.06)' : 'var(--glass-input)',
              });
              return (
                <div key={a.id} className="dc-row-hover" style={{ borderBottom:'1px solid var(--glass-divider)' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'26px minmax(0,1.9fr) minmax(0,0.95fr) minmax(0,0.8fr) minmax(0,1.4fr) minmax(0,2fr)', gap:10, alignItems:'center', padding:'13px 14px' }}>
                    <input type="checkbox" checked={!!paySel[a.id]} onChange={()=>setPaySel(s=>({...s,[a.id]:!s[a.id]}))} style={{ accentColor:'#9A5B26', width:15, height:15, cursor:'pointer' }}/>
                    <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
                      <VendorAvatar v={v} size={38}/>
                      <div style={{ minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                          <span style={{ fontSize:11, fontWeight:700, color:'#B8A48C' }}>#{(page-1)*PER_PAGE+idx+1}</span>
                          <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.business}</span>
                          {advDl && <span title={`Advices downloaded ${advDl}`} style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, fontWeight:700, color:'#3F7A54', background:'rgba(90,145,110,0.16)', borderRadius:6, padding:'2px 6px', whiteSpace:'nowrap' }}><Icon name="check" size={10} color="#3F7A54"/>DL'd</span>}
                        </div>
                        <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{calc.tier} · RM {calc.rate}/day × {calc.days}d</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text-primary)' }}>RM {money(calc.total)}</div>
                      {isPartial && overpaidAmt<=0 && <div style={{ fontSize:11, fontWeight:600, color:'#C76A0D', marginTop:2 }}>Outstanding RM {money(calc.total-rec.paid)}</div>}
                      {overpaidAmt>0 && <div style={{ fontSize:11, fontWeight:700, color:'#B03A2E', marginTop:2 }}>+RM {money(overpaidAmt)} over</div>}
                    </div>
                    <div><Badge status={rec.status}/></div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      {docs.map(doc => {
                        if (doc.present) return (
                          <button key={doc.key} title={`View ${doc.label.toLowerCase()}`} onClick={()=>set({docPreview:{payKey, field:doc.key, editable:doc.adminUpload}})} style={iconBtn('green')}>
                            <Icon name="eye" size={14} color="#3F7A54"/>
                          </button>
                        );
                        if (doc.adminUpload) return (
                          <label key={doc.key} title={`Upload ${doc.label.toLowerCase()}`} style={iconBtn('outline')}>
                            <input type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={async e=>{
                              const file = e.target.files[0]; e.target.value='';
                              if (!file) return;
                              let uploaded;
                              if (isSupabaseConfigured && v.userId && curEv?.remote) {
                                try { uploaded = await uploadPrivateFile('payment-files', v.userId, file); }
                                catch (err) { showToast("Couldn't upload — " + err.message, 'lock'); return; }
                              } else {
                                uploaded = await fileToPhoto(file);
                              }
                              if (!await savePaymentRecord(payKey, { ...rec, [doc.key]: uploaded }, { vendors, events, dispatch, showToast })) return;
                              logActivity('Admin', `uploaded the ${doc.label.toLowerCase()} for ${v.business} — ${curEv.name}.`, {icon:'file', tint:'var(--tint-green-bg)'});
                              showToast(`${doc.label} uploaded`,'file');
                            }}/>
                            <Icon name={doc.uploadIcon} size={14} color="#6B4E33"/>
                          </label>
                        );
                        return (
                          <span key={doc.key} title={`${doc.label} — not yet uploaded by vendor`} style={iconBtn('muted')}>
                            <Icon name="clock" size={14} color="#B8A48C"/>
                          </span>
                        );
                      })}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:5, flexWrap:'wrap' }}>
                      <button onClick={()=>set({payModalKey:payKey,payf:{amount:String(rec.paid||calc.total)}})} style={{ background:'linear-gradient(135deg, #B97434, #7A431A)', border:'none', color:'#FFF8EE', fontSize:11.5, fontWeight:700, borderRadius:9, padding:'7px 10px', cursor:'pointer', fontFamily:"'Karla',sans-serif", whiteSpace:'nowrap' }}>Record payment</button>
                      <button title="Reset to unpaid" onClick={async ()=>{ if (!await savePaymentRecord(payKey, {...(payments[payKey]||{}),status:'unpaid',paid:0}, { vendors, events, dispatch, showToast })) return; showToast('Reset to unpaid','check'); }} style={{ ...iconBtn('outline'), width:26, height:26 }}><Icon name="x" size={12} color="#6B4E33"/></button>
                      <button title="Send payment reminder" onClick={()=>showToast(`Reminder noted for ${v.business} (demo — real email arrives with Phase 2)`,'bell')} style={{ ...iconBtn('outline'), width:26, height:26 }}><Icon name="bell" size={12} color="#6B4E33"/></button>
                      <button title="Remove from event" onClick={()=>{
                        if (!window.confirm(`Remove ${v.business} from ${curEv.name}? Their approved slot is released and any recorded payment for this event stops being shown.`)) return;
                        removeApp(a,()=>{
                          logActivity('Admin', `removed ${v.business} from ${curEv.name} — slot released.`, {icon:'x', tint:'var(--tint-red-bg)'});
                          showToast(`${v.business} removed — slot released`,'info');
                        });
                      }} style={{ width:26, height:26, borderRadius:9, border:'1px solid rgba(196,74,74,0.3)', background:'rgba(196,74,74,0.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}><Icon name="trash" size={12} color="#B03A2E"/></button>
                    </div>
                  </div>

                  {overpaidAmt > 0 && ref.status !== 'closed' && (
                    <div style={{ margin:'0 14px 13px', background:'rgba(196,74,74,0.08)', border:'1px solid rgba(196,74,74,0.25)', borderRadius:12, padding:'11px 13px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12.5, fontWeight:700, color:'#B03A2E' }}>
                        <Icon name="info" size={14} color="#B03A2E"/>Overpaid by RM {money(overpaidAmt)}
                      </div>
                      {ref.status === 'completed' ? (
                        <>
                          <div style={{ fontSize:11.5, color:'#8a4a3e', marginTop:6 }}>Refund completed · Ref {ref.refCode} · {ref.date} {fmtTime(ref.time)}</div>
                          <button onClick={async ()=>{ if (!await saveRefundRecord(payKey, {...ref,status:'closed'}, { vendors, events, dispatch, showToast })) return; logActivity('Admin', `closed the refund case for ${v.business}'s ${curEv.name} overpayment.`, {icon:'wallet', tint:'var(--tint-blue-bg)'}); showToast('Refund case closed','check'); }} style={{ marginTop:9, background:'var(--glass-input)', border:'1px solid rgba(196,74,74,0.3)', color:'#B03A2E', fontSize:12, fontWeight:600, borderRadius:9, padding:'7px 11px', cursor:'pointer' }}>Close case</button>
                        </>
                      ) : (
                        <button onClick={()=>set({refundModalKey:payKey,reff:{refCode:'',date:'',time:''}})} style={{ marginTop:9, background:'#B03A2E', color:'#fff', border:'none', fontSize:12, fontWeight:600, borderRadius:9, padding:'7px 11px', cursor:'pointer' }}>Arrange refund</button>
                      )}
                    </div>
                  )}
                  {overpaidAmt > 0 && ref.status === 'closed' && (
                    <div style={{ margin:'0 14px 13px', fontSize:11, color:'#B8A48C' }}>Refund closed · Ref {ref.refCode} · {ref.date} {fmtTime(ref.time)}</div>
                  )}
                  {notice && notice.kind === 'unread' && (
                    <div style={{ margin:'0 14px 13px', background:'rgba(154,91,38,0.06)', border:'1px solid var(--glass-divider)', borderRadius:10, padding:'9px 12px', fontSize:11.5, color:'var(--text-muted)', lineHeight:1.45 }}>
                      Auto-scan couldn't read an amount from the vendor's payment advice — verify and record manually.
                    </div>
                  )}
                  {notice && notice.kind === 'match' && (
                    <div style={{ margin:'0 14px 13px', background:'rgba(90,145,110,0.1)', border:'1px solid rgba(90,145,110,0.22)', borderRadius:10, padding:'9px 12px', fontSize:11.5, color:'#3F7A54', lineHeight:1.45 }}>
                      Auto-scan: advice matches the total due (RM {money(notice.scanned)}).{notice.overridden ? ` Recorded amount RM ${money(rec.paid)} was set manually.` : ''}
                    </div>
                  )}
                  {notice && (notice.kind === 'short' || notice.kind === 'over') && (
                    <div style={{ margin:'0 14px 13px', background:'rgba(214,152,66,0.12)', border:'1px solid rgba(214,152,66,0.28)', borderRadius:10, padding:'9px 12px', fontSize:11.5, color:'#9A6A1E', lineHeight:1.45 }}>
                      Auto-scan read RM {money(notice.scanned)} from the advice — {notice.kind==='short' ? `RM ${money(notice.diff)} short of` : `RM ${money(notice.diff)} more than`} the total due.{notice.overridden ? ` Recorded amount RM ${money(rec.paid)} was set manually.` : ' Please double-check.'}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
            </div>

            {/* Sticky footer — pins to the bottom of the page's real scroll container
                (`.scrollarea` in App.jsx) so the pager stays reachable while only the
                rows above scroll past underneath it, instead of scrolling away with
                the rest of the tab's content. */}
            <ModernPager total={filteredPayApps.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}/>
          </div>
          </div>
        </div>
      )}

      {/* ── Deposit Record ── */}
      {aTab === 'deposits' && (() => {
        const drGrid = 'minmax(0,2fr) minmax(0,2.2fr) minmax(0,1fr) minmax(0,1.4fr)';
        const drList = searchVendors(vendors);
        const drPaged = drList.slice((page-1)*PER_PAGE, page*PER_PAGE);
        const statBadge = (bg, color, label, value, sub) => (
          <div style={{ flex:1, minWidth:160, background:bg, borderRadius:14, padding:'13px 16px' }}>
            <div style={{ fontSize:11.5, fontWeight:700, color }}>{label}</div>
            <div style={{ fontFamily:"'Marcellus',serif", fontSize:25, fontWeight:400, color, marginTop:3, lineHeight:1 }}>{value}</div>
            <div style={{ fontSize:10.5, color, opacity:0.75, marginTop:3 }}>{sub}</div>
          </div>
        );
        return (
          <TableShell
            title="Deposit Record" subtitle="The refundable RM100 deposit, tracked once per vendor."
            aboveControls={
              <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:16 }}>
                {statBadge('rgba(90,145,110,0.16)', '#3F7A54', 'Deposits held', `RM ${money(Object.values(deposits).filter(d=>d.status==='paid').length*100)}`, `${Object.values(deposits).filter(d=>d.status==='paid').length} vendors · RM100 each`)}
                {statBadge('rgba(91,127,166,0.16)', '#3D5BC4', 'Refunded', Object.values(deposits).filter(d=>d.status==='refunded').length, 'returned after market')}
              </div>
            }
            panelTitle="Vendor Deposits"
            searchValue={vendorSearch} onSearchChange={setVendorSearch} searchPlaceholder="Search by business or owner name"
            headerCells={<><div>Vendor</div><div>Deposit history</div><div>Status</div><div style={{ textAlign:'right' }}>Actions</div></>}
            gridTemplate={drGrid} minWidth={780}
            isEmpty={drPaged.length===0}
            emptyMessage={`No vendors match "${vendorSearch}".`}
            total={drList.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}
          >
            {drPaged.map((v,idx) => {
              const dep = depRec(v.id);
              return (
                <div key={v.id} className="dc-row-hover" style={{ display:'grid', gridTemplateColumns:drGrid, gap:10, alignItems:'center', padding:'13px 14px', borderBottom:'1px solid var(--glass-divider)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                    <VendorAvatar v={v} size={34}/>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}><span style={{ fontSize:11, fontWeight:700, color:'#B8A48C', marginRight:6 }}>#{(page-1)*PER_PAGE+idx+1}</span>{v.business}</div>
                      <div style={{ fontSize:11.5, color:'var(--text-muted)' }}>{v.owner}</div>
                    </div>
                  </div>
                  <div style={{ fontSize:11.5, color:'var(--text-secondary)', display:'flex', flexWrap:'wrap', gap:'4px 12px' }}>
                    <span>Invoice <b style={{ color:'var(--text-primary)' }}>{dep.inv||'—'}</b></span>
                    <span>Paid <b style={{ color:'var(--text-primary)' }}>{dep.payDate||'—'}</b></span>
                    <span>Refunded <b style={{ color:'var(--text-primary)' }}>{dep.refundDate||'—'}</b></span>
                  </div>
                  <div><Badge status={dep.status}/></div>
                  <div style={{ display:'flex', justifyContent:'flex-end' }}>
                    <button onClick={()=>{ const d=depRec(v.id); set({depModalVendor:v.id,depf:{...d}}); }} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--glass-input)', border:'1px solid var(--glass-chip-border)', color:'var(--text-secondary)', fontSize:12, fontWeight:700, borderRadius:9, padding:'8px 12px', cursor:'pointer' }}>
                      <Icon name="pencil" size={13} color="#6B4E33"/>Update
                    </button>
                  </div>
                </div>
              );
            })}
          </TableShell>
        );
      })()}

      {/* ── Parking ── */}
      {aTab === 'parking' && (() => {
        const ev = curEv;
        const start = ev.startDate ? new Date(ev.startDate) : null;
        const end   = ev.endDate   ? new Date(ev.endDate)   : null;
        const inEvent = start && end && today >= start && today <= end;
        const editable = inEvent || parkOverride;
        const pkGrid = 'minmax(0,2.1fr) minmax(0,1fr) minmax(0,3fr)';
        return (
          <TableShell
            title="Parking" subtitle="Per-day parking serials for approved applicants of the selected event."
            aboveControls={
              <>
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Select event</div>
                  <select value={filterEvent} onChange={e=>set({filterEvent:e.target.value,page:1})} style={{ width:'100%', maxWidth:320, border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', borderRadius:12, padding:'11px 14px', fontSize:14, color:'var(--text-primary)', outline:'none', fontFamily:"'Karla',sans-serif" }}>
                    {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:9, background:editable?'rgba(90,145,110,0.14)':'rgba(214,152,66,0.14)', border:`1px solid ${editable?'rgba(90,145,110,0.3)':'rgba(214,152,66,0.3)'}`, borderRadius:12, padding:'11px 13px', marginBottom:16 }}>
                  <Icon name={editable?'check':'lock'} size={15} color={editable?'#3F7A54':'#9A6A1E'}/>
                  <div style={{ flex:1, fontSize:12, fontWeight:600, color:editable?'#3F7A54':'#9A6A1E', lineHeight:1.4 }}>
                    {editable ? 'Entry is open — market is currently in progress.' : 'Locked — serial entry is only available during the event dates.'}
                  </div>
                  <button onClick={()=>set({parkOverride:!parkOverride})} style={{ flexShrink:0, background:'var(--glass-input)', border:`1px solid ${editable?'rgba(90,145,110,0.3)':'rgba(214,152,66,0.3)'}`, color:editable?'#3F7A54':'#9A6A1E', fontSize:11, fontWeight:700, borderRadius:8, padding:'6px 10px', cursor:'pointer' }}>
                    {parkOverride ? 'Lock' : 'Override'}
                  </button>
                </div>
              </>
            }
            panelTitle="Vendor Parking"
            searchValue={vendorSearch} onSearchChange={setVendorSearch} searchPlaceholder="Search by business or owner name"
            headerCells={<><div>Vendor</div><div>Plate</div><div>Daily serials</div></>}
            gridTemplate={pkGrid} minWidth={720}
            isEmpty={pagedPark.length===0}
            emptyMessage={searchQ ? `No vendors match "${vendorSearch}".` : 'No approved applicants for this event yet.'}
            total={searchedApprovedApps.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}
          >
            {pagedPark.map((a,idx) => {
              const v = vById(a.vendorId);
              const cells = Array.from({length:ev.days||1},(_,i)=>({
                dayLabel:`Day ${i+1}`, key:`${a.vendorId}-${ev.id}-${i+1}`, dayIndex:i+1,
                value: parking[`${a.vendorId}-${ev.id}-${i+1}`]||'',
              }));
              return (
                <div key={a.id} className="dc-row-hover" style={{ display:'grid', gridTemplateColumns:pkGrid, gap:10, alignItems:'center', padding:'13px 14px', borderBottom:'1px solid var(--glass-divider)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                    <VendorAvatar v={v} size={34}/>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}><span style={{ fontSize:11, fontWeight:700, color:'#B8A48C', marginRight:6 }}>#{(page-1)*PER_PAGE+idx+1}</span>{v.business}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>Vehicle owner on record</div>
                    </div>
                  </div>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11.5, fontWeight:700, color:'var(--text-secondary)', background:'var(--glass-divider)', borderRadius:6, padding:'4px 9px', flexShrink:0, width:'fit-content' }}>
                    <Icon name="car" size={13} color="#6B4E33"/>{v.plate}
                  </span>
                  <div style={{ display:'flex', gap:8 }}>
                    {cells.map(c => (
                      <div key={c.key} style={{ flex:1, minWidth:70 }}>
                        <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:4, textAlign:'center' }}>{c.dayLabel}</div>
                        <input value={c.value} disabled={!editable} onChange={e=>{ const p={...parking}; p[c.key]=e.target.value; dispatch({type:'MERGE_PARKING',payload:p}); }} onBlur={async e=>{
                          if (!isSupabaseConfigured || !v.userId || !ev.remote) return;
                          try { await upsertParkingSerial(a.vendorId, ev.id, c.dayIndex, e.target.value); }
                          catch (err) { showToast("Couldn't save — " + err.message, 'lock'); }
                        }} placeholder="—" style={{ width:'100%', border:'1px solid var(--glass-chip-border)', background:editable?'var(--glass-input)':'rgba(154,91,38,0.06)', borderRadius:9, padding:'9px 8px', fontSize:13, fontWeight:700, textAlign:'center', outline:'none', color:'var(--text-primary)', cursor:editable?'text':'not-allowed' }}/>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </TableShell>
        );
      })()}

      {/* ── Event Pictures ── */}
      {aTab === 'photos' && (() => {
        const epGrid = '26px minmax(0,2.5fr) minmax(0,1.8fr)';
        return (
        <TableShell
          title="Event Pictures" subtitle="Vendor product photos come from their profile. Booth sharers are grouped with the main vendor."
          aboveControls={
            <div style={{ marginBottom:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Select event</div>
              <select value={filterEvent} onChange={e=>{ set({filterEvent:e.target.value,page:1}); setPhotoSel({}); setBulkUpMsg(null); }} style={{ width:'100%', maxWidth:320, border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', borderRadius:12, padding:'11px 14px', fontSize:14, color:'var(--text-primary)', outline:'none', fontFamily:"'Karla',sans-serif", marginBottom:16 }}>
                {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          }
          banner={bulkUpMsg && (
            <div style={{ display:'flex', gap:9, alignItems:'flex-start', background:bulkUpMsg.count?'rgba(90,145,110,0.14)':'rgba(214,152,66,0.14)', border:`1px solid ${bulkUpMsg.count?'rgba(90,145,110,0.3)':'rgba(214,152,66,0.3)'}`, borderRadius:14, padding:'11px 13px', marginBottom:14, fontSize:12, color:bulkUpMsg.count?'#3F7A54':'#9A6A1E', lineHeight:1.5 }}>
              <Icon name={bulkUpMsg.count?'check':'info'} size={15} color={bulkUpMsg.count?'#3F7A54':'#9A6A1E'} style={{ marginTop:1 }}/>
              <div style={{ flex:1 }}>
                {bulkUpMsg.count > 0 && <div><b>{bulkUpMsg.count} photo(s)</b> uploaded to <b>{bulkUpMsg.vendors} vendor(s)</b>. Vendors can now download them from their portal.</div>}
                {bulkUpMsg.unmatched.length > 0 && <div style={{ marginTop:bulkUpMsg.count?4:0 }}>Folders that didn't match any vendor in this event: <b>{bulkUpMsg.unmatched.join(', ')}</b>. Rename them to the exact business name and try again.</div>}
              </div>
              <button onClick={()=>setBulkUpMsg(null)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, flexShrink:0 }}><Icon name="x" size={14} color={bulkUpMsg.count?'#3F7A54':'#9A6A1E'}/></button>
            </div>
          )}
          panelTitle="Booth Groups"
          searchValue={vendorSearch} onSearchChange={setVendorSearch} searchPlaceholder="Search by business or owner name"
          filterControl={<FilterPill label={photoFilter==='all'?'All vendors':'New — not downloaded'} value={photoFilter} onChange={v=>{ setPhotoFilter(v); setPhotoSel({}); set({page:1}); }} options={[['all','All vendors'],['new',`New — not downloaded (${boothGroups.filter(g=>!groupDownloaded(g)).length})`]]}/>}
          toolbar={
            <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:8, marginBottom:16 }}>
              <label style={{ display:'inline-flex', alignItems:'center', gap:7, fontSize:12, fontWeight:700, color:'var(--text-secondary)', cursor:'pointer', background:'var(--glass-input)', border:'1px solid var(--glass-chip-border)', borderRadius:9, padding:'8px 12px' }}>
                <input type="checkbox" style={{ accentColor:'#9A5B26', width:15, height:15, cursor:'pointer' }}
                  checked={filteredGroups.length>0 && filteredGroups.every(g=>photoSel[g.id])}
                  onChange={()=>{ const all = filteredGroups.length>0 && filteredGroups.every(g=>photoSel[g.id]); setPhotoSel(all ? {} : Object.fromEntries(filteredGroups.map(g=>[g.id,true]))); }}/>
                Select all
              </label>
              <button disabled={zipBusy} onClick={bulkDownloadSel} style={{ display:'inline-flex', alignItems:'center', gap:6, background:selectedGroups.length?'linear-gradient(135deg, #B97434, #7A431A)':'var(--glass-divider)', border:'none', color:selectedGroups.length?'#FFF8EE':'#B8A48C', fontSize:12, fontWeight:700, borderRadius:9, padding:'9px 14px', cursor:zipBusy?'wait':'pointer' }}>
                <Icon name="download" size={14} color={selectedGroups.length?'#FFF8EE':'#B8A48C'}/>Bulk download{selectedGroups.length?` (${selectedGroups.length})`:''}
              </button>
              <label title="Upload a folder containing one sub-folder per business name" style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--glass-input)', border:'1px solid var(--glass-chip-border)', color:'var(--text-secondary)', fontSize:12, fontWeight:700, borderRadius:9, padding:'9px 14px', cursor:'pointer' }}>
                <input type="file" webkitdirectory="" directory="" multiple style={{ display:'none' }} onChange={handleBulkUpload}/>
                <Icon name="upload" size={14} color="#6B4E33"/>Bulk upload
              </label>
            </div>
          }
          headerCells={<><div/><div>Vendor</div><div>Booth</div></>}
          gridTemplate={epGrid} minWidth={620}
          isEmpty={pagedGroups.length===0}
          emptyMessage={searchQ ? `No vendors match "${vendorSearch}".` : photoFilter==='new' ? 'All booths for this event have been downloaded — nothing new.' : 'No approved vendors for this event yet.'}
          total={filteredGroups.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}
        >
          {pagedGroups.map((g,idx) => {
            const isSel = !!photoSel[g.id];
            const mainV = vById(g.members[0]);
            return (
              <div key={g.id} className="dc-row-hover" style={{ borderBottom:'1px solid var(--glass-divider)' }}>
                <div style={{ display:'grid', gridTemplateColumns:epGrid, gap:10, alignItems:'center', padding:'13px 14px' }}>
                  <input type="checkbox" checked={isSel} onChange={()=>setPhotoSel(s=>({...s,[g.id]:!s[g.id]}))} style={{ accentColor:'#9A5B26', width:15, height:15, cursor:'pointer' }}/>
                  <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                    <VendorAvatar v={mainV} size={34}/>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}><span style={{ fontSize:11, fontWeight:700, color:'#B8A48C', marginRight:6 }}>#{(page-1)*PER_PAGE+idx+1}</span>{mainV.business}</div>
                  </div>
                  <div>
                    {g.shared && (
                      <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, color:'#9A5B26', background:'var(--glass-divider)', borderRadius:999, padding:'4px 10px' }}>
                        <Icon name="users" size={12} color="#9A5B26"/>Shared · {g.members.length} vendors
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ margin:'0 14px 14px' }}>
                  {g.members.map((vid, mi) => {
                    const v = vById(vid);
                    const key = `${vid}-${filterEvent}`;
                    const dl = photoDownloads[key];
                    const adminPhotos = eventPhotos[key] || [];
                    return (
                      <div key={vid} style={{ marginTop:mi>0?12:0, paddingTop:mi>0?12:0, borderTop:mi>0?'1px dashed var(--glass-card-border)':'none' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                          <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{v.business}</span>
                          {mi>0 && <span style={{ fontSize:10.5, fontWeight:700, color:'var(--text-muted)', background:'rgba(154,91,38,0.08)', borderRadius:6, padding:'2px 7px' }}>Booth sharer</span>}
                          {dl && <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10.5, fontWeight:700, color:'#3F7A54', background:'rgba(90,145,110,0.16)', borderRadius:6, padding:'2px 7px' }}><Icon name="check" size={11} color="#3F7A54"/>Downloaded {dl}</span>}
                          <div style={{ flex:1 }}/>
                          <button disabled={zipBusy} onClick={()=>downloadVendorZip(v)} style={{ display:'inline-flex', alignItems:'center', gap:5, background:'var(--glass-input)', border:'1px solid var(--glass-chip-border)', color:'var(--text-secondary)', fontSize:11.5, fontWeight:700, borderRadius:9, padding:'6px 10px', cursor:zipBusy?'wait':'pointer', flexShrink:0 }}>
                            <Icon name="download" size={12} color="#6B4E33"/>Download ({(v.productPhotos||[]).length})
                          </button>
                        </div>
                        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginTop:9 }}>Product photos ({(v.productPhotos||[]).length}) — from vendor profile</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginTop:6 }}>
                          {(v.productPhotos||[]).map(ph=><PhotoTile key={ph.id} photo={ph} size={64}/>)}
                          {!(v.productPhotos||[]).length && <span style={{ fontSize:11.5, color:'var(--text-muted)' }}>None uploaded yet.</span>}
                        </div>
                        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginTop:11 }}>Event photos for vendor ({adminPhotos.length}) — vendor downloads these</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginTop:6, alignItems:'center' }}>
                          {adminPhotos.map(ph => (
                            <PhotoTile key={ph.id} photo={ph} size={64} onRemove={()=>{
                              dispatch({type:'MERGE_PHOTOS', payload:{ [key]: adminPhotos.filter(x=>x.id!==ph.id) }});
                              showToast('Photo removed','x');
                            }}/>
                          ))}
                          <label style={{ width:64, height:64, borderRadius:10, border:'2px dashed rgba(154,91,38,0.3)', background:'rgba(154,91,38,0.06)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, cursor:'pointer', flexShrink:0 }}>
                            <input type="file" accept="image/*" multiple style={{ display:'none' }} onChange={async e => {
                              const files = [...e.target.files]; e.target.value = '';
                              if (!files.length) return;
                              const added = await Promise.all(files.map(fileToPhoto));
                              dispatch({type:'MERGE_PHOTOS', payload:{ [key]: [...adminPhotos, ...added] }});
                              logActivity('Admin', `uploaded ${added.length} event photo(s) for ${v.business} — ${curEv.name}.`, {icon:'upload', tint:'var(--tint-green-bg)'});
                              showToast(`${added.length} photo(s) uploaded for ${v.business}`,'image');
                            }}/>
                            <Icon name="upload" size={16} color="#9A5B26"/><span style={{ fontSize:8.5, fontWeight:700, color:'#9A5B26' }}>Upload</span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </TableShell>
        );
      })()}

      {/* ── Vendor Pass ── */}
      {aTab === 'pass' && (() => {
        const vpGrid = 'minmax(0,2.2fr) minmax(0,1.6fr) minmax(0,1.4fr)';
        return (
        <TableShell
          title="Vendor Pass" subtitle="Digital pass applications for approved vendors, grouped by event."
          aboveControls={
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:12, marginBottom:16, flexWrap:'wrap' }}>
              <div style={{ flex:'1 1 240px', minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Select event</div>
                <select value={filterEvent} onChange={e=>set({filterEvent:e.target.value,page:1})} style={{ width:'100%', border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', borderRadius:12, padding:'11px 14px', fontSize:14, color:'var(--text-primary)', outline:'none', fontFamily:"'Karla',sans-serif" }}>
                  {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <button
                disabled={passReportBusy}
                onClick={async ()=>{
                  setPassReportBusy(true);
                  try {
                    await downloadPassReport(curEv, passApps, vendors);
                    logActivity('Admin', `exported the Vendor Pass report for ${curEv.name}.`, { icon:'download', tint:'var(--tint-blue-bg)' });
                    showToast('Vendor Pass report downloaded','download');
                  } finally { setPassReportBusy(false); }
                }}
                style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 18px', border:'1px solid var(--glass-chip-border)', borderRadius:999, fontSize:13, fontWeight:700, color:'var(--text-secondary)', background:'var(--glass-input)', cursor: passReportBusy?'default':'pointer', flexShrink:0, fontFamily:"'Karla',sans-serif" }}>
                <Icon name="download" size={14} color="#6B4E33"/>{passReportBusy ? 'Preparing…' : 'Export report (PDF)'}
              </button>
            </div>
          }
          panelTitle="Pass Applications"
          searchValue={vendorSearch} onSearchChange={setVendorSearch} searchPlaceholder="Search by business or owner name"
          headerCells={<><div>Vendor</div><div>Booth number</div><div>Summary</div></>}
          gridTemplate={vpGrid} minWidth={680}
          isEmpty={pagedPass.length===0}
          emptyMessage={searchQ ? `No vendors match "${vendorSearch}".` : 'No approved applicants for this event yet.'}
          total={searchedApprovedApps.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}
        >
          {pagedPass.map((a,idx) => {
            const v = vById(a.vendorId);
            const ev = events.find(e=>e.id===a.eventId) || {};
            const passApp = passApps.find(p=>p.vendorId===a.vendorId && p.eventId===a.eventId);

            const decidePerson = async (person, status, rejectReason=null) => {
              if (isSupabaseConfigured && passApp.remote) {
                try { await decidePassPerson(person.id, status, rejectReason); }
                catch (e) { showToast("Couldn't save — " + e.message, 'lock'); return; }
              }
              dispatch({ type:'MERGE_PASS_APPS', payload: passApps.map(p=>p.id===passApp.id ? { ...p, people: p.people.map(pp=>pp.id===person.id ? { ...pp, status, rejectReason, decidedAt: fmtShort(new Date()) } : pp) } : p) });
              logActivity('Admin', `${status==='approved'?'approved':'rejected'} ${person.name}'s Vendor Pass — ${v.business}, ${ev.name}.${status==='rejected' && rejectReason ? ` Reason: ${rejectReason}` : ''}`, { icon: status==='approved'?'check':'x', tint: status==='approved'?'var(--tint-green-bg)':'var(--tint-red-bg)' });
              showToast(`Pass ${status}`, status==='approved'?'check':'x');
              setRejectingPersonId(null); setRejectReasonKey(''); setRejectReasonOther('');
            };
            const confirmReject = (person) => {
              const reason = rejectReasonKey === 'other' ? rejectReasonOther.trim() : PASS_REJECT_REASONS[rejectReasonKey];
              if (!reason) { showToast('Pick a reason (or describe one) first','info'); return; }
              decidePerson(person, 'rejected', reason);
            };
            const updateBooth = async (val) => {
              if (isSupabaseConfigured && passApp.remote) {
                try { await updatePassBooth(passApp.id, val); }
                catch (e) { showToast("Couldn't save — " + e.message, 'lock'); return; }
              }
              dispatch({ type:'MERGE_PASS_APPS', payload: passApps.map(p=>p.id===passApp.id ? { ...p, boothNumber:val } : p) });
            };
            const confirmAddPass = async () => {
              const count = Number(addPassCount) || 1;
              const nextExtra = (passApp.extraApproved||0)+count;
              if (isSupabaseConfigured && passApp.remote) {
                try { await grantExtraPassSlots(passApp.id, nextExtra); }
                catch (e) { showToast("Couldn't save — " + e.message, 'lock'); return; }
              }
              dispatch({ type:'MERGE_PASS_APPS', payload: passApps.map(p=>p.id===passApp.id ? { ...p, extraApproved:nextExtra } : p) });
              logActivity('Admin', `granted ${v.business} ${count} additional Vendor Pass slot${count>1?'s':''} — ${ev.name}.`, { icon:'badge', tint:'var(--tint-green-bg)' });
              showToast(`${count} additional pass slot${count>1?'s':''} granted`,'check');
              setAddingPassFor(null); setAddPassCount(1);
            };

            const statusCounts = passApp ? passApp.people.reduce((m,p)=>{ m[p.status]=(m[p.status]||0)+1; return m; }, {}) : {};
            const summaryParts = ['approved','pending','rejected'].filter(s=>statusCounts[s]).map(s=>`${statusCounts[s]} ${s}`);

            return (
              <div key={a.id} className="dc-row-hover" style={{ borderBottom:'1px solid var(--glass-divider)' }}>
                <div style={{ display:'grid', gridTemplateColumns:vpGrid, gap:10, alignItems:'center', padding:'13px 14px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                    <VendorAvatar v={v} size={36}/>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}><span style={{ fontSize:11, fontWeight:700, color:'#B8A48C', marginRight:6 }}>#{(page-1)*PER_PAGE+idx+1}</span>{v.business}</div>
                  </div>
                  <div>
                    {passApp ? (
                      <input value={passApp.boothNumber||''} onChange={e=>updateBooth(e.target.value)} placeholder="e.g. A12" style={{ width:'100%', maxWidth:140, border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', borderRadius:9, padding:'8px 10px', fontSize:13, color:'var(--text-primary)', outline:'none' }}/>
                    ) : <span style={{ fontSize:12, color:'#B8A48C' }}>—</span>}
                  </div>
                  <div style={{ fontSize:11.5, color:'var(--text-secondary)' }}>
                    {!passApp ? 'No application yet' : `${passApp.people.length} holder${passApp.people.length!==1?'s':''}${summaryParts.length?` · ${summaryParts.join(', ')}`:''}${passApp.extraApproved?` · +${passApp.extraApproved} extra`:''}`}
                  </div>
                </div>

                {passApp && (
                  <div style={{ margin:'0 14px 14px' }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                      {passApp.people.map(p => (
                        <div key={p.id} style={{ background:'rgba(154,91,38,0.06)', borderRadius:12, padding:'9px 10px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div {...clickable(()=>set({passPhotoPreview:{name:p.name, photo:p.photo}}))} title="View uploaded photo" style={{ display:'flex', alignItems:'center', gap:7, flex:1, minWidth:0, cursor:'pointer' }}>
                              <PhotoTile photo={p.photo} size={34}/>
                              <span style={{ fontSize:12.5, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                              <Icon name="eye" size={12} color="#8A6A4A"/>
                            </div>
                            <Badge status={p.status}/>
                          </div>

                          {p.status === 'rejected' && p.rejectReason && (
                            <div style={{ fontSize:11.5, color:'#B03A2E', marginTop:7, lineHeight:1.4 }}>Reason: {p.rejectReason}</div>
                          )}

                          {p.status === 'pending' && rejectingPersonId !== p.id && (
                            <div style={{ display:'flex', gap:8, marginTop:9 }}>
                              <button onClick={()=>decidePerson(p, 'approved')} style={{ flex:1, background:'rgba(90,145,110,0.16)', border:'none', color:'#3F7A54', fontSize:12, fontWeight:700, borderRadius:9, padding:'8px 12px', cursor:'pointer' }}>Approve</button>
                              <button onClick={()=>{ setRejectingPersonId(p.id); setRejectReasonKey(''); setRejectReasonOther(''); }} style={{ flex:1, background:'rgba(196,74,74,0.1)', border:'none', color:'#B03A2E', fontSize:12, fontWeight:700, borderRadius:9, padding:'8px 12px', cursor:'pointer' }}>Reject</button>
                            </div>
                          )}

                          {rejectingPersonId === p.id && (
                            <div style={{ marginTop:9, background:'var(--glass-input)', border:'1px solid var(--glass-chip-border)', borderRadius:10, padding:10 }}>
                              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-primary)', marginBottom:7 }}>Why reject {p.name}'s photo?</div>
                              <select value={rejectReasonKey} onChange={e=>setRejectReasonKey(e.target.value)} style={{ width:'100%', border:'1px solid var(--glass-chip-border)', background:'var(--glass-card-solid)', borderRadius:9, padding:'8px 9px', fontSize:12.5, color:'var(--text-primary)', outline:'none' }}>
                                <option value="">Select a reason…</option>
                                {Object.entries(PASS_REJECT_REASONS).map(([k,label]) => <option key={k} value={k}>{label}</option>)}
                              </select>
                              {rejectReasonKey === 'other' && (
                                <textarea value={rejectReasonOther} onChange={e=>setRejectReasonOther(e.target.value)} placeholder="Describe the reason" style={{ width:'100%', border:'1px solid var(--glass-chip-border)', background:'var(--glass-card-solid)', borderRadius:9, padding:'8px 9px', fontSize:12.5, color:'var(--text-primary)', outline:'none', marginTop:8, minHeight:52, resize:'none', boxSizing:'border-box' }}/>
                              )}
                              <div style={{ display:'flex', gap:8, marginTop:9 }}>
                                <button onClick={()=>{ setRejectingPersonId(null); setRejectReasonKey(''); setRejectReasonOther(''); }} style={{ flex:1, background:'rgba(154,91,38,0.08)', border:'1px solid var(--glass-chip-border)', color:'var(--text-secondary)', fontSize:12, fontWeight:700, borderRadius:9, padding:'8px 12px', cursor:'pointer' }}>Cancel</button>
                                <button onClick={()=>confirmReject(p)} style={{ flex:1, background:'rgba(196,74,74,0.1)', border:'none', color:'#B03A2E', fontSize:12, fontWeight:700, borderRadius:9, padding:'8px 12px', cursor:'pointer' }}>Confirm reject</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {addingPassFor === passApp.id ? (
                      <div style={{ marginTop:12, background:'rgba(154,91,38,0.06)', borderRadius:12, padding:10 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-primary)', marginBottom:7 }}>How many additional pass slots to grant?</div>
                        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                          <input type="number" min={1} value={addPassCount} onChange={e=>setAddPassCount(e.target.value)} style={{ width:70, border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', borderRadius:9, padding:'8px 9px', fontSize:13, color:'var(--text-primary)', outline:'none' }}/>
                          <button onClick={()=>{ setAddingPassFor(null); setAddPassCount(1); }} style={{ flex:1, background:'rgba(154,91,38,0.08)', border:'1px solid var(--glass-chip-border)', color:'var(--text-secondary)', fontSize:12, fontWeight:700, borderRadius:9, padding:'8px 12px', cursor:'pointer' }}>Cancel</button>
                          <button onClick={confirmAddPass} style={{ flex:1, background:'rgba(90,145,110,0.16)', border:'none', color:'#3F7A54', fontSize:12, fontWeight:700, borderRadius:9, padding:'8px 12px', cursor:'pointer' }}>Grant</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={()=>{ setAddingPassFor(passApp.id); setAddPassCount(1); }} style={{ marginTop:12, display:'inline-flex', alignItems:'center', gap:6, background:'rgba(154,91,38,0.06)', border:'1px solid var(--glass-chip-border)', color:'var(--text-secondary)', fontSize:12, fontWeight:700, borderRadius:9, padding:'8px 12px', cursor:'pointer' }}>
                        <Icon name="plus" size={13} color="#6B4E33"/>Add pass
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </TableShell>
        );
      })()}

      {/* ── Categories ── */}
      {aTab === 'categories' && (
        <div style={{ position:'relative', padding:'28px 24px 32px', minHeight:560 }}>
          {/* Decorative ambient glow — matches the design handoff (Canvas-4.dc.html).
              Clipped by its own absolutely-positioned layer (not `overflow:hidden` on
              this whole tab wrapper) so the sticky pagination footer below can still
              stick to the real page scroll container — any `overflow` value other than
              `visible` on an ancestor between a sticky element and its scrolling
              container silently defeats `position:sticky` (see rule 35). */}
          <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
            <div style={{ position:'absolute', top:-120, right:-80, width:420, height:420, borderRadius:'50%', background:'radial-gradient(circle at 40% 40%, rgba(233,160,92,0.35), transparent 70%)', filter:'blur(50px)' }}/>
            <div style={{ position:'absolute', bottom:-160, left:-100, width:460, height:460, borderRadius:'50%', background:'radial-gradient(circle at 40% 40%, var(--glass-chip-border), transparent 70%)', filter:'blur(60px)' }}/>
          </div>

          <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:20, flexWrap:'wrap', marginBottom:26 }}>
            <div>
              <div style={{ fontFamily:"'Marcellus',serif", fontWeight:400, fontSize:26, margin:'0 0 6px', color:'var(--text-primary)' }}>Categories</div>
              <div style={{ margin:0, fontSize:14, color:'var(--text-muted)' }}>Manage vendor categories and browse every registered vendor.</div>
            </div>
            <button onClick={()=>set({catEditId:'new'})} style={{ display:'flex', alignItems:'center', gap:8, padding:'13px 22px', border:'none', borderRadius:999, fontSize:14.5, fontWeight:700, color:'#FFF8EE', background:'linear-gradient(135deg, #B97434 0%, #7A431A 100%)', boxShadow:'0 8px 20px rgba(122,67,26,0.35)', cursor:'pointer', fontFamily:"'Karla',sans-serif" }}>
              <Icon name="plus" size={15} color="#FFF8EE"/>Add New Category
            </button>
          </div>

          {/* Category Editor Modal */}
          {state.catEditId && (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }} onClick={closeCatEditor}>
              <div ref={catDialogRef} onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label={state.catEditId==='new'?'Add Category':'Edit Category'} tabIndex={-1} style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:20, maxWidth:420, width:'90%', maxHeight:'80vh', overflow:'hidden', display:'flex', flexDirection:'column', outline:'none' }}>
                <div className="themed-scroll" style={{ overflowY:'auto', padding:24 }}>
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
                        <button key={ic} onClick={()=>set({cf:{...state.cf,icon:ic}})} style={{ width:'100%', aspectRatio:'1/1', border:`2px solid ${state.cf?.icon===ic?'#9A5B26':'var(--border-medium)'}`, background:state.cf?.icon===ic?'var(--tint-pink-bg)':'var(--bg-card)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                          <Icon name={ic} size={18} color={state.cf?.icon===ic?'#9A5B26':'var(--text-secondary)'}/>
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
                    }} style={{ flex:1, background:'#9A5B26', border:'none', fontSize:14, fontWeight:600, borderRadius:11, padding:'11px 16px', cursor:'pointer', color:'#FAF8F5' }}>Save</button>
                  </div>
                </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display:'flex', alignItems:'stretch', gap:24, flexWrap:'wrap' }}>

            {/* LEFT — All Vendors table */}
            <div style={{ flex:'1 1 640px', minWidth:340, background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:24, padding:'22px 24px 8px', boxSizing:'border-box', boxShadow:'0 20px 50px rgba(58,34,16,0.12)' }}>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap', marginBottom:18 }}>
                <div style={{ fontFamily:"'Marcellus',serif", fontSize:19, color:'var(--text-primary)' }}>All Vendors</div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px', borderRadius:12, border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', minWidth:220 }}>
                    <Icon name="search" size={15} color="#9A5B26"/>
                    <input value={vendorSearch} onChange={e=>setVendorSearch(e.target.value)} placeholder="Search Vendor…" style={{ border:'none', outline:'none', background:'transparent', fontSize:13.5, color:'var(--text-primary)', width:'100%', fontFamily:"'Karla',sans-serif" }}/>
                  </div>
                  <div style={{ position:'relative', display:'inline-flex', alignItems:'center', gap:8, padding:'10px 16px', borderRadius:12, border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', color:'var(--text-secondary)', fontSize:13.5, fontWeight:700, cursor:'pointer', fontFamily:"'Karla',sans-serif" }}>
                    <Icon name="sliders" size={14} color="#6B4E33"/>
                    <span style={{ whiteSpace:'nowrap' }}>{catFilter === 'all' ? 'Filters' : catFilter}</span>
                    <select value={catFilter} onChange={e=>set({catFilter:e.target.value, page:1})} style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%' }}>
                      <option value="all">All categories</option>
                      {cats.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'minmax(0,2.1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 40px', gap:10, padding:'0 14px 12px', fontSize:12, fontWeight:700, letterSpacing:'0.06em', color:'var(--text-muted)', textTransform:'uppercase', borderBottom:'1px solid var(--glass-divider)' }}>
                <div>Vendor Name</div><div>Categories</div><div>Joined Since</div><div>Market Joined</div><div/>
              </div>

              {pagedCatVendors.length === 0 ? (
                <div style={{ padding:'28px 14px', textAlign:'center', color:'var(--text-muted)', fontSize:13.5 }}>
                  {searchedCatVendors.length === 0 && (vendorSearch || catFilter !== 'all') ? 'No vendors match your search or filter.' : 'No vendors yet.'}
                </div>
              ) : pagedCatVendors.map(v => {
                const history = vendorHistory(v.id);
                return (
                  <div key={v.id} className="dc-row-hover" style={{ display:'grid', gridTemplateColumns:'minmax(0,2.1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 40px', gap:10, alignItems:'center', padding:'14px 14px', borderBottom:'1px solid var(--glass-divider)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
                      <VendorAvatar v={v} size={38}/>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.business}</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.owner}</div>
                      </div>
                    </div>
                    <div style={{ minWidth:0, overflow:'hidden' }}><span style={{ display:'inline-block', maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', padding:'5px 12px', borderRadius:999, fontSize:12, fontWeight:700, background:'var(--glass-divider)', color:'#9A5B26', whiteSpace:'nowrap' }}>{v.category}</span></div>
                    <div style={{ fontSize:13.5, color:'var(--text-secondary)' }}>{v.regDate}</div>
                    <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text-primary)' }}>{history.total} market{history.total===1?'':'s'}</div>
                    <div style={{ display:'flex', justifyContent:'flex-end' }}>
                      <button onClick={()=>set({vendorDetailId:v.id, vendorDetailReturnAppId:null})} title="View Profile" style={{ width:30, height:30, borderRadius:9, border:'none', background:'transparent', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Icon name="kebab" size={16} color="#8A6A4A"/>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Sticky footer, scoped to this left panel only — sits in its own
                  column, so it can't visually collide with the right panel's card
                  next to it (rule 35's sticky-footer treatment, applied here too). */}
              <ModernPager total={searchedCatVendors.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}/>
            </div>

            {/* RIGHT — Category side panel */}
            <div style={{ flex:'0 1 340px', minWidth:280, background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:24, padding:22, boxSizing:'border-box', boxShadow:'0 20px 50px rgba(58,34,16,0.12)', display:'flex', flexDirection:'column' }}>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:19, color:'var(--text-primary)', marginBottom:16 }}>Categories That We Have So Far….</div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {cats.map(c => {
                  const count = vendors.filter(v=>v.category===c.name).length;
                  return (
                    <div key={c.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:16, border:'1px solid var(--glass-card-border)', background:'var(--glass-input)' }}>
                      <div style={{ width:44, height:44, borderRadius:12, background:'var(--glass-divider)', display:'flex', alignItems:'center', justifyContent:'center', color:'#7A431A', flexShrink:0 }}>
                        <Icon name={c.icon} size={19} color="#7A431A"/>
                      </div>
                      <div style={{ minWidth:0, flex:1 }}>
                        <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text-primary)', marginBottom:3 }}>{c.name}</div>
                        <div style={{ fontSize:11.5, color:'var(--text-muted)', lineHeight:1.4 }}>{c.desc}</div>
                      </div>
                      <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--glass-card-border)', color:'var(--text-secondary)', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{count}</div>
                      <button onClick={()=>{
                        if (count > 0) { showToast(`${count} vendor(s) are still in "${c.name}" — reassign them to another category first`,'info'); return; }
                        if(window.confirm(`Delete "${c.name}" category?`)) { dispatch({type:'MERGE_CATS',payload:cats.filter(x=>x.id!==c.id)}); logActivity('Admin', `deleted the "${c.name}" category.`, {icon:'x', tint:'var(--tint-red-bg)'}); showToast('Category removed','x'); }
                      }} style={{ width:26, height:26, borderRadius:'50%', border:'none', background:'rgba(196,74,74,0.14)', color:'#B23A3A', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                        <Icon name="x" size={12} color="#B23A3A"/>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
          </div>
        </div>
      )}

      {/* ── Activity ── */}
      {aTab === 'activity' && (
        <div style={{ padding:'16px 18px 20px' }}>
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            {[['all','All'],['admin','Admin'],['vendor','Vendor']].map(([id,label]) => (
              <button key={id} onClick={()=>set({actTab:id})} style={{ background:actTab===id?'#9A5B26':'var(--bg-card)', border:`1px solid ${actTab===id?'#9A5B26':'var(--border-medium)'}`, color:actTab===id?'#FAF8F5':'var(--text-secondary)', fontSize:12.5, fontWeight:600, borderRadius:999, padding:'8px 16px', cursor:'pointer' }}>{label}</button>
            ))}
          </div>
          <div style={{ display:'flex', flexDirection:'column' }}>
            {activity.filter(a => actTab==='all' || a.type===actTab).length === 0 && (
              <div style={{ fontSize:13, color:'var(--text-muted)', textAlign:'center', padding:'20px 0' }}>No activity yet.</div>
            )}
            {activity.filter(a => actTab==='all' || a.type===actTab).map((a,i,arr) => (
              <div key={a.id ?? i} style={{ display:'flex', gap:13 }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:a.tint, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Icon name={a.icon} size={15} color="#9A5B26"/>
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

      {/* ── Compliance ── */}
      {aTab === 'compliance' && (() => {
        const policyAndTabs = (
          <>
            <div style={{ background:'var(--glass-card)', border:'1px solid var(--glass-card-border)', borderRadius:16, padding:'13px 14px', marginBottom:13, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>Offence policy</div>
                <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:2, lineHeight:1.4 }}>Vendors with offences sit out this many upcoming markets. A reminder appears on their next applications, with an override option.</div>
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                {[1,2].map(n => (
                  <button key={n} onClick={()=>{ set({settings:{...settings, skipMarkets:n}}); showToast(`Policy updated — skip ${n} market${n>1?'s':''}`,'shield'); }} style={{ background:skipN===n?'linear-gradient(135deg, #B97434, #7A431A)':'var(--glass-input)', border:`1px solid ${skipN===n?'transparent':'var(--glass-chip-border)'}`, color:skipN===n?'#FFF8EE':'var(--text-secondary)', fontSize:12.5, fontWeight:700, borderRadius:10, padding:'9px 16px', cursor:'pointer' }}>
                    Skip {n} market{n>1?'s':''}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display:'flex', background:'rgba(154,91,38,0.08)', borderRadius:12, padding:4, gap:4, marginBottom:16 }}>
              {[['log','Log offences'],['review','Vendor review']].map(([id,label]) => (
                <button key={id} onClick={()=>set({compTab:id})} style={{ flex:1, border:'none', fontSize:13, fontWeight:700, borderRadius:9, padding:'10px 4px', cursor:'pointer', background:compTab===id?'var(--glass-card-solid)':'transparent', color:compTab===id?'var(--text-primary)':'var(--text-muted)', boxShadow:compTab===id?'0 1px 4px rgba(58,34,16,0.1)':'none', fontFamily:"'Karla',sans-serif" }}>{label}</button>
              ))}
            </div>
          </>
        );

        if (compTab === 'review') {
          const crGrid = 'minmax(0,2fr) minmax(0,1fr) minmax(0,1fr)';
          const reviewList = searchVendors(vendors);
          const reviewPaged = reviewList.slice((page-1)*PER_PAGE, page*PER_PAGE);
          return (
            <TableShell
              title="Compliance" subtitle="Per-vendor offence history and evidence."
              aboveControls={policyAndTabs}
              banner={
                <div style={{ background:'var(--glass-card)', border:'1px solid var(--glass-card-border)', borderRadius:16, padding:'13px 14px', marginBottom:14 }}>
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
              }
              panelTitle="Vendor Review"
              searchValue={vendorSearch} onSearchChange={setVendorSearch} searchPlaceholder="Search by business or owner name"
              headerCells={<><div>Vendor</div><div>Category</div><div style={{ textAlign:'right' }}>Offences</div></>}
              gridTemplate={crGrid} minWidth={620}
              isEmpty={reviewPaged.length===0}
              emptyMessage={`No vendors match "${vendorSearch}".`}
              total={reviewList.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}
            >
              {reviewPaged.map((v,idx) => {
                const vOff = offenses.filter(o=>o.vendorId===v.id);
                return (
                  <div key={v.id} className="dc-row-hover" style={{ borderBottom:'1px solid var(--glass-divider)' }}>
                    <div style={{ display:'grid', gridTemplateColumns:crGrid, gap:10, alignItems:'center', padding:'13px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                        <VendorAvatar v={v} size={34}/>
                        <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}><span style={{ fontSize:11, fontWeight:700, color:'#B8A48C', marginRight:6 }}>#{(page-1)*PER_PAGE+idx+1}</span>{v.business}</div>
                      </div>
                      <div style={{ fontSize:12.5, color:'var(--text-secondary)' }}>{v.category}</div>
                      <div style={{ display:'flex', justifyContent:'flex-end' }}>
                        <span style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)', background:'var(--glass-divider)', borderRadius:999, padding:'5px 11px' }}>{vOff.length} total</span>
                      </div>
                    </div>
                    {vOff.length === 0 ? (
                      <div style={{ margin:'0 14px 13px', fontSize:11.5, color:'var(--text-muted)' }}>No offences on record.</div>
                    ) : (
                      <div style={{ margin:'0 14px 13px', display:'flex', flexDirection:'column', gap:8 }}>
                        {vOff.map(o => {
                          const ot = offenseTypes[o.type]||{};
                          const oPhotos = o.photos||[];
                          const updOffense = async (patch) => {
                            if (isSupabaseConfigured && o.remote) {
                              try { await updateOffensePhotos(o.id, patch.photos); }
                              catch (e) { showToast("Couldn't save — " + e.message, 'lock'); return; }
                            }
                            dispatch({type:'MERGE_OFFENSES', payload: offenses.map(x=>x.id===o.id?{...x,...patch}:x)});
                          };
                          return (
                            <div key={o.id} style={{ background:'rgba(154,91,38,0.06)', borderRadius:11, padding:'10px 11px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                                <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, borderRadius:999, padding:'4px 10px', background:ot.bg, color:ot.color }}><span style={{ width:6, height:6, borderRadius:'50%', background:ot.color }}/>{ot.label}</span>
                                <span style={{ fontSize:11.5, color:'var(--text-secondary)' }}>{eById(o.eventId).name || 'Unknown event'}</span>
                                <button title="Remove this offence" onClick={async ()=>{
                                  if(!window.confirm(`Remove this ${ot.label||'offence'} record for ${v.business}?`)) return;
                                  if (isSupabaseConfigured && o.remote) {
                                    try { await deleteOffense(o.id); }
                                    catch (e) { showToast("Couldn't remove — " + e.message, 'lock'); return; }
                                  }
                                  dispatch({type:'MERGE_OFFENSES', payload: offenses.filter(x=>x.id!==o.id)}); logActivity('Admin', `removed a ${ot.label||'offence'} record for ${v.business}.`, {icon:'shield', tint:'var(--bg-subtle)'}); showToast('Offence removed','x');
                                }} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', padding:2, flexShrink:0 }}>
                                  <Icon name="x" size={13} color="#8A6A4A"/>
                                </button>
                              </div>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginTop:9, alignItems:'center' }}>
                                {oPhotos.map(ph => (
                                  <PhotoTile key={ph.id} photo={ph} size={56} onRemove={()=>{ updOffense({photos: oPhotos.filter(x=>x.id!==ph.id)}); showToast('Evidence photo removed','x'); }}/>
                                ))}
                                <label title="Upload evidence photos the vendor can see" style={{ width:56, height:56, borderRadius:10, border:'2px dashed rgba(154,91,38,0.3)', background:'var(--glass-input)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1, cursor:'pointer', flexShrink:0 }}>
                                  <input type="file" accept="image/*" multiple style={{ display:'none' }} onChange={async e=>{
                                    const files = [...e.target.files]; e.target.value='';
                                    if (!files.length) return;
                                    const added = await Promise.all(files.map(fileToPhoto));
                                    updOffense({photos:[...oPhotos, ...added]});
                                    logActivity('Admin', `added ${added.length} evidence photo(s) to ${v.business}'s ${ot.label||'offence'} record.`, {icon:'camera', tint:'var(--tint-pink-bg)'});
                                    showToast(`${added.length} photo(s) added — visible to the vendor`,'camera');
                                  }}/>
                                  <Icon name="upload" size={14} color="#9A5B26"/><span style={{ fontSize:8, fontWeight:700, color:'#9A5B26' }}>Photo</span>
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </TableShell>
          );
        }

        // Log offences: search-first vendor picker. Instead of one card per
        // offence *type* each listing every approved vendor (which meant hunting
        // through up to 6 long pill lists to tag one vendor), this is a single
        // searchable vendor list — type a name to narrow ~50 vendors instantly,
        // open just that vendor's row, and tick every offence that applies.
        const eventVendorIds = [...new Set(apps.filter(a=>a.eventId===filterEvent&&a.status==='approved').map(a=>a.vendorId))];
        const eventVendorList = searchVendors(eventVendorIds.map(vById)).sort((a,b)=>(a.business||'').localeCompare(b.business||''));
        const offencesFor = (vid) => offenses.filter(o=>o.vendorId===vid && o.eventId===filterEvent);
        return (
          <div style={{ position:'relative', padding:'28px 24px 32px', minHeight:560 }}>
            <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
              <div style={{ position:'absolute', top:-120, right:-80, width:420, height:420, borderRadius:'50%', background:'radial-gradient(circle at 40% 40%, rgba(233,160,92,0.35), transparent 70%)', filter:'blur(50px)' }}/>
              <div style={{ position:'absolute', bottom:-160, left:-100, width:460, height:460, borderRadius:'50%', background:'radial-gradient(circle at 40% 40%, var(--glass-chip-border), transparent 70%)', filter:'blur(60px)' }}/>
            </div>
            <div style={{ position:'relative', zIndex:1 }}>
              <div style={{ marginBottom:20 }}>
                <div style={{ fontFamily:"'Marcellus',serif", fontWeight:400, fontSize:26, margin:'0 0 6px', color:'var(--text-primary)' }}>Compliance</div>
                <div style={{ fontSize:14, color:'var(--text-muted)' }}>Search a vendor for the selected market, then tick the offence(s) that apply.</div>
              </div>
              {policyAndTabs}
              <div style={{ background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:24, padding:'22px 24px', boxShadow:'0 20px 50px rgba(58,34,16,0.12)' }}>
                <div style={{ display:'flex', gap:9, marginBottom:12 }}>
                  <input value={newOffType} onChange={e=>set({newOffType:e.target.value})} placeholder="New offence type, e.g. Smoking in booth" style={{ flex:1, border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', borderRadius:11, padding:'11px 13px', fontSize:14, color:'var(--text-primary)', outline:'none' }}/>
                  <button onClick={async ()=>{
                    const n = newOffType.trim();
                    if (!n) return;
                    if (Object.values(offenseTypes).some(t=>t.label.toLowerCase()===n.toLowerCase())) { showToast('That offence type already exists','info'); return; }
                    const pal = OFFENSE_PALETTE[Object.keys(offenseTypes).length % OFFENSE_PALETTE.length];
                    const id = 'ot'+Date.now();
                    const newType = { label:n, color:pal.color, bg:pal.bg };
                    if (isSupabaseConfigured) {
                      try { await insertOffenseType(id, newType); }
                      catch (e) { showToast("Couldn't save — " + e.message, 'lock'); return; }
                    }
                    dispatch({type:'MERGE_OFFENSE_TYPES', payload:{ ...offenseTypes, [id]: newType }});
                    set({newOffType:''});
                    logActivity('Admin', `added the "${n}" offence type.`, {icon:'shield', tint:'var(--tint-pink-bg)'});
                    showToast('Offence type added','shield');
                  }} style={{ background:'linear-gradient(135deg, #B97434, #7A431A)', color:'#FFF8EE', border:'none', fontSize:14, fontWeight:700, borderRadius:11, padding:'11px 18px', cursor:'pointer' }}>Add</button>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:18 }}>
                  {Object.entries(offenseTypes).map(([type,ot]) => (
                    <span key={type} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11.5, fontWeight:600, borderRadius:999, padding:'5px 6px 5px 11px', background:ot.bg, color:ot.color }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:ot.color }}/>{ot.label}
                      {offenses.every(o=>o.type!==type) && (
                        <button title="Remove this offence type" onClick={async ()=>{
                          if (isSupabaseConfigured) {
                            try { await deleteOffenseType(type); }
                            catch (e) { showToast("Couldn't remove — " + e.message, 'lock'); return; }
                          }
                          const t={...offenseTypes}; delete t[type]; dispatch({type:'MERGE_OFFENSE_TYPES', payload:t}); showToast('Offence type removed','x');
                        }} style={{ background:'rgba(0,0,0,0.08)', border:'none', width:16, height:16, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                          <Icon name="x" size={9} color={ot.color}/>
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Event</div>
                <select value={filterEvent} onChange={e=>{ set({filterEvent:e.target.value}); setCompVendorOpen(null); setCompTypeSel([]); }} style={{ width:'100%', maxWidth:360, border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', borderRadius:12, padding:'11px 13px', fontSize:14, color:'var(--text-primary)', outline:'none', marginBottom:16, fontFamily:"'Karla',sans-serif" }}>
                  {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                </select>

                <SearchBox value={vendorSearch} onChange={v=>{ setVendorSearch(v); setCompVendorOpen(null); }} placeholder="Search this event's vendors by business or owner name"/>

                {eventVendorList.length === 0 ? (
                  <div style={{ background:'var(--glass-input)', borderRadius:14, padding:'20px 14px', textAlign:'center', fontSize:13, color:'var(--text-muted)' }}>
                    {searchQ ? `No approved vendors for ${curEv.name} match "${vendorSearch}".` : `No approved vendors for ${curEv.name} yet.`}
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:520, overflowY:'auto' }}>
                    {eventVendorList.map(v => {
                      const already = offencesFor(v.id);
                      const alreadyTypes = new Set(already.map(o=>o.type));
                      const isOpen = compVendorOpen === v.id;
                      return (
                        <div key={v.id} style={{ background:'rgba(154,91,38,0.06)', border:'1px solid var(--glass-divider)', borderRadius:14, padding:'11px 13px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <VendorAvatar v={v} size={32}/>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.business}</div>
                              {already.length > 0 ? (
                                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:4 }}>
                                  {already.map(o => {
                                    const ot = offenseTypes[o.type]||{};
                                    return <span key={o.id} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10.5, fontWeight:700, borderRadius:999, padding:'2px 8px', background:ot.bg, color:ot.color }}><span style={{ width:5, height:5, borderRadius:'50%', background:ot.color }}/>{ot.label}</span>;
                                  })}
                                </div>
                              ) : (
                                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>No offences logged for this market</div>
                              )}
                            </div>
                            <button onClick={()=>{
                              if (isOpen) { setCompVendorOpen(null); setCompTypeSel([]); }
                              else { setCompVendorOpen(v.id); setCompTypeSel([]); }
                            }} style={{ flexShrink:0, background:isOpen?'var(--glass-divider)':'var(--glass-input)', border:'1px solid var(--glass-chip-border)', color:'#9A5B26', fontSize:12, fontWeight:700, borderRadius:10, padding:'8px 13px', cursor:'pointer' }}>
                              {isOpen ? 'Close' : 'Log offence'}
                            </button>
                          </div>
                          {isOpen && (
                            <div style={{ marginTop:11, paddingTop:11, borderTop:'1px solid var(--glass-divider)' }}>
                              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>Tick every offence that applies</div>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                                {Object.entries(offenseTypes).map(([type,ot]) => {
                                  const logged = alreadyTypes.has(type);
                                  const checked = compTypeSel.includes(type);
                                  return (
                                    <button key={type} disabled={logged} onClick={()=>{
                                      setCompTypeSel(s => checked ? s.filter(t=>t!==type) : [...s, type]);
                                    }} title={logged ? 'Already logged for this market' : ot.label} style={{
                                      display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:700, borderRadius:999,
                                      padding:'7px 12px', cursor: logged ? 'default' : 'pointer',
                                      background: logged ? 'var(--glass-divider)' : (checked ? ot.bg : 'var(--glass-input)'),
                                      border: `1px solid ${checked && !logged ? ot.color : 'var(--glass-chip-border)'}`,
                                      color: logged ? 'var(--text-muted)' : (checked ? ot.color : 'var(--text-secondary)'),
                                      opacity: logged ? 0.6 : 1,
                                    }}>
                                      <span style={{ width:7, height:7, borderRadius:'50%', background: logged ? 'var(--text-muted)' : ot.color }}/>
                                      {ot.label}{logged ? ' · logged' : ''}
                                    </button>
                                  );
                                })}
                              </div>
                              <button disabled={!compTypeSel.length} onClick={async ()=>{
                                if (!compTypeSel.length) return;
                                let added;
                                if (isSupabaseConfigured && v.userId && curEv?.remote) {
                                  try { added = await Promise.all(compTypeSel.map(type => insertOffense({ vendorId:v.id, eventId:filterEvent, type, photos:[] }))); }
                                  catch (e) { showToast("Couldn't save — " + e.message, 'lock'); return; }
                                } else {
                                  let id = Date.now();
                                  added = compTypeSel.map(type => ({ id:'o'+(id++), vendorId:v.id, eventId:filterEvent, type, photos:[] }));
                                }
                                dispatch({type:'MERGE_OFFENSES', payload:[...offenses, ...added]});
                                logActivity('Admin', `logged ${added.length} offence${added.length>1?'s':''} for ${v.business} — ${curEv.name}.`, {icon:'shield', tint:'var(--tint-pink-bg)'});
                                showToast(`${added.length} offence${added.length>1?'s':''} logged for ${v.business}`,'shield');
                                setCompVendorOpen(null); setCompTypeSel([]);
                              }} style={{ marginTop:12, width:'100%', background: compTypeSel.length ? 'linear-gradient(135deg, #B97434, #7A431A)' : 'var(--glass-divider)', color: compTypeSel.length ? '#FFF8EE' : 'var(--text-muted)', border:'none', fontSize:13, fontWeight:700, borderRadius:11, padding:11, cursor: compTypeSel.length ? 'pointer' : 'not-allowed' }}>
                                Log offence{compTypeSel.length===1?'':'s'} for {v.business}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Content ── */}
      {aTab === 'content' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:18, padding:16 }}>
            <div style={{ fontFamily:"'Marcellus',serif", fontSize:18, fontWeight:400, color:'var(--text-primary)' }}>Hero section</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>The top banner on the public home page — title, subtitle, and photo. The photo (if set) fills the section as a full-bleed background, feathered out on the left behind the text — no photo falls back to a plain gradient background.</div>

            <div style={{ marginTop:16 }}>
              <div style={lbl}>Title</div>
              <textarea value={state.cf?.heroTitle ?? content.heroTitle} onChange={e=>set({cf:{...(state.cf||content),heroTitle:e.target.value}})} style={{ ...inp, minHeight:64, resize:'none' }}/>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:5 }}>"Sulap Artisan" is auto-highlighted wherever it appears in the title.</div>
            </div>
            <div style={{ marginTop:14 }}>
              <div style={lbl}>Subtitle</div>
              <textarea value={state.cf?.heroSubtitle ?? content.heroSubtitle} onChange={e=>set({cf:{...(state.cf||content),heroSubtitle:e.target.value}})} style={{ ...inp, minHeight:84, resize:'none' }}/>
            </div>

            <div style={{ marginTop:14 }}>
              <div style={lbl}>Hero photo</div>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:64, height:64, borderRadius:'50%', overflow:'hidden', flexShrink:0, background: (state.cf?.heroImage ?? content.heroImage) ? '#E8D3B4' : 'linear-gradient(135deg, #E8D3B4, #D9BB8E)', border:'1px solid var(--border-light)' }}>
                  {(state.cf?.heroImage ?? content.heroImage) && <img src={state.cf?.heroImage ?? content.heroImage} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>}
                </div>
                <label style={{ display:'inline-flex', alignItems:'center', gap:6, border:'1px solid var(--border-medium)', background:'var(--bg-card)', color:'#9A5B26', fontSize:13, fontWeight:600, borderRadius:10, padding:'9px 14px', cursor:'pointer' }}>
                  <Icon name="upload" size={14} color="#9A5B26"/> Upload photo
                  <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => set({cf:{...(state.cf||content), heroImage: reader.result}});
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }}/>
                </label>
                {(state.cf?.heroImage ?? content.heroImage) && (
                  <button onClick={()=>set({cf:{...(state.cf||content), heroImage:null}})} style={{ background:'var(--bg-subtle)', border:'none', color:'var(--text-secondary)', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'9px 12px', cursor:'pointer' }}>Remove</button>
                )}
              </div>
            </div>

            <div style={{ borderTop:'1px solid var(--border-faint)', marginTop:18, paddingTop:16 }}>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'var(--text-primary)' }}>Coming Soon carousel</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>The dark scrolling strip under the hero now pulls its cards straight from the <b>Events</b> tab — name, date, and photo. Add or edit an event's photo there and it appears here automatically; nothing to manage on this page besides the heading. Toggle visibility entirely via Settings → "Show events publicly".</div>

              <div style={{ marginTop:12 }}>
                <div style={lbl}>Section heading</div>
                <input value={state.cf?.comingSoonHeading ?? content.comingSoonHeading} onChange={e=>set({cf:{...(state.cf||content),comingSoonHeading:e.target.value}})} style={inp}/>
              </div>
            </div>

            <div style={{ borderTop:'1px solid var(--border-faint)', marginTop:18, paddingTop:16 }}>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'var(--text-primary)' }}>Why Join section</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>The light section with the 2×2 photo grid and 4 numbered reasons to join. Recommended photo size: <strong>600 × 600px</strong> (square) — the tiles display at 220px tall in a 2-column grid, so a square upload crops cleanly regardless of column width. Falls back to a plain color tile if no photo is set.</div>

              <div style={{ marginTop:12 }}>
                <div style={lbl}>Title</div>
                <input value={state.cf?.whyJoinTitle ?? content.whyJoinTitle} onChange={e=>set({cf:{...(state.cf||content),whyJoinTitle:e.target.value}})} style={inp}/>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:5 }}>"Why join" is auto-highlighted wherever it appears in the title.</div>
              </div>
              <div style={{ marginTop:14 }}>
                <div style={lbl}>Subtitle</div>
                <input value={state.cf?.whyJoinSubtitle ?? content.whyJoinSubtitle} onChange={e=>set({cf:{...(state.cf||content),whyJoinSubtitle:e.target.value}})} style={inp}/>
              </div>

              <div style={{ marginTop:14 }}>
                <div style={lbl}>Photo grid (4 tiles)</div>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  {(state.cf?.whyJoinImages ?? content.whyJoinImages).map((tile, i) => {
                    const tiles = state.cf?.whyJoinImages ?? content.whyJoinImages;
                    const setTile = (patch) => {
                      const next = tiles.map((x, xi) => xi === i ? { ...x, ...patch } : x);
                      set({cf:{...(state.cf||content), whyJoinImages: next}});
                    };
                    return (
                      <div key={tile.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                        <div style={{ width:64, height:64, borderRadius:10, overflow:'hidden', background: tile.image ? '#DCC49C' : '#E8D3B4', border:'1px solid var(--border-light)' }}>
                          {tile.image && <img src={tile.image} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>}
                        </div>
                        <div style={{ display:'flex', gap:4 }}>
                          <label style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', border:'1px solid var(--border-medium)', background:'var(--bg-card)', color:'#9A5B26', borderRadius:8, width:28, height:28, cursor:'pointer' }} title="Upload photo">
                            <Icon name="upload" size={12} color="#9A5B26"/>
                            <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => setTile({image: reader.result});
                              reader.readAsDataURL(file);
                              e.target.value = '';
                            }}/>
                          </label>
                          {tile.image && <button onClick={()=>setTile({image:null})} title="Remove" style={{ background:'var(--bg-subtle)', border:'none', color:'var(--text-secondary)', borderRadius:8, width:28, height:28, cursor:'pointer' }}>×</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:10 }}>
                {(state.cf?.whyJoinItems ?? content.whyJoinItems).map((item, i) => {
                  const items = state.cf?.whyJoinItems ?? content.whyJoinItems;
                  const setItem = (patch) => {
                    const next = items.map((x, xi) => xi === i ? { ...x, ...patch } : x);
                    set({cf:{...(state.cf||content), whyJoinItems: next}});
                  };
                  return (
                    <div key={item.id} style={{ border:'1px solid var(--border-light)', borderRadius:12, padding:12, display:'flex', gap:12, alignItems:'flex-start' }}>
                      <div style={{ flex:'0 0 26px', width:26, height:26, borderRadius:'50%', background:'linear-gradient(135deg, #B97434, #7A431A)', display:'flex', alignItems:'center', justifyContent:'center', color:'#FFF8EE', fontSize:13, fontWeight:700, marginTop:4 }}>{i+1}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={lbl}>Reason title</div>
                        <input value={item.title} onChange={e=>setItem({title:e.target.value})} style={inp}/>
                        <div style={{ ...lbl, marginTop:10 }}>Reason description</div>
                        <textarea value={item.body} onChange={e=>setItem({body:e.target.value})} style={{ ...inp, minHeight:52, resize:'none' }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ borderTop:'1px solid var(--border-faint)', marginTop:18, paddingTop:16 }}>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'var(--text-primary)' }}>Our Gallery section</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>The dark strip near the bottom of the page — it auto-scrolls continuously (top row right to left, bottom row left to right), so upload as many photos as you like. Recommended photo size: <strong>600 × 700px</strong> (portrait, ~6:7 ratio). An empty gallery (no photos at all) hides the section entirely.</div>

              <div style={{ marginTop:12 }}>
                <div style={lbl}>Section heading</div>
                <input value={state.cf?.galleryHeading ?? content.galleryHeading} onChange={e=>set({cf:{...(state.cf||content),galleryHeading:e.target.value}})} style={inp}/>
              </div>

              <div style={{ marginTop:14, display:'flex', gap:10, flexWrap:'wrap' }}>
                {(state.cf?.galleryImages ?? content.galleryImages).map((tile) => {
                  const tiles = state.cf?.galleryImages ?? content.galleryImages;
                  const removeTile = () => set({cf:{...(state.cf||content), galleryImages: tiles.filter(x=>x.id!==tile.id)}});
                  return (
                    <div key={tile.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                      <div style={{ width:64, height:64, borderRadius:10, overflow:'hidden', background:'linear-gradient(135deg, #4A2A0F, #2A1708)', border:'1px solid var(--border-light)' }}>
                        {tile.image && <img src={tile.image} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>}
                      </div>
                      <button onClick={removeTile} title="Remove" style={{ background:'var(--bg-subtle)', border:'none', color:'var(--text-secondary)', borderRadius:8, width:28, height:28, cursor:'pointer' }}>×</button>
                    </div>
                  );
                })}
                <label style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, width:64, height:64, borderRadius:10, border:'1.5px dashed var(--border-medium)', color:'#9A5B26', cursor:'pointer' }} title="Add photo(s)">
                  <Icon name="upload" size={14} color="#9A5B26"/>
                  <span style={{ fontSize:9.5, fontWeight:700 }}>Add</span>
                  <input type="file" accept="image/*" multiple style={{ display:'none' }} onChange={e=>{
                    const files = [...(e.target.files||[])];
                    if (!files.length) return;
                    const tiles = state.cf?.galleryImages ?? content.galleryImages;
                    let pending = files.length;
                    const added = [];
                    files.forEach(file => {
                      const reader = new FileReader();
                      reader.onload = () => {
                        added.push({ id:`g-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, image: reader.result });
                        pending--;
                        if (pending === 0) set({cf:{...(state.cf||content), galleryImages: [...tiles, ...added]}});
                      };
                      reader.readAsDataURL(file);
                    });
                    e.target.value = '';
                  }}/>
                </label>
              </div>
            </div>

            <div style={{ borderTop:'1px solid var(--border-faint)', marginTop:18, paddingTop:16 }}>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'var(--text-primary)' }}>CTA banner</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>The gradient call-to-action card above the footer.</div>
              <div style={{ marginTop:12 }}>
                <div style={lbl}>Title</div>
                <input value={state.cf?.ctaTitle ?? content.ctaTitle} onChange={e=>set({cf:{...(state.cf||content),ctaTitle:e.target.value}})} style={inp}/>
              </div>
              <div style={{ marginTop:14 }}>
                <div style={lbl}>Subtitle</div>
                <textarea value={state.cf?.ctaSubtitle ?? content.ctaSubtitle} onChange={e=>set({cf:{...(state.cf||content),ctaSubtitle:e.target.value}})} style={{ ...inp, minHeight:64, resize:'none' }}/>
              </div>
            </div>

            <div style={{ borderTop:'1px solid var(--border-faint)', marginTop:18, paddingTop:16 }}>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'var(--text-primary)' }}>Footer</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>The dark footer at the bottom of the page. Logo and the "Vendors" navigation links aren't editable here — only copy.</div>
              <div style={{ marginTop:12 }}>
                <div style={lbl}>Description</div>
                <textarea value={state.cf?.footerDescription ?? content.footerDescription} onChange={e=>set({cf:{...(state.cf||content),footerDescription:e.target.value}})} style={{ ...inp, minHeight:64, resize:'none' }}/>
              </div>
              <div style={{ marginTop:14 }}>
                <div style={lbl}>Visit Us address</div>
                <textarea value={state.cf?.footerAddress ?? content.footerAddress} onChange={e=>set({cf:{...(state.cf||content),footerAddress:e.target.value}})} style={{ ...inp, minHeight:64, resize:'none' }}/>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:5 }}>Each line becomes its own line in the footer.</div>
              </div>
              <div style={{ marginTop:14 }}>
                <div style={lbl}>Copyright line</div>
                <input value={state.cf?.footerCopyright ?? content.footerCopyright} onChange={e=>set({cf:{...(state.cf||content),footerCopyright:e.target.value}})} style={inp}/>
              </div>
            </div>

            <div style={{ borderTop:'1px solid var(--border-faint)', marginTop:18, paddingTop:16 }}>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'var(--text-primary)' }}>Application — market terms</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>Shown on the last step of the vendor application. Vendors must accept before submitting. Use the toolbar for headings, bold/italic, and bullet or numbered lists.</div>
              <div style={{ marginTop:12 }}>
                <RichTextEditor value={state.cf?.terms ?? content.terms} onChange={val=>set({cf:{...(state.cf||content),terms:val}})} minHeight={240}/>
              </div>
            </div>
            <button onClick={async ()=>{
              const next = {...content,...state.cf};
              if (isSupabaseConfigured) {
                try { await updateContent(next); }
                catch (e) { showToast("Couldn't save — " + e.message, 'lock'); return; }
              }
              set({content:next,cf:null}); logActivity('Admin', 'updated the homepage content.', {icon:'pen', tint:'var(--tint-pink-bg)'}); showToast('Content updated','check');
            }} className="cta" style={{ marginTop:16, width:'100%', background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:14.5, fontWeight:600, borderRadius:12, padding:14, cursor:'pointer' }}>Save changes</button>
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
                <div onClick={()=>set({settings:{...settings,[s.key]:!on}})} onKeyDown={e=>{ if (e.key==='Enter'||e.key===' ') { e.preventDefault(); set({settings:{...settings,[s.key]:!on}}); } }} role="switch" aria-checked={on} aria-label={s.title} tabIndex={0} style={{ width:48, height:28, borderRadius:14, background:on?'#9A5B26':'var(--border-dashed)', position:'relative', cursor:'pointer', flexShrink:0, transition:'background .2s' }}>
                  <div style={{ position:'absolute', top:3, left:on?22:3, width:22, height:22, borderRadius:'50%', background:'var(--bg-card)', transition:'left .2s', boxShadow:'0 1px 4px rgba(0,0,0,0.15)' }}/>
                </div>
              </div>
            );
          })}

          {/* Required vendor documents — admin-configurable list of what a vendor
              is asked to upload on their Documents tab (migration 0014). Add/remove
              types and toggle required-vs-optional here instead of a code change. */}
          <div style={{ fontFamily:"'Marcellus',serif", fontSize:17, fontWeight:400, color:'var(--text-primary)', margin:'10px 2px 0' }}>Required vendor documents</div>
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:14, padding:14 }}>
            <div style={{ display:'flex', gap:9, marginBottom:12 }}>
              <input value={newDocType.label} onChange={e=>setNewDocType({...newDocType, label:e.target.value})} placeholder="New document type, e.g. Insurance certificate" style={{ flex:1, border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'11px 13px', fontSize:13.5, color:'var(--text-primary)', outline:'none' }}/>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, color:'var(--text-secondary)', flexShrink:0, cursor:'pointer' }}>
                <input type="checkbox" checked={newDocType.required} onChange={e=>setNewDocType({...newDocType, required:e.target.checked})} style={{ accentColor:'#9A5B26', width:15, height:15, cursor:'pointer' }}/>
                Required
              </label>
              <button onClick={async ()=>{
                const label = newDocType.label.trim();
                if (!label) return;
                if (docTypes.some(t=>t.label.toLowerCase()===label.toLowerCase())) { showToast('That document type already exists','info'); return; }
                const id = 'dt'+Date.now();
                const sortOrder = docTypes.length ? Math.max(...docTypes.map(t=>t.sortOrder))+1 : 1;
                const newType = { id, label, required:newDocType.required, sortOrder };
                if (isSupabaseConfigured) {
                  try { await insertDocType(newType); }
                  catch (e) { showToast("Couldn't save — " + e.message, 'lock'); return; }
                }
                dispatch({ type:'MERGE_DOC_TYPES', payload:[...docTypes, newType] });
                setNewDocType({ label:'', required:false });
                logActivity('Admin', `added "${label}" to required vendor documents.`, {icon:'file', tint:'var(--tint-pink-bg)'});
                showToast('Document type added','file');
              }} style={{ background:'linear-gradient(135deg, #B97434, #7A431A)', color:'#FFF8EE', border:'none', fontSize:13.5, fontWeight:700, borderRadius:11, padding:'11px 16px', cursor:'pointer', flexShrink:0 }}>Add</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[...docTypes].sort((a,b)=>a.sortOrder-b.sortOrder).map(dt => (
                <div key={dt.id} style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg-subtle)', borderRadius:10, padding:'9px 12px' }}>
                  <span style={{ flex:1, fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{dt.label}</span>
                  <span {...clickable(async ()=>{
                    const required = !dt.required;
                    if (isSupabaseConfigured) {
                      try { await updateDocTypeRequired(dt.id, required); }
                      catch (e) { showToast("Couldn't save — " + e.message, 'lock'); return; }
                    }
                    dispatch({ type:'MERGE_DOC_TYPES', payload: docTypes.map(t=>t.id===dt.id?{...t,required}:t) });
                  })} style={{ fontSize:11, fontWeight:700, borderRadius:999, padding:'4px 10px', cursor:'pointer', color: dt.required?'#B7770D':'#3F7A54', background: dt.required?'#FEF8EC':'rgba(90,145,110,0.14)' }}>{dt.required?'Required':'Optional'}</span>
                  <button title="Remove this document type" onClick={async ()=>{
                    if (!window.confirm(`Remove "${dt.label}" from required documents? Vendors who already uploaded one won't lose the file, it just stops being asked for.`)) return;
                    if (isSupabaseConfigured) {
                      try { await deleteDocType(dt.id); }
                      catch (e) { showToast("Couldn't remove — " + e.message, 'lock'); return; }
                    }
                    dispatch({ type:'MERGE_DOC_TYPES', payload: docTypes.filter(t=>t.id!==dt.id) });
                    showToast('Document type removed','x');
                  }} style={{ background:'rgba(196,74,74,0.1)', border:'none', width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                    <Icon name="x" size={11} color="#B03A2E"/>
                  </button>
                </div>
              ))}
              {!docTypes.length && <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>No document types configured — vendors won't be asked to upload anything.</div>}
            </div>
          </div>

          {/* Portal tab order — super admin only. The arrangement set here is what every
              admin and every vendor sees; they have no reorder controls of their own. */}
          {isSuperActing && (
            <>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:17, fontWeight:400, color:'var(--text-primary)', margin:'10px 2px 0' }}>Portal tab order</div>
              <div className="admin-cards">
                <TabOrderCard
                  title="Admin console tabs"
                  desc="The sidebar/menu order every admin sees, including staff admins (their hidden tabs keep this position too)."
                  tabs={orderTabs(ADMIN_TABS.filter(t=>!t.hidden), state.aTabOrder)}
                  isCustom={!!state.aTabOrder}
                  onOrder={ids => set({ aTabOrder: ids })}
                  onReset={() => { set({ aTabOrder: null }); showToast('Admin tab order reset to default', 'check'); }}
                />
                <TabOrderCard
                  title="Vendor portal tabs"
                  desc="The sidebar/menu order every vendor sees in their portal."
                  tabs={orderTabs(VENDOR_TABS, state.vTabOrder)}
                  isCustom={!!state.vTabOrder}
                  onOrder={ids => set({ vTabOrder: ids })}
                  onReset={() => { set({ vTabOrder: null }); showToast('Vendor tab order reset to default', 'check'); }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Admin Roles (super admin only) ── */}
      {aTab === 'roles' && isSuperActing && (() => {
        const grantableTabs = ADMIN_TABS.filter(t => !t.superOnly && !t.hidden);
        const permOf = (a, tab) => a.perms?.[tab] || 'none';
        // Writes to Supabase FIRST, then reflects locally only on success —
        // unlike most of this app's optimistic dispatches, RBAC integrity is
        // exactly the kind of thing that shouldn't ever "look saved" when it
        // wasn't (this is the audit's own top-flagged risk, applied here).
        const setPerm = async (adminId, tab, level) => {
          const target2 = admins.find(x => x.id === adminId);
          const perms = { ...target2.perms };
          if (level === 'none') delete perms[tab]; else perms[tab] = level;
          if (isSupabaseConfigured) {
            try { await updateAdminPerms(adminId, perms); }
            catch (e) { showToast("Couldn't save — " + e.message, 'lock'); return; }
          }
          dispatch({ type:'MERGE_ADMINS', payload: admins.map(x => x.id===adminId ? {...x, perms} : x) });
        };
        const setAllPerms = async (adminId, level) => {
          const perms = level === 'none' ? {} : Object.fromEntries(grantableTabs.map(t => [t.id, level]));
          if (isSupabaseConfigured) {
            try { await updateAdminPerms(adminId, perms); }
            catch (e) { showToast("Couldn't save — " + e.message, 'lock'); return; }
          }
          dispatch({ type:'MERGE_ADMINS', payload: admins.map(x => x.id === adminId ? { ...x, perms } : x) });
          showToast(level === 'none' ? 'All access cleared' : `All tabs set to ${level}`, 'lock');
        };
        // Creating/removing an admin account, or resetting someone else's
        // password, needs a privileged server call (Supabase Admin API via
        // the admin-manage Edge Function — see supabase/functions/admin-manage)
        // that the browser's anon key can never make: RLS governs table
        // rows, not auth.users identity. Real mode goes through that
        // function; demo mode keeps the exact old local-only behavior.
        const refreshAdminList = async () => {
          try { dispatch({ type:'MERGE_ADMINS_FROM_SERVER', payload: await fetchAllAdminProfiles() }); }
          catch (e) { console.error('Failed to refresh admin list:', e); }
        };
        const createAdmin = async () => {
          if (isSupabaseConfigured) {
            const email = newAdmin.email.trim();
            const name = newAdmin.name.trim();
            const password = newAdmin.password;
            if (!email || !name || !password) { showToast('Fill in email, full name, and a password', 'info'); return; }
            if (!isStrongPassword(password)) { showToast(PASSWORD_HINT, 'info'); return; }
            try { await createAdminAccount({ email, password, name, role:'staff' }); }
            catch (e) { showToast("Couldn't create admin — " + e.message, 'lock'); return; }
            setNewAdmin({ id:'', name:'', email:'', password:'' });
            logActivity('Admin', `created an admin account for ${name} (${email}).`, { icon:'lock', tint:'var(--tint-pink-bg)' });
            showToast(`Admin created — share the password with ${name} directly`, 'check');
            await refreshAdminList();
            return;
          }
          const id = newAdmin.id.trim().toLowerCase().replace(/\s+/g, '');
          const name = newAdmin.name.trim();
          if (!id || !name) { showToast('Fill in both the admin ID and full name', 'info'); return; }
          if (!/^[a-z0-9_.-]+$/.test(id)) { showToast('Admin ID can only use letters, numbers, dots, dashes', 'info'); return; }
          if (admins.some(a => a.id === id)) { showToast('That admin ID already exists', 'info'); return; }
          dispatch({ type:'MERGE_ADMINS', payload: [...admins, { id, name, role:'staff', password:DEFAULT_ADMIN_PASSWORD, mustReset:true, perms:{} }] });
          setNewAdmin({ id:'', name:'', email:'', password:'' });
          logActivity('Admin', `created the admin ID "${id}" for ${name}.`, { icon:'lock', tint:'var(--tint-pink-bg)' });
          showToast(`Admin created — they sign in with ${id} / ${DEFAULT_ADMIN_PASSWORD}`, 'check');
        };
        const confirmResetPassword = async (a) => {
          if (!isStrongPassword(resetPasswordValue)) { showToast(PASSWORD_HINT, 'info'); return; }
          try { await resetAdminPassword(a.id, resetPasswordValue); }
          catch (e) { showToast("Couldn't reset password — " + e.message, 'lock'); return; }
          setResettingAdminId(null); setResetPasswordValue('');
          logActivity('Admin', `reset the password for ${a.name}.`, { icon:'lock', tint:'var(--tint-amber-bg)' });
          showToast(`${a.name}'s password has been reset`, 'lock');
        };
        const resetPassword = (a) => {
          if (isSupabaseConfigured) { setResettingAdminId(a.id); setResetPasswordValue(''); return; }
          if (!window.confirm(`Reset ${a.name}'s password back to the default (${DEFAULT_ADMIN_PASSWORD})? They'll set a new one on their next sign-in.`)) return;
          dispatch({ type:'MERGE_ADMINS', payload: admins.map(x => x.id === a.id ? { ...x, password:DEFAULT_ADMIN_PASSWORD, mustReset:true } : x) });
          logActivity('Admin', `reset the password for admin "${a.id}".`, { icon:'lock', tint:'var(--tint-amber-bg)' });
          showToast(`${a.name}'s password reset to ${DEFAULT_ADMIN_PASSWORD}`, 'lock');
        };
        const removeAdmin = async (a) => {
          if (!window.confirm(`Remove admin "${a.name}"? They will no longer be able to sign in.`)) return;
          if (isSupabaseConfigured) {
            try { await removeAdminAccount(a.id); }
            catch (e) { showToast("Couldn't remove admin — " + e.message, 'lock'); return; }
          }
          dispatch({ type:'MERGE_ADMINS', payload: admins.filter(x => x.id !== a.id) });
          logActivity('Admin', `removed ${a.name}'s admin account.`, { icon:'x', tint:'var(--tint-red-bg)' });
          showToast('Admin removed', 'x');
        };
        const staffAdmins = admins.filter(a => a.role !== 'super');
        const target = admins.find(a => a.id === transferTo);
        const transferReady = target && transferConfirm.trim().toLowerCase() === target.id.toLowerCase();
        // Transferring (unlike create/remove) is just updating two EXISTING
        // profiles' role/perms — allowed directly under RLS for a super
        // admin session (migration 0002), no privileged server call needed.
        const transferSuperAdmin = async () => {
          if (!transferReady) return;
          const outgoingId = acting?.id;
          const outgoingPerms = Object.fromEntries(grantableTabs.map(t => [t.id,'edit']));
          if (isSupabaseConfigured) {
            try {
              await updateAdminRole(target.id, { role:'super', perms:{} });
              await updateAdminRole(outgoingId, { role:'staff', perms:outgoingPerms });
            } catch (e) { showToast("Couldn't complete the transfer — " + e.message, 'lock'); return; }
          }
          dispatch({ type:'MERGE_ADMINS', payload: admins.map(x => {
            if (x.id === target.id) return { ...x, role:'super' };
            if (x.id === outgoingId) return { ...x, role:'staff', perms: outgoingPerms };
            return x;
          })});
          logActivity('Admin', `transferred the super admin role to "${target.id}" (${target.name}).`, { icon:'lock', tint:'var(--tint-pink-bg)' });
          showToast(`Super admin transferred to ${target.name} — you're now a regular admin with full edit access`, 'lock');
          setExpandedAdmin(null); setTransferTo(''); setTransferConfirm('');
        };
        const segStyle = (on, color) => ({ flex:1, border:'none', fontSize:11, fontWeight:600, borderRadius:7, padding:'6px 4px', cursor:'pointer', background:on?color:'transparent', color:on?'#fff':'var(--text-secondary)' });
        return (
          <div style={{ padding:'14px 16px 20px' }}>
            {/* Create admin — real for a Supabase-backed project (admin-manage
                Edge Function, migration 0015), local-only in mock mode. */}
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:18, padding:16 }}>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:18, fontWeight:400, color:'var(--text-primary)' }}>Create admin</div>
              {isSupabaseConfigured ? (
                <>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3, lineHeight:1.5 }}>They sign in with the email + password below. New admins start as staff — grant tab access below, or transfer super admin later if needed.</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginTop:14 }}>
                    <input type="email" value={newAdmin.email} onChange={e=>setNewAdmin(s=>({...s,email:e.target.value}))} placeholder="Email address" style={{ flex:1, minWidth:150, border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'11px 13px', fontSize:14, color:'var(--text-primary)', outline:'none' }}/>
                    <input value={newAdmin.name} onChange={e=>setNewAdmin(s=>({...s,name:e.target.value}))} placeholder="Full name" style={{ flex:1, minWidth:150, border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'11px 13px', fontSize:14, color:'var(--text-primary)', outline:'none' }}/>
                  </div>
                  <div style={{ marginTop:10 }}>
                    <PasswordInput value={newAdmin.password} onChange={e=>setNewAdmin(s=>({...s,password:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&createAdmin()} placeholder="Temporary password" style={{ width:'100%', border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'11px 13px', fontSize:14, color:'var(--text-primary)', outline:'none' }}/>
                    {newAdmin.password && <PasswordChecklist password={newAdmin.password}/>}
                  </div>
                  <button onClick={createAdmin} style={{ marginTop:10, width:'100%', background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:14, fontWeight:600, borderRadius:11, padding:'11px 18px', cursor:'pointer' }}>Create admin</button>
                </>
              ) : (
                <>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3, lineHeight:1.5 }}>New admins start with the default password <b style={{ color:'var(--text-secondary)' }}>{DEFAULT_ADMIN_PASSWORD}</b> and must set their own the first time they sign in.</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginTop:14 }}>
                    <input value={newAdmin.id} onChange={e=>setNewAdmin(s=>({...s,id:e.target.value}))} placeholder="Admin ID, e.g. staff02" style={{ flex:1, minWidth:150, border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'11px 13px', fontSize:14, color:'var(--text-primary)', outline:'none' }}/>
                    <input value={newAdmin.name} onChange={e=>setNewAdmin(s=>({...s,name:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&createAdmin()} placeholder="Full name" style={{ flex:1, minWidth:150, border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'11px 13px', fontSize:14, color:'var(--text-primary)', outline:'none' }}/>
                    <button onClick={createAdmin} style={{ background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:14, fontWeight:600, borderRadius:11, padding:'11px 18px', cursor:'pointer' }}>Create</button>
                  </div>
                </>
              )}
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
                      <div style={{ width:36, height:36, borderRadius:'50%', background: a.role==='super' ? 'var(--text-primary)' : 'var(--tint-pink-bg)', display:'flex', alignItems:'center', justifyContent:'center', color: a.role==='super' ? '#FAF8F5' : '#9A5B26', fontWeight:700, fontSize:13, flexShrink:0 }}>
                        {a.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                          <span style={{ fontSize:13.5, fontWeight:700, color:'var(--text-primary)' }}>{a.name}</span>
                          <span style={{ fontSize:11, color:'var(--text-muted)' }}>{displayStaffId(a)}</span>
                          {a.role === 'super' ? (
                            <span style={{ fontSize:10, fontWeight:700, color:'#FAF8F5', background:'var(--text-primary)', borderRadius:999, padding:'2px 8px' }}>Super admin</span>
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
                                {staffAdmins.map(x => <option key={x.id} value={x.id}>{x.name} ({displayStaffId(x)})</option>)}
                              </select>
                            </div>
                            {target && (
                              <div style={{ marginTop:11 }}>
                                <div style={{ fontSize:11.5, fontWeight:600, color:'var(--text-primary)', marginBottom:6 }}>Type "{target.id}" to confirm</div>
                                <input value={transferConfirm} onChange={e=>setTransferConfirm(e.target.value)} placeholder={target.id} style={{ width:'100%', border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:10, padding:'10px 12px', fontSize:13, color:'var(--text-primary)', outline:'none' }}/>
                              </div>
                            )}
                            <button onClick={transferSuperAdmin} disabled={!transferReady} style={{ marginTop:12, width:'100%', background:transferReady?'#9A5B26':'var(--bg-subtle)', color:transferReady?'#FAF8F5':'var(--text-muted)', border:'none', fontSize:13, fontWeight:600, borderRadius:10, padding:11, cursor:transferReady?'pointer':'not-allowed' }}>
                              Transfer super admin role{target ? ` to ${target.name}` : ''}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {isOpen && a.role !== 'super' && (
                      <div style={{ padding:'0 14px 16px' }}>
                        {isSupabaseConfigured && (() => {
                          const draft = staffIdDraft[a.id] ?? (a.staffId || '');
                          const changed = draft.trim() !== (a.staffId || '');
                          const save = async () => {
                            try { await updateAdminStaffId(a.id, draft.trim() || null); }
                            catch (e) { showToast("Couldn't save — " + e.message, 'lock'); return; }
                            dispatch({ type:'MERGE_ADMINS', payload: admins.map(x => x.id === a.id ? { ...x, staffId: draft.trim() || null } : x) });
                            showToast('Staff ID updated', 'check');
                          };
                          return (
                            <div style={{ marginBottom:12 }}>
                              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>Staff ID</label>
                              <div style={{ display:'flex', gap:8 }}>
                                <input value={draft} onChange={e=>setStaffIdDraft(s=>({ ...s, [a.id]: e.target.value }))} placeholder="e.g. SA-002" style={{ flex:1, border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:9, padding:'8px 10px', fontSize:12.5, color:'var(--text-primary)', outline:'none' }}/>
                                <button onClick={save} disabled={!changed} style={{ background: changed ? '#9A5B26' : 'var(--bg-subtle)', color: changed ? '#FAF8F5' : 'var(--text-muted)', border:'none', fontSize:12, fontWeight:600, borderRadius:9, padding:'8px 14px', cursor: changed ? 'pointer' : 'not-allowed' }}>Save</button>
                              </div>
                            </div>
                          );
                        })()}
                        <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:2 }}>
                          <span style={{ fontSize:11, fontWeight:700, color:'var(--text-primary)' }}>Tab access</span>
                          <div style={{ flex:1 }}/>
                          <button onClick={()=>setAllPerms(a.id,'view')} style={{ background:'none', border:'none', color:'#9A5B26', fontSize:11, fontWeight:600, cursor:'pointer', textDecoration:'underline', textUnderlineOffset:2 }}>All view</button>
                          <button onClick={()=>setAllPerms(a.id,'edit')} style={{ background:'none', border:'none', color:'#9A5B26', fontSize:11, fontWeight:600, cursor:'pointer', textDecoration:'underline', textUnderlineOffset:2 }}>All edit</button>
                          <button onClick={()=>setAllPerms(a.id,'none')} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:11, fontWeight:600, cursor:'pointer', textDecoration:'underline', textUnderlineOffset:2 }}>Clear</button>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:9 }}>
                          {grantableTabs.map(t => {
                            const p = permOf(a, t.id);
                            return (
                              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:9 }}>
                                <span style={{ flex:1, fontSize:12, color: p==='none' ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: p==='none' ? 400 : 600, display:'flex', alignItems:'center', gap:7, minWidth:0 }}>
                                  <Icon name={t.icon} size={13} color={p==='none' ? 'var(--text-faint)' : '#9A5B26'}/>{t.label}
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
                            <button onClick={()=>resetPassword(a)} style={{ flex:1, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, background:'var(--bg-card)', border:'1px solid var(--border-medium)', color:'#9A5B26', fontSize:12, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>
                              <Icon name="lock" size={13} color="#9A5B26"/>{isSupabaseConfigured ? 'Reset password' : 'Reset password to default'}
                            </button>
                            <button onClick={()=>{ removeAdmin(a); setExpandedAdmin(null); }} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, background:'var(--tint-red-bg)', border:'none', color:'var(--tint-red-text)', fontSize:12, fontWeight:600, borderRadius:10, padding:'9px 13px', cursor:'pointer' }}>
                              <Icon name="trash" size={13} color="var(--tint-red-text)"/>Remove
                            </button>
                        </div>
                        {isSupabaseConfigured && resettingAdminId === a.id && (
                          <div style={{ marginTop:10 }}>
                            <PasswordInput value={resetPasswordValue} onChange={e=>setResetPasswordValue(e.target.value)} onKeyDown={e=>e.key==='Enter'&&confirmResetPassword(a)} placeholder="New password" style={{ width:'100%', border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'11px 13px', fontSize:14, color:'var(--text-primary)', outline:'none' }}/>
                            {resetPasswordValue && <PasswordChecklist password={resetPasswordValue}/>}
                            <div style={{ display:'flex', gap:8, marginTop:8 }}>
                              <button onClick={()=>{ setResettingAdminId(null); setResetPasswordValue(''); }} style={{ flex:1, background:'var(--bg-subtle)', color:'var(--text-primary)', border:'none', fontSize:12.5, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>Cancel</button>
                              <button onClick={()=>confirmResetPassword(a)} style={{ flex:1, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:12.5, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>Set new password</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── My Account (reached via the header profile card, not the sidebar) ── */}
      {aTab === 'account' && acting && (() => {
        const me = acting;
        const initials = me.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
        const nameChanged = acctName.trim() && acctName.trim() !== me.name;
        const saveName = async () => {
          if (!acctName.trim()) { showToast("Full name can't be empty", 'info'); return; }
          if (isSupabaseConfigured) {
            try { await updateAdminName(me.id, acctName.trim()); }
            catch (e) { showToast("Couldn't save — " + e.message, 'lock'); return; }
          }
          dispatch({ type:'MERGE_ADMINS', payload: admins.map(x => x.id === me.id ? { ...x, name: acctName.trim() } : x) });
          logActivity('Admin', `updated their profile name to "${acctName.trim()}".`, { icon:'pencil', tint:'var(--tint-pink-bg)' });
          showToast('Name updated', 'check');
        };
        // Only a super admin's own session can actually write staff_id (the
        // migration 0003 trigger silently reverts anyone else's attempt) — so
        // this is only reachable/shown for a super admin editing themselves.
        const staffIdChanged = isSupabaseConfigured && acctStaffId.trim() !== (me.staffId || '');
        const saveStaffId = async () => {
          try { await updateAdminStaffId(me.id, acctStaffId.trim() || null); }
          catch (e) { showToast("Couldn't save — " + e.message, 'lock'); return; }
          dispatch({ type:'MERGE_ADMINS', payload: admins.map(x => x.id === me.id ? { ...x, staffId: acctStaffId.trim() || null } : x) });
          logActivity('Admin', `updated their Staff ID.`, { icon:'pencil', tint:'var(--tint-pink-bg)' });
          showToast('Staff ID updated', 'check');
        };
        // Supabase's updateUser() only needs the new password (you're already
        // authenticated) — there's no "current password" to check, unlike the
        // mock flow, so that field only renders in mock mode (see JSX below).
        const savePw = async () => {
          if (isSupabaseConfigured) {
            if (!acctPw.next || !acctPw.confirm) { setAcctPwMsg({ type:'error', text:'Fill in the new password and confirmation.' }); return; }
            if (!isStrongPassword(acctPw.next)) { setAcctPwMsg({ type:'error', text:PASSWORD_HINT }); return; }
            if (acctPw.next !== acctPw.confirm) { setAcctPwMsg({ type:'error', text:"New password and confirmation don't match." }); return; }
            const { error } = await supabase.auth.updateUser({ password: acctPw.next });
            if (error) { setAcctPwMsg({ type:'error', text: friendlyAuthError(error) }); return; }
            setAcctPw({ current:'', next:'', confirm:'' });
            setAcctPwMsg({ type:'success', text:'Password updated.' });
            logActivity('Admin', 'updated their own password.', { icon:'lock', tint:'var(--tint-green-bg)' });
            showToast('Password updated', 'check');
            return;
          }
          if (!acctPw.current || !acctPw.next || !acctPw.confirm) { setAcctPwMsg({ type:'error', text:'Fill in every password field.' }); return; }
          if (acctPw.current !== me.password) { setAcctPwMsg({ type:'error', text:'Current password is incorrect.' }); return; }
          if (acctPw.next.length < 4) { setAcctPwMsg({ type:'error', text:'New password must be at least 4 characters.' }); return; }
          if (acctPw.next !== acctPw.confirm) { setAcctPwMsg({ type:'error', text:"New password and confirmation don't match." }); return; }
          dispatch({ type:'MERGE_ADMINS', payload: admins.map(x => x.id === me.id ? { ...x, password: acctPw.next, mustReset:false } : x) });
          setAcctPw({ current:'', next:'', confirm:'' });
          setAcctPwMsg({ type:'success', text:'Password updated.' });
          logActivity('Admin', 'updated their own password.', { icon:'lock', tint:'var(--tint-green-bg)' });
          showToast('Password updated', 'check');
        };
        return (
          <div style={{ padding:'16px 16px 20px', display:'flex', flexDirection:'column', gap:13 }}>
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:18, padding:18, display:'flex', alignItems:'center', gap:14 }}>
              <label title="Upload a profile picture" style={{ position:'relative', width:64, height:64, borderRadius:'50%', flexShrink:0, cursor:'pointer' }}>
                {me.avatar ? (
                  <img src={me.avatar.url} alt="" style={{ width:64, height:64, borderRadius:'50%', objectFit:'cover', display:'block' }}/>
                ) : (
                  <div style={{ width:64, height:64, borderRadius:'50%', background:'var(--text-primary)', display:'flex', alignItems:'center', justifyContent:'center', color:'#FAF8F5', fontWeight:700, fontSize:20 }}>{initials}</div>
                )}
                <div style={{ position:'absolute', bottom:-2, right:-2, width:24, height:24, borderRadius:'50%', background:'#9A5B26', border:'2px solid var(--bg-card)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon name="camera" size={12} color="#FFF8EE"/>
                </div>
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={async e => {
                  const f = e.target.files[0]; e.target.value = '';
                  if (!f) return;
                  const photo = await fileToPhoto(f);
                  dispatch({ type:'MERGE_ADMINS', payload: admins.map(x => x.id === me.id ? { ...x, avatar: photo } : x) });
                  showToast('Profile picture updated', 'camera');
                }}/>
              </label>
              <div>
                <div style={{ fontFamily:"'Marcellus',serif", fontSize:19, fontWeight:400, color:'var(--text-primary)' }}>{me.name}</div>
                <div style={{ fontSize:12.5, color:'var(--text-secondary)', marginTop:2 }}>{me.role === 'super' ? 'Super admin' : 'Staff admin'} · Staff ID {displayStaffId(me)}</div>
              </div>
            </div>

            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:16, padding:16 }}>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'var(--text-primary)' }}>Your details</div>
              <div style={{ marginTop:12 }}>
                <div style={lbl}>Full name</div>
                <input value={acctName} onChange={e=>setAcctName(e.target.value)} style={inp}/>
              </div>
              <div style={{ marginTop:12 }}>
                <div style={lbl}>Staff ID</div>
                {isSupabaseConfigured ? (
                  isSuperActing ? (
                    <>
                      <input value={acctStaffId} onChange={e=>setAcctStaffId(e.target.value)} placeholder="e.g. SA-001" style={inp}/>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4, lineHeight:1.4 }}>Your organization's own identifier — not used for sign-in (that's your email).</div>
                    </>
                  ) : (
                    <>
                      <input value={displayStaffId(me)} disabled style={{ ...inp, background:'var(--bg-subtle)', color:'var(--text-muted)', cursor:'not-allowed' }}/>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4, lineHeight:1.4 }}>Assigned by a super admin — you can't change this yourself.</div>
                    </>
                  )
                ) : (
                  <>
                    <input value={me.id} disabled style={{ ...inp, background:'var(--bg-subtle)', color:'var(--text-muted)', cursor:'not-allowed' }}/>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4, lineHeight:1.4 }}>Your Staff ID is your sign-in ID and can't be changed here.</div>
                  </>
                )}
              </div>
              <div style={{ display:'flex', gap:9, marginTop:14 }}>
                <button onClick={saveName} disabled={!nameChanged} style={{ background: nameChanged ? '#9A5B26' : 'var(--bg-subtle)', color: nameChanged ? '#FAF8F5' : 'var(--text-muted)', border:'none', fontSize:13.5, fontWeight:600, borderRadius:11, padding:'11px 18px', cursor: nameChanged ? 'pointer' : 'not-allowed' }}>Save name</button>
                {isSupabaseConfigured && isSuperActing && (
                  <button onClick={saveStaffId} disabled={!staffIdChanged} style={{ background: staffIdChanged ? '#9A5B26' : 'var(--bg-subtle)', color: staffIdChanged ? '#FAF8F5' : 'var(--text-muted)', border:'none', fontSize:13.5, fontWeight:600, borderRadius:11, padding:'11px 18px', cursor: staffIdChanged ? 'pointer' : 'not-allowed' }}>Save Staff ID</button>
                )}
              </div>
            </div>

            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:16, padding:16 }}>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'var(--text-primary)' }}>Update password</div>
              {!isSupabaseConfigured && (
                <div style={{ marginTop:12 }}>
                  <div style={lbl}>Current password</div>
                  <PasswordInput value={acctPw.current} onChange={e=>{ setAcctPw(s=>({...s,current:e.target.value})); setAcctPwMsg(null); }} style={inp}/>
                </div>
              )}
              <div style={{ marginTop:12 }}>
                <div style={lbl}>New password</div>
                <PasswordInput value={acctPw.next} onChange={e=>{ setAcctPw(s=>({...s,next:e.target.value})); setAcctPwMsg(null); }} style={inp}/>
                {isSupabaseConfigured && <PasswordChecklist password={acctPw.next}/>}
              </div>
              <div style={{ marginTop:12 }}>
                <div style={lbl}>Confirm new password</div>
                <PasswordInput value={acctPw.confirm} onChange={e=>{ setAcctPw(s=>({...s,confirm:e.target.value})); setAcctPwMsg(null); }} onKeyDown={e=>e.key==='Enter'&&savePw()} style={inp}/>
              </div>
              {acctPwMsg && (
                <div style={{ marginTop:10, fontSize:12, fontWeight:600, color: acctPwMsg.type==='error' ? 'var(--tint-red-text)' : 'var(--tint-green-text)' }}>{acctPwMsg.text}</div>
              )}
              <button onClick={savePw} style={{ marginTop:14, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:13.5, fontWeight:600, borderRadius:11, padding:'11px 18px', cursor:'pointer' }}>Update password</button>
              {!isSupabaseConfigured && (
                <div style={{ marginTop:12, fontSize:11.5, color:'var(--text-muted)', lineHeight:1.5 }}>
                  Forgot your current password? {isSuperActing ? 'As super admin, only another super admin can reset it for you from Admin Roles.' : "Ask a super admin to reset it for you from Admin Roles — you'll set a new one on your next sign-in."}
                </div>
              )}
            </div>

            <button onClick={logout} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'var(--tint-red-bg)', border:'1px solid var(--tint-red-border)', color:'var(--tint-red-text)', fontSize:14, fontWeight:600, borderRadius:14, padding:14, cursor:'pointer', marginTop:4 }}>
              <Icon name="x" size={16} color="var(--tint-red-text)"/>Sign out
            </button>
          </div>
        );
      })()}

      </div>{/* /.tab-panel */}
      <PortalFooter/>
    </div>
  );
}

const lbl = { display:'block', fontSize:12, fontWeight:600, color:'var(--text-primary)', marginBottom:6 };
const inp = { width:'100%', border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'12px 13px', fontSize:16, color:'var(--text-primary)', outline:'none', display:'block' };
