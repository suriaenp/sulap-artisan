import { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import {
  INITIAL_EVENTS, INITIAL_VENDORS, INITIAL_APPS, INITIAL_PAYMENTS, INITIAL_REFUNDS,
  INITIAL_DEPOSITS, INITIAL_OFFENSES, INITIAL_EVENT_PHOTOS, INITIAL_PHOTO_DOWNLOADS, INITIAL_PAY_DOC_DOWNLOADS,
  INITIAL_PARKING, INITIAL_PASSES, INITIAL_CATS, INITIAL_CONTENT, INITIAL_ACTIVITY,
  EVENT_IMG_PALETTE, OFFENSE_TYPES, INITIAL_ADMINS,
} from '../data/mockData';

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
  passes: INITIAL_PASSES,
  cats: INITIAL_CATS,
  content: INITIAL_CONTENT,
  activity: INITIAL_ACTIVITY,
  // Vendor-submitted requests to change locked profile fields (business, owner,
  // category, email, phone, plate, desc, or e-invoice/bank info) — admin must
  // approve before the change lands on the vendor record. See rule 17.
  profileRequests: [],
  settings: { autoApprove:false, publicEvents:true, emailAlerts:true, skipMarkets:1 },
  // admin accounts & the admin currently signed in
  admins: INITIAL_ADMINS,
  currentAdminId: null,
  darkMode: typeof window !== 'undefined' && window.localStorage.getItem('sulap_admin_dark') === '1',
  // modals / drawers
  vendorDetailId: null,
  vendorDetailReturnAppId: null,
  appDetailId: null,
  eventDetailId: null,
  payModalKey: null,
  refundModalKey: null,
  depModalVendor: null,
  passModalVendor: null,
  docPreview: null,       // { payKey, field, editable } — payment doc preview modal
  showApplyModal: false,
  applyEventId: null,
  applyShare: null,
  applyPartners: [],
  applyPartnerSearch: '',
  // forms
  pf: {},
  payf: {},
  reff: {},
  depf: {},
  rf: { business:'', owner:'', email:'', phone:'', desc:'', password:'', ig:'', fb:'', tiktok:'', plate:'', power:'', photos:[] },
  ef: { name:'', start:'', end:'', startTime:'', endTime:'', lastApp:'', fnb:'', nonfnb:'', img:EVENT_IMG_PALETTE[0] },
  eef: { name:'', location:'', start:'', end:'', startTime:'', endTime:'', lastApp:'', fnb:'', nonfnb:'', img:EVENT_IMG_PALETTE[0] },
  cf: null,
  catEditId: null,
  expandedCats: {},  // { 'c-fnb': true, 'c-craft': false, ... }
  newCat: '',
  newOffType: '',
  // filters & pagination
  filterEvent: 'e1',
  page: 1,
  PER_PAGE: 20,
  appsTab: 'apps', // 'apps' | 'shortlist' — sub-tab under Event Applications
  // compliance
  compTab: 'log',
  compSel: {},
  // chart
  chartPeriod: 'all',
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
    case 'MERGE_APPS': return { ...state, apps: action.payload };
    case 'MERGE_PAYMENTS': return { ...state, payments: { ...state.payments, ...action.payload } };
    case 'MERGE_REFUNDS': return { ...state, refunds: { ...state.refunds, ...action.payload } };
    case 'MERGE_DEPOSITS': return { ...state, deposits: { ...state.deposits, ...action.payload } };
    case 'MERGE_OFFENSES': return { ...state, offenses: action.payload };
    case 'MERGE_OFFENSE_TYPES': return { ...state, offenseTypes: action.payload };
    case 'MERGE_PASSES': return { ...state, passes: { ...state.passes, ...action.payload } };
    case 'MERGE_PARKING': return { ...state, parking: { ...state.parking, ...action.payload } };
    case 'MERGE_PHOTOS': return { ...state, eventPhotos: { ...state.eventPhotos, ...action.payload } };
    case 'MERGE_PHOTO_DOWNLOADS': return { ...state, photoDownloads: { ...state.photoDownloads, ...action.payload } };
    case 'MERGE_PAY_DOC_DOWNLOADS': return { ...state, payDocDownloads: { ...state.payDocDownloads, ...action.payload } };
    case 'MERGE_CATS': return { ...state, cats: action.payload };
    case 'MERGE_PROFILE_REQUESTS': return { ...state, profileRequests: action.payload };
    case 'MERGE_ADMINS': return { ...state, admins: action.payload };
    case 'LOG_ACTIVITY': return { ...state, activity: [action.payload, ...state.activity] };
    default: return state;
  }
}

const StoreContext = createContext(null);

// set() payload keys that count as edits when an admin only has view access.
// Includes the keys that open edit modals, so those never open in view-only.
const EDIT_SET_KEYS = ['content','settings','parkOverride','compOverrides','payModalKey','refundModalKey','depModalVendor','passModalVendor','eventDetailId'];

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INIT);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, icon = 'check') => {
    dispatch({ type: 'SET', payload: { toast: msg, toastIcon: icon } });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => dispatch({ type: 'SET', payload: { toast: null } }), 2400);
  }, []);

  // ── Admin permissions (RBAC) ──
  // Super admins bypass everything. Staff perms map tabId → 'view' | 'edit';
  // a missing tab means no access. Enforcement is central: every data
  // mutation flows through dispatch/set below, so modals are covered too.
  const acting = state.currentAdminId ? state.admins.find(a => a.id === state.currentAdminId) : null;
  const isSuper = !acting || acting.role === 'super';
  const canViewTab = (tab) => isSuper || acting.perms?.[tab] === 'view' || acting.perms?.[tab] === 'edit';
  const canEditTab = (tab) => isSuper || acting.perms?.[tab] === 'edit';
  const adminLocked = state.view === 'admin' && state.aScreen === 'dashboard' && !canEditTab(state.aTab);

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
    dispatch({ type: 'SET', payload });
  };

  const logActivity = (who, what, opts = {}) => {
    if (adminLocked) return; // a blocked action must not leave a log entry
    const { type = 'admin', icon = 'check', tint = '#F8E9EE' } = opts;
    const when = 'Today ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    dispatch({ type: 'LOG_ACTIVITY', payload: { who, what, when, tint, icon, type } });
  };

  const closeModals = () => set({
    vendorDetailId: null, vendorDetailReturnAppId: null, appDetailId: null, eventDetailId: null, payModalKey: null,
    refundModalKey: null, depModalVendor: null, passModalVendor: null, docPreview: null, showApplyModal: false,
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
