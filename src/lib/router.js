// Maps the app's navigation state (view/vScreen/aScreen/vTab/aTab) to/from a
// real URL path, so screens are bookmarkable/shareable and the browser back
// button moves between them — instead of every navigation being invisible
// React state with no address-bar trace (the original audit's complaint).
//
// Deliberately a thin, one-way-safe sync layer, not a full react-router
// rewrite: the store's reducer state stays the single source of truth for
// what renders; this only keeps the address bar and history in step with
// it, so the ~50 existing `set({view:...})` call sites across the app never
// needed to change.
//
// Security note: parsePath() NEVER returns vScreen/aScreen:'dashboard'
// directly from a URL. A tab request comes back as `pendingVendorTab`/
// `pendingAdminTab` instead — store.jsx's session listener is the only place
// that turns a pending tab into an actual dashboard view, and only once a
// real Supabase session has confirmed that role. A bookmarked or typed
// `/admin/settings` with no session just lands on the admin login screen,
// exactly like today; per-tab view/edit permission gating (AdminDashboard's
// own "land on the first visible tab" effect) still applies untouched on
// top of this once a session does resolve.

const VENDOR_TAB_IDS = new Set(['events', 'apps', 'photos', 'eventPics', 'docs', 'payments', 'parking', 'pass', 'compliance', 'profile']);
const ADMIN_TAB_IDS = new Set(['overview', 'vendors', 'vendorList', 'profileReq', 'events', 'apps', 'payments', 'deposits', 'parking', 'photos', 'pass', 'categories', 'activity', 'compliance', 'content', 'settings', 'roles']);
// 'account' (My Account) is deliberately excluded from both sets — reached
// only via the header profile card, never a bookmarkable destination of its
// own, matching ADMIN_TABS' existing `hidden` convention in AdminDashboard.jsx.

export function pathForState({ view, vScreen, aScreen, vTab, aTab }) {
  if (view === 'vendor') {
    if (vScreen === 'register') return '/vendor/register';
    if (vScreen === 'dashboard') return `/vendor/${VENDOR_TAB_IDS.has(vTab) ? vTab : 'events'}`;
    return '/vendor/login';
  }
  if (view === 'admin') {
    if (aScreen === 'dashboard') return `/admin/${ADMIN_TAB_IDS.has(aTab) ? aTab : 'overview'}`;
    return '/admin/login'; // covers 'login' and the mock-only first-sign-in 'reset' step
  }
  return '/';
}

export function parsePath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'vendor') {
    if (parts[1] === 'register') return { view: 'vendor', vScreen: 'register' };
    if (VENDOR_TAB_IDS.has(parts[1])) return { view: 'vendor', vScreen: 'login', pendingVendorTab: parts[1] };
    return { view: 'vendor', vScreen: 'login' };
  }
  if (parts[0] === 'admin') {
    if (ADMIN_TAB_IDS.has(parts[1])) return { view: 'admin', aScreen: 'login', pendingAdminTab: parts[1] };
    return { view: 'admin', aScreen: 'login' };
  }
  return { view: 'public' };
}
