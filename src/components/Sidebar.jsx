import Icon from './Icon';
import { useStore } from '../lib/store';
import { orderTabs } from '../lib/helpers';
import { ADMIN_TABS } from '../pages/AdminDashboard';
import { VENDOR_TABS } from '../pages/VendorDashboard';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export default function Sidebar() {
  const { state, set, closeModals, acting, canViewTab, showToast } = useStore();
  const { view, vScreen, aScreen, vTab, aTab, vTabOrder, aTabOrder, darkMode } = state;
  const isVendor = view === 'vendor' && vScreen === 'dashboard';
  const isAdmin  = view === 'admin'  && aScreen === 'dashboard';
  const isSuperActing = !acting || acting.role === 'super';
  // Tab order is set globally by a super admin (Settings → Portal tab order) —
  // vendors and staff admins just see the arranged order, no reorder controls here.
  const vendorTabs = orderTabs(VENDOR_TABS, vTabOrder);
  const adminTabs  = orderTabs(ADMIN_TABS.filter(t => !t.hidden && (t.superOnly ? isSuperActing : canViewTab(t.id))), aTabOrder);

  const logout = () => {
    if (isAdmin) set({ aScreen: 'login', currentAdminId: null });
    else if (isVendor) {
      if (isSupabaseConfigured) supabase.auth.signOut();
      set({ vScreen: 'login', currentVendorId: null });
    }
    showToast('Signed out', 'leaf');
  };

  const sideNavStyle = (active) => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
    padding: '11px 14px', borderRadius: 12,
    fontFamily: "'Karla'", fontSize: 14, cursor: 'pointer',
    border: 'none', textAlign: 'left',
    background: active ? 'var(--accent-gradient)' : 'transparent',
    boxShadow: active ? '0 6px 16px rgba(122,67,26,0.3)' : 'none',
    color: active ? '#FFF8EE' : 'var(--text-muted)',
    fontWeight: active ? 700 : 600,
  });

  return (
    <div className="app-sidebar themed-scroll" style={{
      background: 'var(--glass-sidebar)',
      backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
      borderRight: '1px solid var(--glass-card-border)',
      padding: '22px 16px', boxSizing: 'border-box',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px 22px', flexShrink: 0 }}>
        <img src="/assets/sulap-mark.png" alt="Sulap" style={{ width: 32, height: 'auto' }} />
        <div>
          <div style={{ fontFamily: "'Marcellus',serif", fontSize: 15, fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1.15 }}>Sulap Artisan</div>
          <div style={{ fontSize: 10, letterSpacing: '0.08em', fontWeight: 700, color: '#9A5B26', marginTop: 2 }}>
            {isAdmin ? 'ORGANIZER PORTAL' : 'VENDOR PORTAL'}
          </div>
        </div>
      </div>

      {/* Nav items — the Sidebar only renders inside a signed-in portal now (sign-in and
          register screens use AuthLayout), so only the contextual tab list is needed. */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 12 }}>
        {isVendor && vendorTabs.map(t => (
          <button key={t.id} style={sideNavStyle(vTab===t.id)} onClick={() => { closeModals(); set({ vTab:t.id, page:1 }); }}>
            <Icon name={t.icon} size={17} color={vTab===t.id ? '#FFF8EE' : 'var(--text-muted)'} />
            <span>{t.label}</span>
          </button>
        ))}
        {isAdmin && adminTabs.map(t => (
          <button key={t.id} style={sideNavStyle(aTab===t.id)} onClick={() => { closeModals(); set({ aTab:t.id, page:1 }); }}>
            <Icon name={t.icon} size={17} color={aTab===t.id ? '#FFF8EE' : 'var(--text-muted)'} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Theme toggle (admin only — the vendor portal has no dark mode) + sign out */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0 }}>
        {isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '4px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name={darkMode ? 'moon' : 'sun'} size={16} color="var(--text-secondary)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{darkMode ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <button
              onClick={() => set({ darkMode: !darkMode })}
              aria-label="Toggle dark mode"
              style={{
                width: 44, height: 24, borderRadius: 999, border: 'none', padding: 2, cursor: 'pointer',
                flexShrink: 0, boxSizing: 'border-box',
                background: darkMode ? 'var(--accent-gradient)' : 'rgba(154,91,38,0.2)',
              }}
            >
              <span style={{
                display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#FFF8EE',
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                transform: darkMode ? 'translateX(20px)' : 'translateX(0)',
                transition: 'transform 0.2s ease',
              }}/>
            </button>
          </div>
        )}
        <div style={{ height: 1, background: 'var(--glass-divider)' }}/>
        <button onClick={logout} style={sideNavStyle(false)}>
          <Icon name="logout" size={17} color="var(--text-muted)" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}
