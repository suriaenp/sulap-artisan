import { useStore } from '../lib/store';
import { CURRENT_VENDOR_ID } from '../data/mockData';
import Icon from './Icon';
import VendorAvatar from './VendorAvatar';

// Shared sticky glass header for both portals — replaces the old solid-color
// header bar that used to be inlined at the top of AdminDashboard/VendorDashboard.
// `title`/`eyebrow` describe the active tab; everything else (search, bell,
// settings shortcut, profile) is derived straight from the store so both
// portals get the same real data instead of two hand-maintained copies.
export default function PortalHeader({ title, eyebrow }) {
  const { state, set, acting } = useStore();
  const { view, aScreen, vScreen, vendors } = state;
  const isAdmin = view === 'admin' && aScreen === 'dashboard';
  const me = view === 'vendor' ? (vendors.find(v => v.id === CURRENT_VENDOR_ID) || {}) : null;

  const profileName = isAdmin ? (acting?.name || 'Admin') : (me?.business || 'Vendor');
  const profileRole = isAdmin ? (acting ? (acting.role === 'super' ? 'Super admin' : 'Staff admin') : 'Super admin') : (me?.owner || '');
  const goSettings = () => { if (isAdmin) set({ aTab: 'settings', page: 1 }); else set({ vTab: 'profile', page: 1 }); };

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
      background: 'var(--glass-header)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--glass-chip-border)',
      padding: '14px 20px', boxSizing: 'border-box',
    }}>
      <div style={{ flex: '0 0 auto', minWidth: 0 }}>
        {eyebrow && <div style={{ fontSize: 12, fontWeight: 700, color: '#9A5B26', marginBottom: 2 }}>{eyebrow}</div>}
        <h1 style={{ fontFamily: "'Marcellus',serif", fontWeight: 400, fontSize: 22, margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{title}</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 auto', minWidth: 0, justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 999, border: '1px solid var(--glass-chip-border)', background: 'var(--glass-input)', flex: '0 1 200px', minWidth: 80, maxWidth: 220 }}>
          <input placeholder={isAdmin ? 'Search vendors, events…' : 'Search…'} readOnly
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)', fontFamily: "'Karla',sans-serif", flex: '1 1 auto', minWidth: 0, width: '100%' }}/>
          <Icon name="search" size={14} color="#9A5B26" style={{ flexShrink: 0 }}/>
        </div>
        <button title="Notifications" style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'var(--glass-divider)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#7A431A', position: 'relative', flexShrink: 0 }}>
          <Icon name="bell" size={16} color="currentColor"/>
          <span style={{ position: 'absolute', top: 8, right: 9, width: 6, height: 6, borderRadius: '50%', background: '#B23A3A', border: '1.5px solid var(--glass-header)' }}/>
        </button>
        <button title="Settings" onClick={goSettings} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'var(--glass-divider)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#7A431A', flexShrink: 0 }}>
          <Icon name="settings" size={16} color="currentColor"/>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isAdmin
            ? <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Marcellus',serif", fontSize: 14, color: '#FFF8EE', flexShrink: 0 }}>{profileName.charAt(0)}</div>
            : <VendorAvatar v={me} size={36}/>}
          <div className="header-profile-text" style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{profileName}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{profileRole}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
