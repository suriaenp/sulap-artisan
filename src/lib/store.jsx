import { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import {
  INITIAL_EVENTS, INITIAL_VENDORS, INITIAL_APPS, INITIAL_PAYMENTS, INITIAL_REFUNDS,
  INITIAL_DEPOSITS, INITIAL_OFFENSES, INITIAL_EVENT_PHOTOS, INITIAL_PHOTO_DOWNLOADS, INITIAL_PAY_DOC_DOWNLOADS,
  INITIAL_PARKING, INITIAL_PASS_APPS, INITIAL_CATS, INITIAL_CONTENT, INITIAL_ACTIVITY,
  EVENT_IMG_PALETTE, OFFENSE_TYPES, INITIAL_ADMINS, INITIAL_PROFILE_REQUESTS,
} from '../data/mockData';
import { supabase, isSupabaseConfigured } from './supabase';
import { fetchVendorByUserId, completeRegistrationFromDraft } from './supaVendors';
import { fetchProfileByUserId, rowToAdmin } from './supaAdmins';
import { fetchAllEvents } from './supaEvents';
import { fetchAppsByVendorId } from './supaApps';
import { fetchPaymentsByVendorId, fetchDepositByVendorId } from './supaPayments';
import { fetchProfileRequestsByVendor } from './supaProfileRequests';

function readTabOrder(key) {
  try {
    const v = JSON.parse(window.localStorage.getItem(key));
    return Array.isArray(v) && v.length ? v : null;
  } catch { return null; }
}

const INIT = {
  // navigation
  view: 'public',       // 'public' | 'vendor' | 'admin'
  vScreen: 'login',     // 'login' | 'register' | 'dashboard'
  aScreen: 'login',     // 'login' | 'reset' | 'dashboard'
  pubScreen: 'home',
  vTab: 'events',
  aTab: 'overview',
  regStep: 1,
  regResult: null,
  selectedCat: null,
  tcAccepted: false,
  tcScrolled: false,
  // the vendor account currently signed in to the vendor portal (null =
  // signed out) — set by VendorLogin from a real email+password match against
  // the vendor records, replacing the old hardcoded CURRENT_VENDOR_ID.
  currentVendorId: null,
  // data
  events: INITIAL_EVENTS,
  vendors: INITIAL_VENDORS,
  apps: INITIAL_APPS,
  payments: INITIAL_PAYMENTS,
  refunds: INITIAL_REFUNDS,
  deposits: INITIAL_DEPOSITS,
  offenses: INITIAL_OFFENSES,
  offenseTypes: OFFENSE_TYPES,
  compOverrides: {},      // `${vendorId}-${eventId}` → true when admin overrides a compliance hold
  eventPhotos: INITIAL_EVENT_PHOTOS,
  photoDownloads: INITIAL_PHOTO_DOWNLOADS,
  payDocDownloads: INITIAL_PAY_DOC_DOWNLOADS,
  parking: INITIAL_PARKING,
  passApps: INITIAL_PASS_APPS,
  cats: INITIAL_CATS,
  content: INITIAL_CONTENT,
  activity: INITIAL_ACTIVITY,
  // Vendor-submitted requests to change locked profile fields (business, owner,
  // category, email, phone, plate, desc, or e-invoice/bank info) — admin must
  // approve before the change lands on the vendor record. See rule 17.
  profileRequests: INITIAL_PROFILE_REQUESTS,
  settings: { autoApprove:false, publicEvents:true, emailAlerts:true, skipMarkets:1 },
  // admin accounts & the admin currently signed in — the mock roster only
  // applies in mock mode; once Supabase is connected, real admins populate
  // this via UPSERT_ADMIN/MERGE_ADMINS_FROM_SERVER as they're encountered
  // (own login, or the Admin Roles tab's full-list fetch), so leftover mock
  // entries ('admin'/'staff01') never sit in the list looking real.
  admins: isSupabaseConfigured ? [] : INITIAL_ADMINS,
  currentAdminId: null,
  darkMode: typeof window !== 'undefined' && window.localStorage.getItem('sulap_admin_dark') === '1',
  // user-rearranged portal tab order (array of tab ids, null = code-defined order)
  vTabOrder: readTabOrder('sulap_vtab_order'),
  aTabOrder: readTabOrder('sulap_atab_order'),
  // modals / drawers
  vendorDetailId: null,
  vendorDetailReturnAppId: null,
  appDetailId: null,
  eventDetailId: null,
  payModalKey: null,
  refundModalKey: null,
  depModalVendor: null,
  docPreview: null,       // { payKey, field, editable } — payment doc preview modal
  passPhotoPreview: null, // { name, photo } — pass-holder photo preview modal
  showApplyModal: false,
  applyEventId: null,
  applyShare: null,
  applyPartners: [],
  applyPartnerSearch: '',
  // forms
  payf: {},
  reff: {},
  depf: {},
  rf: { business:'', owner:'', email:'', phone:'', desc:'', password:'', ig:'', fb:'', tiktok:'', plate:'', power:'', photos:[], logo:null },
  ef: { name:'', location:'', start:'', end:'', startTime:'', endTime:'', lastApp:'', fnb:'', nonfnb:'', img:EVENT_IMG_PALETTE[0] },
  eef: { name:'', location:'', start:'', end:'', startTime:'', endTime:'', lastApp:'', fnb:'', nonfnb:'', img:EVENT_IMG_PALETTE[0] },
  cf: null,
  catEditId: null,
  catFilter: 'all',  // category name, or 'all' — filters the Categories tab's vendor table
  newCat: '',
  newOffType: '',
  // filters & pagination
  filterEvent: 'e1',
  page: 1,
  PER_PAGE: 20,
  appsTab: 'apps', // 'apps' | 'shortlist' — sub-tab under Event Applications
  // compliance
  compTab: 'log',
  // activity
  actTab: 'all',
  // parking override (unlock entry outside event dates for testing)
  parkOverride: false,
  // toast
  toast: null,
  toastIcon: 'check',
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET': return { ...state, ...action.payload };
    case 'MERGE_EVENTS': return { ...state, events: action.payload };
    case 'MERGE_VENDORS': return { ...state, vendors: action.payload };
    // Inserts or replaces a single vendor by id — reads current reducer state
    // directly (not a stale closure), used by the Supabase session listener
    // below where "current vendors" can't be captured at effect-mount time.
    case 'UPSERT_VENDOR': {
      const v = action.payload;
      const exists = state.vendors.some(x => x.id === v.id);
      return { ...state, vendors: exists ? state.vendors.map(x => x.id === v.id ? v : x) : [...state.vendors, v] };
    }
    // Merges the real, complete vendor roster in alongside the seeded demo
    // vendors (not a replacement — dozens of still-mock tabs join against
    // the demo vendors by id, so dropping them would leave those tabs
    // looking broken until the rest of the data layer is wired too).
    case 'MERGE_VENDORS_FROM_SERVER': {
      const byId = new Map(state.vendors.map(v => [v.id, v]));
      action.payload.forEach(v => byId.set(v.id, v));
      return { ...state, vendors: [...byId.values()] };
    }
    // Merges real events in alongside the seeded demo ones — same
    // merge-not-replace reasoning as MERGE_VENDORS_FROM_SERVER below.
    case 'MERGE_EVENTS_FROM_SERVER': {
      const byId = new Map(state.events.map(e => [e.id, e]));
      action.payload.forEach(e => byId.set(e.id, e));
      return { ...state, events: [...byId.values()] };
    }
    case 'MERGE_APPS': return { ...state, apps: action.payload };
    // Merges real applications in alongside the seeded demo ones (byId), same
    // merge-not-replace pattern as events/vendors/admins.
    case 'MERGE_APPS_FROM_SERVER': {
      const byId = new Map(state.apps.map(a => [a.id, a]));
      action.payload.forEach(a => byId.set(a.id, a));
      return { ...state, apps: [...byId.values()] };
    }
    case 'MERGE_PAYMENTS': return { ...state, payments: { ...state.payments, ...action.payload } };
    case 'MERGE_REFUNDS': return { ...state, refunds: { ...state.refunds, ...action.payload } };
    case 'MERGE_DEPOSITS': return { ...state, deposits: { ...state.deposits, ...action.payload } };
    case 'MERGE_OFFENSES': return { ...state, offenses: action.payload };
    case 'MERGE_OFFENSE_TYPES': return { ...state, offenseTypes: action.payload };
    case 'MERGE_PASS_APPS': return { ...state, passApps: action.payload };
    case 'MERGE_PARKING': return { ...state, parking: { ...state.parking, ...action.payload } };
    case 'MERGE_PHOTOS': return { ...state, eventPhotos: { ...state.eventPhotos, ...action.payload } };
    case 'MERGE_PHOTO_DOWNLOADS': return { ...state, photoDownloads: { ...state.photoDownloads, ...action.payload } };
    case 'MERGE_PAY_DOC_DOWNLOADS': return { ...state, payDocDownloads: { ...state.payDocDownloads, ...action.payload } };
    case 'MERGE_CATS': return { ...state, cats: action.payload };
    case 'MERGE_PROFILE_REQUESTS': return { ...state, profileRequests: action.payload };
    // Merges real requests in alongside any local-session demo ones (byId),
    // same merge-not-replace pattern as events/vendors/apps — unlike
    // MERGE_PROFILE_REQUESTS above (a full replace, used when the caller
    // already has the complete recomputed array in hand).
    case 'MERGE_PROFILE_REQUESTS_FROM_SERVER': {
      const byId = new Map(state.profileRequests.map(r => [r.id, r]));
      action.payload.forEach(r => byId.set(r.id, r));
      return { ...state, profileRequests: [...byId.values()] };
    }
    case 'MERGE_ADMINS': return { ...state, admins: action.payload };
    // Insert-or-replace-by-id, same pattern as UPSERT_VENDOR — used when the
    // signed-in admin's own profile arrives from the session listener.
    case 'UPSERT_ADMIN': {
      const a = action.payload;
      const exists = state.admins.some(x => x.id === a.id);
      return { ...state, admins: exists ? state.admins.map(x => x.id === a.id ? a : x) : [...state.admins, a] };
    }
    // Merges a full fetched admin list in — keeps any entry already present
    // (e.g. the acting admin's own row from UPSERT_ADMIN) while adding/
    // updating everyone else, so the Admin Roles tab shows every real admin,
    // not just whoever has logged in during this session.
    case 'MERGE_ADMINS_FROM_SERVER': {
      const byId = new Map(state.admins.map(a => [a.id, a]));
      action.payload.forEach(a => byId.set(a.id, a));
      return { ...state, admins: [...byId.values()] };
    }
    case 'LOG_ACTIVITY': return { ...state, activity: [action.payload, ...state.activity] };
    default: return state;
  }
}

const StoreContext = createContext(null);

// set() payload keys that count as edits when an admin only has view access.
// Includes the keys that open edit modals, so those never open in view-only.
const EDIT_SET_KEYS = ['content','settings','parkOverride','compOverrides','payModalKey','refundModalKey','depModalVendor','eventDetailId','vTabOrder','aTabOrder'];

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INIT);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, icon = 'check') => {
    dispatch({ type: 'SET', payload: { toast: msg, toastIcon: icon } });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => dispatch({ type: 'SET', payload: { toast: null } }), 2400);
  }, []);

  // ── Supabase events fetch ──
  // Events are public-read under RLS (anon included), so this runs once on
  // load for everyone — no session required. Real events merge in alongside
  // the seeded demo ones and flow to the public "Coming Soon" carousel, the
  // vendor portal's Available Markets, and the admin Events rail alike.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetchAllEvents()
      .then(evs => { if (evs.length) dispatch({ type: 'MERGE_EVENTS_FROM_SERVER', payload: evs }); })
      .catch(e => console.error('Events fetch failed:', e));
  }, []);

  // ── Supabase session sync ──
  // Single place that reacts to "there's an authenticated Supabase session" —
  // covers page-load session restore, the email-confirmation redirect landing,
  // and interactive sign-in for BOTH portals (VendorLogin/AdminLogin just call
  // signInWithPassword and let this listener finish the job, so the lookup +
  // routing logic isn't duplicated per screen). The profile's `role` decides
  // which portal a session belongs to — so signing in via the "wrong" screen
  // still routes correctly (a vendor's credentials typed into the admin form
  // land them on their own vendor dashboard, never inside the admin console).
  // TOKEN_REFRESHED/USER_UPDATED are explicitly ignored so a silently-
  // refreshing token never re-triggers navigation for someone just browsing.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const routeSession = async (session) => {
      try {
        const profile = await fetchProfileByUserId(session.user.id);
        if (!profile) return; // the signup trigger always creates one — defensive only

        if (profile.role === 'staff' || profile.role === 'super') {
          dispatch({ type: 'UPSERT_ADMIN', payload: rowToAdmin(profile) });
          dispatch({ type: 'SET', payload: { currentAdminId: profile.id, view: 'admin', aScreen: 'dashboard', aTab: 'overview', page: 1 } });
          return;
        }

        let vendor = await fetchVendorByUserId(session.user.id);
        if (!vendor) vendor = await completeRegistrationFromDraft(session);
        if (!vendor) return; // confirmed session, but no vendor row/draft for it — leave the UI as-is
        dispatch({ type: 'UPSERT_VENDOR', payload: vendor });
        if (vendor.status === 'approved') {
          dispatch({ type: 'SET', payload: { currentVendorId: vendor.id, view: 'vendor', vScreen: 'dashboard', vTab: 'events', page: 1 } });
          // This vendor's real event applications (My Applications / Payments /
          // Available Markets' "already applied" gate survive a refresh).
          // Non-blocking: routing shouldn't wait on it.
          fetchAppsByVendorId(vendor.id)
            .then(list => { if (list.length) dispatch({ type: 'MERGE_APPS_FROM_SERVER', payload: list }); })
            .catch(e => console.error('Applications fetch failed:', e));
          // Their payment records + deposit status too — the Payments tab's
          // amounts (and whether the RM100 deposit is folded into the next
          // total, see payCalc) must survive a refresh as well.
          fetchPaymentsByVendorId(vendor.id)
            .then(map => { if (Object.keys(map).length) dispatch({ type: 'MERGE_PAYMENTS', payload: map }); })
            .catch(e => console.error('Payments fetch failed:', e));
          fetchDepositByVendorId(vendor.id)
            .then(map => { if (map) dispatch({ type: 'MERGE_DEPOSITS', payload: map }); })
            .catch(e => console.error('Deposit fetch failed:', e));
          // Any pending "Vendor details"/E-Invoice-edit change request, so the
          // Profile tab's "pending admin review" banner survives a refresh.
          fetchProfileRequestsByVendor(vendor.id)
            .then(list => { if (list.length) dispatch({ type: 'MERGE_PROFILE_REQUESTS_FROM_SERVER', payload: list }); })
            .catch(e => console.error('Profile requests fetch failed:', e));
        } else {
          const msg = vendor.status === 'pending'
            ? "Your application is still under review — we'll email you once you're approved"
            : vendor.status === 'rejected'
            ? 'Your vendor application was not approved. Contact Sulap Artisan for details.'
            : 'Your vendor account is suspended. Contact Sulap Artisan for details.';
          showToast(msg, 'lock');
          dispatch({ type: 'SET', payload: { view: 'vendor', vScreen: 'login' } });
        }
      } catch (e) { console.error('Session sync failed:', e); }
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { dispatch({ type: 'SET', payload: { currentVendorId: null, currentAdminId: null } }); return; }
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
      if (session) routeSession(session);
    });
    return () => sub.subscription.unsubscribe();
  }, [showToast]);

  // ── Admin permissions (RBAC) ──
  // Super admins bypass everything. Staff perms map tabId → 'view' | 'edit';
  // a missing tab means no access. Enforcement is central: every data
  // mutation flows through dispatch/set below, so modals are covered too.
  const acting = state.currentAdminId ? state.admins.find(a => a.id === state.currentAdminId) : null;
  const isSuper = !acting || acting.role === 'super';
  const canViewTab = (tab) => isSuper || acting.perms?.[tab] === 'view' || acting.perms?.[tab] === 'edit';
  const canEditTab = (tab) => isSuper || acting.perms?.[tab] === 'edit';
  // The personal Account tab (own name/password/photo) is never gated by the
  // view/edit permission system — every admin can always edit their own profile.
  const adminLocked = state.view === 'admin' && state.aScreen === 'dashboard' && state.aTab !== 'account' && !canEditTab(state.aTab);

  const blockedToast = () => {
    clearTimeout(toastTimer.current);
    // fires after any optimistic success toast so the block message wins
    setTimeout(() => showToast('View-only access — ask a super admin for edit rights', 'lock'), 80);
  };

  const guardedDispatch = (action) => {
    if (adminLocked && action.type !== 'SET') { blockedToast(); return; }
    dispatch(action);
  };

  const set = (payload) => {
    if (adminLocked) {
      const hit = Object.keys(payload).some(k => EDIT_SET_KEYS.includes(k) && payload[k] != null && payload[k] !== false);
      if (hit) { blockedToast(); return; }
      if (payload.docPreview?.editable) payload = { ...payload, docPreview: { ...payload.docPreview, editable: false } };
    }
    if ('darkMode' in payload) {
      try { window.localStorage.setItem('sulap_admin_dark', payload.darkMode ? '1' : '0'); } catch {}
    }
    // tab order is a per-device UI preference, persisted like darkMode
    if ('vTabOrder' in payload) {
      try { window.localStorage.setItem('sulap_vtab_order', JSON.stringify(payload.vTabOrder)); } catch {}
    }
    if ('aTabOrder' in payload) {
      try { window.localStorage.setItem('sulap_atab_order', JSON.stringify(payload.aTabOrder)); } catch {}
    }
    dispatch({ type: 'SET', payload });
  };

  const logActivity = (who, what, opts = {}) => {
    if (adminLocked) return; // a blocked action must not leave a log entry
    const { type = 'admin', icon = 'check', tint = '#F3E4CC' } = opts;
    const when = 'Today ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    dispatch({ type: 'LOG_ACTIVITY', payload: { who, what, when, tint, icon, type } });
  };

  const closeModals = () => set({
    vendorDetailId: null, vendorDetailReturnAppId: null, appDetailId: null, eventDetailId: null, payModalKey: null,
    refundModalKey: null, depModalVendor: null, docPreview: null, passPhotoPreview: null, showApplyModal: false,
    applyEventId: null,
  });

  return (
    <StoreContext.Provider value={{ state, dispatch: guardedDispatch, set, showToast, closeModals, logActivity, acting, canViewTab, canEditTab }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
