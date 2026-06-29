import { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import {
  INITIAL_EVENTS, INITIAL_VENDORS, INITIAL_APPS, INITIAL_PAYMENTS,
  INITIAL_DEPOSITS, INITIAL_OFFENSES, INITIAL_EVENT_PHOTOS,
  INITIAL_PARKING, INITIAL_PASSES, INITIAL_CATS, INITIAL_CONTENT,
} from '../data/mockData';

const INIT = {
  // navigation
  view: 'public',       // 'public' | 'vendor' | 'admin'
  vScreen: 'login',     // 'login' | 'register' | 'dashboard'
  aScreen: 'login',     // 'login' | 'dashboard'
  pubScreen: 'home',
  vTab: 'events',
  aTab: 'overview',
  regStep: 1,
  selectedCat: null,
  tcAccepted: false,
  tcScrolled: false,
  // data
  events: INITIAL_EVENTS,
  vendors: INITIAL_VENDORS,
  apps: INITIAL_APPS,
  payments: INITIAL_PAYMENTS,
  deposits: INITIAL_DEPOSITS,
  offenses: INITIAL_OFFENSES,
  eventPhotos: INITIAL_EVENT_PHOTOS,
  parking: INITIAL_PARKING,
  passes: INITIAL_PASSES,
  cats: INITIAL_CATS,
  content: INITIAL_CONTENT,
  settings: { autoApprove:false, publicEvents:true, emailAlerts:true },
  // modals / drawers
  vendorDetailId: null,
  appDetailId: null,
  payModalKey: null,
  depModalVendor: null,
  passModalVendor: null,
  showApplyModal: false,
  applyEventId: null,
  applyShare: null,
  applyPartners: [],
  applyPartnerSearch: '',
  // forms
  pf: {},
  payf: {},
  depf: {},
  ef: { name:'', start:'', end:'', startTime:'', endTime:'', lastApp:'', fnb:'', nonfnb:'' },
  cf: null,
  newCat: '',
  // filters & pagination
  filterEvent: 'e1',
  page: 1,
  PER_PAGE: 15,
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
    case 'MERGE_DEPOSITS': return { ...state, deposits: { ...state.deposits, ...action.payload } };
    case 'MERGE_OFFENSES': return { ...state, offenses: action.payload };
    case 'MERGE_PASSES': return { ...state, passes: { ...state.passes, ...action.payload } };
    case 'MERGE_PARKING': return { ...state, parking: { ...state.parking, ...action.payload } };
    case 'MERGE_PHOTOS': return { ...state, eventPhotos: { ...state.eventPhotos, ...action.payload } };
    case 'MERGE_CATS': return { ...state, cats: action.payload };
    default: return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INIT);
  const toastTimer = useRef(null);

  const set = useCallback((payload) => dispatch({ type: 'SET', payload }), []);

  const showToast = useCallback((msg, icon = 'check') => {
    dispatch({ type: 'SET', payload: { toast: msg, toastIcon: icon } });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => dispatch({ type: 'SET', payload: { toast: null } }), 2400);
  }, []);

  const closeModals = useCallback(() => set({
    vendorDetailId: null, appDetailId: null, payModalKey: null,
    depModalVendor: null, passModalVendor: null, showApplyModal: false,
    applyEventId: null,
  }), [set]);

  return (
    <StoreContext.Provider value={{ state, dispatch, set, showToast, closeModals }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
