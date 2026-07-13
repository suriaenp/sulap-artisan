import { useRef, useState } from 'react';
import Icon from './Icon';
import { useStore } from '../lib/store';
import { orderTabs, reorderIds } from '../lib/helpers';
import { ADMIN_TABS } from '../pages/AdminDashboard';
import { VENDOR_TABS } from '../pages/VendorDashboard';

export default function Sidebar() {
  const { state, set, closeModals, acting, canViewTab } = useStore();
  const { view, vScreen, aScreen, vTab, aTab, vTabOrder, aTabOrder } = state;
  const isVendor = view === 'vendor' && vScreen === 'dashboard';
  const isAdmin  = view === 'admin'  && aScreen === 'dashboard';
  const isSuperActing = !acting || acting.role === 'super';
  const vendorTabs = orderTabs(VENDOR_TABS, vTabOrder);
  const adminTabs  = orderTabs(ADMIN_TABS.filter(t => t.superOnly ? isSuperActing : canViewTab(t.id)), aTabOrder);

  // ── Drag-to-reorder ──
  // Any tab row can be dragged onto another to move it there; the new order is
  // saved per device (vTabOrder/aTabOrder → localStorage). RBAC-hidden admin
  // tabs keep their position: the drop is applied to the full ADMIN_TABS order.
  const [dragId, setDragId] = useState(null); // for visual feedback
  const [overId, setOverId] = useState(null);
  const dragIdRef = useRef(null); // drop logic reads the ref — state may lag a render behind
  const dropTab = (targetId) => {
    const dragId = dragIdRef.current;
    if (!dragId || dragId === targetId) return;
    if (isVendor) {
      set({ vTabOrder: reorderIds(vendorTabs.map(t => t.id), dragId, targetId) });
    } else {
      set({ aTabOrder: reorderIds(orderTabs(ADMIN_TABS, aTabOrder).map(t => t.id), dragId, targetId) });
    }
  };
  const dragProps = (t) => ({
    draggable: true,
    title: 'Drag to rearrange',
    onDragStart: (e) => { if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; dragIdRef.current = t.id; setDragId(t.id); },
    onDragOver: (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; if (overId !== t.id) setOverId(t.id); },
    onDragLeave: () => { if (overId === t.id) setOverId(null); },
    onDrop: (e) => { e.preventDefault(); dropTab(t.id); dragIdRef.current = null; setDragId(null); setOverId(null); },
    onDragEnd: () => { dragIdRef.current = null; setDragId(null); setOverId(null); },
  });

  const bg    = isAdmin ? '#2A1708' : '#FAF8F5';
  const borderC = isAdmin ? '#4A2A0F' : 'var(--border-light)';
  const headC   = isAdmin ? '#FAF8F5' : 'var(--text-primary)';
  const subC    = isAdmin ? 'rgba(250,248,245,0.45)' : 'var(--text-muted)';

  const sideNavStyle = (active, t) => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: 9,
    padding: '9px 12px', borderRadius: 11,
    fontFamily: "'Karla'", fontSize: 13.5, cursor: 'pointer',
    border: 'none', textAlign: 'left',
    background: active
      ? (isAdmin ? 'rgba(250,248,245,0.13)' : 'var(--tint-pink-bg)')
      : 'transparent',
    color: active
      ? (isAdmin ? '#FAF8F5' : '#9A5B26')
      : (isAdmin ? 'rgba(250,248,245,0.55)' : 'var(--text-secondary)'),
    fontWeight: active ? 600 : 500,
    // drag feedback: dim the row being dragged, draw an insert line on the drop target
    opacity: dragId === t.id ? 0.45 : 1,
    boxShadow: overId === t.id && dragId && dragId !== t.id ? 'inset 0 2px 0 0 #B97434' : 'none',
  });

  return (
    <div className="app-sidebar" style={{ background: bg, borderRight: `1px solid ${borderC}` }}>
      {/* Logo */}
      <div style={{ padding: '20px 18px 16px', borderBottom: `1px solid ${borderC}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/assets/sulap-mark.png" alt="Sulap" style={{ height: 32, width: 'auto' }} />
          <div>
            <div style={{ fontFamily: "'Marcellus',serif", fontSize: 15, fontWeight: 400, color: headC, lineHeight: 1.1 }}>Sulap Artisan</div>
            <div style={{ fontSize: 10, letterSpacing: '0.04em', color: subC, marginTop: 2 }}>
              {isAdmin ? 'Admin Console' : 'Vendor Registration'}
            </div>
          </div>
        </div>
      </div>

      {/* Nav items — the Sidebar only renders inside a signed-in portal now (sign-in and
          register screens use AuthLayout), so only the contextual tab list is needed;
          Sign out (in the header) is how you leave. */}
      <div className="themed-scroll" style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 16px' }}>
        {/* Vendor portal tabs */}
        {isVendor && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '4px 12px 6px' }}>MY PORTAL</div>
            {vendorTabs.map(t => (
              <button key={t.id} {...dragProps(t)} style={sideNavStyle(vTab===t.id, t)} onClick={() => { closeModals(); set({ vTab:t.id, page:1 }); }}>
                <Icon name={t.icon} size={16} color={vTab===t.id ? '#9A5B26' : 'var(--text-muted)'} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Admin tabs */}
        {isAdmin && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(250,248,245,0.45)', padding: '4px 12px 6px' }}>CONSOLE</div>
            {adminTabs.map(t => (
              <button key={t.id} {...dragProps(t)} style={sideNavStyle(aTab===t.id, t)} onClick={() => { closeModals(); set({ aTab:t.id, page:1 }); }}>
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
