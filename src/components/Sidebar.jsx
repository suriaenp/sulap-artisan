import Icon from './Icon';
import { useStore } from '../lib/store';
import { ADMIN_TABS } from '../pages/AdminDashboard';

const VENDOR_TABS = [
  { id:'events',   label:'Available Markets', icon:'calendar' },
  { id:'apps',     label:'My Applications',   icon:'clipboard' },
  { id:'photos',   label:'Product Photos',    icon:'image' },
  { id:'eventPics',label:'Event Pictures',    icon:'camera' },
  { id:'docs',     label:'Documents',         icon:'file' },
  { id:'payments', label:'Payments',          icon:'receipt' },
  { id:'parking',  label:'Parking',           icon:'car' },
  { id:'pass',     label:'Vendor Pass',       icon:'badge' },
  { id:'compliance', label:'Compliance',      icon:'shield' },
  { id:'profile',  label:'Profile',           icon:'users' },
];

export default function Sidebar() {
  const { state, set, closeModals, acting, canViewTab } = useStore();
  const { view, vScreen, aScreen, vTab, aTab } = state;
  const isVendor = view === 'vendor' && vScreen === 'dashboard';
  const isAdmin  = view === 'admin'  && aScreen === 'dashboard';
  const isSuperActing = !acting || acting.role === 'super';
  const adminTabs = ADMIN_TABS.filter(t => t.superOnly ? isSuperActing : canViewTab(t.id));

  const bg    = isAdmin ? '#2A1C1E' : '#FAF8F5';
  const borderC = isAdmin ? '#3d2528' : 'var(--border-light)';
  const headC   = isAdmin ? '#FAF8F5' : 'var(--text-primary)';
  const subC    = isAdmin ? 'rgba(250,248,245,0.45)' : 'var(--text-muted)';

  const sideNavStyle = (active) => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: 9,
    padding: '9px 12px', borderRadius: 11,
    fontFamily: "'DM Sans'", fontSize: 13.5, cursor: 'pointer',
    border: 'none', textAlign: 'left',
    background: active
      ? (isAdmin ? 'rgba(250,248,245,0.13)' : 'var(--tint-pink-bg)')
      : 'transparent',
    color: active
      ? (isAdmin ? '#FAF8F5' : '#A6364E')
      : (isAdmin ? 'rgba(250,248,245,0.55)' : 'var(--text-secondary)'),
    fontWeight: active ? 600 : 500,
  });

  return (
    <div className="app-sidebar" style={{ background: bg, borderRight: `1px solid ${borderC}` }}>
      {/* Logo */}
      <div style={{ padding: '20px 18px 16px', borderBottom: `1px solid ${borderC}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/assets/sulap-mark.png" alt="Sulap" style={{ height: 32, width: 'auto' }} />
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: headC, lineHeight: 1.1 }}>Sulap Artisan</div>
            <div style={{ fontSize: 10, letterSpacing: '0.04em', color: subC, marginTop: 2 }}>
              {isAdmin ? 'Admin Console' : 'Vendor Registration'}
            </div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 16px' }}>
        {/* Main nav */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: subC, padding: '8px 12px 6px' }}>NAVIGATE</div>
        {[
          { label:'Home',          icon:'home',     action:() => { closeModals(); set({ view:'public', pubScreen:'home' }); }, active: view==='public' },
          { label:'Apply as Vendor', icon:'pen',    action:() => { closeModals(); set({ view:'vendor', vScreen:'register', regStep:1, tcAccepted:false, tcScrolled:false }); }, active: view==='vendor' && vScreen==='register' },
          { label:'Vendor Portal', icon:'bag',      action:() => { closeModals(); set({ view:'vendor' }); }, active: isVendor },
          { label:'Admin Console', icon:'settings', action:() => { closeModals(); set({ view:'admin' }); },  active: isAdmin },
        ].map(n => (
          <button key={n.label} style={sideNavStyle(n.active)} onClick={n.action}>
            <Icon name={n.icon} size={16} color={n.active ? (isAdmin?'#FAF8F5':'#A6364E') : (isAdmin?'rgba(250,248,245,0.55)':'var(--text-muted)')} />
            <span>{n.label}</span>
          </button>
        ))}

        {/* Vendor portal tabs */}
        {isVendor && (
          <div style={{ borderTop: '1px solid var(--border-light)', marginTop: 10, paddingTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '4px 12px 6px' }}>MY PORTAL</div>
            {VENDOR_TABS.map(t => (
              <button key={t.id} style={sideNavStyle(vTab===t.id)} onClick={() => { closeModals(); set({ vTab:t.id, page:1 }); }}>
                <Icon name={t.icon} size={16} color={vTab===t.id ? '#A6364E' : 'var(--text-muted)'} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Admin tabs */}
        {isAdmin && (
          <div style={{ borderTop: '1px solid #3d2528', marginTop: 10, paddingTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(250,248,245,0.45)', padding: '4px 12px 6px' }}>CONSOLE</div>
            {adminTabs.map(t => (
              <button key={t.id} style={sideNavStyle(aTab===t.id)} onClick={() => { closeModals(); set({ aTab:t.id, page:1 }); }}>
                <Icon name={t.icon} size={16} color={aTab===t.id ? '#FAF8F5' : 'rgba(250,248,245,0.55)'} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
