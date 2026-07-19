import { useStore } from '../lib/store';
import VendorAvatar from './VendorAvatar';
import { displayStaffId } from '../lib/supaAdmins';

// Shared sticky glass header for both portals — replaces the old solid-color
// header bar that used to be inlined at the top of AdminDashboard/VendorDashboard.
// `title`/`eyebrow` describe the active tab; the profile block is derived
// straight from the store so both portals get the same real data instead of
// two hand-maintained copies. (The search box/notification bell/settings
// shortcut this header used to also show were decorative — never wired to
// anything — and were removed 2026-07-18.)
export default function PortalHeader({ title, eyebrow }) {
  const { state, set, acting } = useStore();
  const { view, aScreen, vendors, currentVendorId } = state;
  const isAdmin = view === 'admin' && aScreen === 'dashboard';
  const me = view === 'vendor' ? (vendors.find(v => v.id === currentVendorId) || {}) : null;

  const profileName = isAdmin ? (acting?.name || 'Admin') : (me?.business || 'Vendor');
  // Admins see their Staff ID here instead of their role — the role still shows
  // in Admin Roles for anyone managing accounts, but on their own header this ID
  // is what they'd actually need day to day. This is the org-assigned Staff ID
  // (displayStaffId), never the Supabase Auth UUID (acting.id) — those are
  // different things and must stay that way (see PROJECT_NOTES).
  const profileRole = isAdmin ? `Staff ID: ${acting ? displayStaffId(acting) : 'admin'}` : (me?.owner || '');
  const goToAccount = () => { if (isAdmin) set({ aTab: 'account', aScreen: 'dashboard' }); };

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto', minWidth: 0, justifyContent: 'flex-end' }}>
        <button
          onClick={goToAccount}
          title={isAdmin ? 'Go to My Account' : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
            background: 'none', border: 'none', padding: 0, margin: 0,
            cursor: isAdmin ? 'pointer' : 'default', textAlign: 'left', font: 'inherit',
          }}
        >
          {isAdmin
            ? (acting?.avatar
                ? <img src={acting.avatar.url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}/>
                : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Marcellus',serif", fontSize: 14, color: '#FFF8EE', flexShrink: 0 }}>{profileName.charAt(0)}</div>)
            : <VendorAvatar v={me} size={36}/>}
          <div className="header-profile-text" style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{profileName}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{profileRole}</div>
          </div>
        </button>
      </div>
    </div>
  );
}
