import { useEffect, useRef } from 'react';
import Icon from './Icon';
import { useModalA11y } from '../lib/useModalA11y';

// Slide-in mobile nav drawer — replaces the old wrapping pill tab bar (which grew to
// several cramped rows once a portal had 10+ tabs) with a single "current tab" trigger
// in the header that opens this full list instead. Tab order comes pre-arranged from
// the store (set by a super admin in Settings → Portal tab order) — no reorder
// controls here.
//
// Motion: enters and exits along the same path (slides left), the scrim fades with
// the panel's progress, and the panel can be swiped closed — it tracks the finger
// 1:1 (with rubber-banding when dragged the wrong way), and on release either
// commits or springs back based on velocity, not just position. Under
// prefers-reduced-motion everything becomes a plain fade/instant dismiss.

const CLOSE_MS = 260;
const EASE_SHEET = 'cubic-bezier(0.32, 0.72, 0, 1)';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Progressive resistance past the closed edge (dragging right) — real things
// slow before they stop instead of hitting a wall.
const rubberband = (overshoot, dimension, constant = 0.55) =>
  (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));

export default function MobileNavDrawer({ open, onClose, title, subtitle, tabs, activeId, onSelect, dark, showThemeToggle, darkMode, onToggleDark, onLogout }) {
  const panelRef = useRef(null);
  const scrimRef = useRef(null);
  const drag = useRef(null); // { startX, active, history: [{x,t}] }
  const closingRef = useRef(false);

  // Reset the closing latch whenever the drawer is (re)opened
  useEffect(() => { if (open) closingRef.current = false; }, [open]);

  // `() => requestClose()` (not `requestClose` directly) since this call sits
  // above requestClose's own declaration further down — safe because the
  // closure is only ever invoked later, asynchronously, on an actual Escape
  // keypress, by which point requestClose is long since assigned.
  useModalA11y(() => requestClose(), open, panelRef);

  if (!open) return null;

  const setPanelX = (x, animate) => {
    const p = panelRef.current, s = scrimRef.current;
    if (!p) return;
    p.style.transition = animate ? `transform ${CLOSE_MS}ms ${EASE_SHEET}` : 'none';
    p.style.transform = `translateX(${x}px)`;
    if (s) {
      const w = p.offsetWidth || 300;
      s.style.transition = animate ? `opacity ${CLOSE_MS}ms ease` : 'none';
      s.style.opacity = String(Math.max(0, Math.min(1, 1 + x / w)));
    }
  };

  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (prefersReducedMotion() || !panelRef.current) { onClose(); return; }
    // exit mirrors the entrance: slide back out to the left, scrim fades with it
    setPanelX(-(panelRef.current.offsetWidth || 300), true);
    setTimeout(onClose, CLOSE_MS);
  };

  // ── Swipe-to-close: 1:1 tracking after a ~10px hysteresis threshold ──
  const onPointerDown = (e) => {
    if (closingRef.current) return;
    drag.current = { startX: e.clientX, active: false, history: [{ x: e.clientX, t: e.timeStamp }] };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || closingRef.current) return;
    const dx = e.clientX - d.startX;
    if (!d.active) {
      if (Math.abs(dx) < 10) return; // hysteresis — don't hijack taps
      d.active = true;
      panelRef.current?.setPointerCapture?.(e.pointerId);
    }
    d.history.push({ x: e.clientX, t: e.timeStamp });
    if (d.history.length > 6) d.history.shift();
    const w = panelRef.current?.offsetWidth || 300;
    // left = toward closed (1:1); right = past the boundary (rubber-band)
    setPanelX(dx < 0 ? dx : rubberband(dx, w), false);
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active || closingRef.current || !panelRef.current) return;
    const dx = e.clientX - d.startX;
    // release velocity from the recent pointer history (px/s)
    const a = d.history[0], b = d.history[d.history.length - 1];
    const vel = b.t > a.t ? ((b.x - a.x) / (b.t - a.t)) * 1000 : 0;
    const w = panelRef.current.offsetWidth || 300;
    // the velocity's direction decides; position is the fallback
    if (vel < -400 || (vel <= 60 && dx < -w * 0.4)) {
      closingRef.current = true;
      setPanelX(-w, true);
      setTimeout(onClose, CLOSE_MS);
    } else {
      setPanelX(0, true); // spring back home
    }
  };

  const panelBg = dark ? '#2A1708' : '#FAF8F5';
  const borderC = dark ? '#4A2A0F' : 'var(--border-light)';
  const headC   = dark ? '#FAF8F5' : 'var(--text-primary)';
  const subC    = dark ? 'rgba(250,248,245,0.5)' : 'var(--text-muted)';

  return (
    <div onClick={requestClose} style={{ position:'fixed', inset:0, zIndex:90, display:'flex' }}>
      <div ref={scrimRef} style={{ position:'absolute', inset:0, background:'rgba(28,26,23,0.5)', animation:'scrimIn .25s ease' }}/>
      <div ref={panelRef} onClick={e=>e.stopPropagation()} className="themed-scroll"
        role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        style={{
          width:'82%', maxWidth:300, height:'100%', background:panelBg,
          display:'flex', flexDirection:'column', boxShadow:'4px 0 24px rgba(0,0,0,0.18)',
          animation:`drawerIn .3s ${EASE_SHEET}`,
          position:'relative', touchAction:'pan-y', outline:'none',
        }}>
        <div style={{ padding:'18px 16px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:`1px solid ${borderC}`, flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:headC }}>{title}</div>
            {subtitle && <div style={{ fontSize:11, color:subC, marginTop:2 }}>{subtitle}</div>}
          </div>
          <button onClick={requestClose} style={{ background:dark?'rgba(250,248,245,0.08)':'var(--bg-subtle)', border:'none', width:32, height:32, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
            <Icon name="x" size={16} color={headC} />
          </button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:9 }}>
          {tabs.map(t => {
            const active = activeId === t.id;
            return (
              <button key={t.id} onClick={() => { onSelect(t.id); requestClose(); }} style={{
                width:'100%', display:'flex', alignItems:'center', gap:10, textAlign:'left',
                padding:'11px 12px', borderRadius:11, border:'none', marginBottom:2, cursor:'pointer',
                fontFamily:"'Karla'", fontSize:14, fontWeight: active ? 700 : 500,
                background: active ? (dark ? 'rgba(250,248,245,0.13)' : 'var(--tint-pink-bg)') : 'transparent',
                color: active ? (dark ? '#FAF8F5' : '#9A5B26') : (dark ? 'rgba(250,248,245,0.65)' : 'var(--text-secondary)'),
              }}>
                {t.icon && <Icon name={t.icon} size={16} color={active ? (dark ? '#FAF8F5' : '#9A5B26') : (dark ? 'rgba(250,248,245,0.5)' : 'var(--text-muted)')} />}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Theme toggle (admin only) + sign out — mirrors the desktop Sidebar's
            footer since this drawer replaces that sidebar below 768px. */}
        {(showThemeToggle || onLogout) && (
          <div style={{ padding:'10px 9px 14px', borderTop:`1px solid ${borderC}`, flexShrink:0 }}>
            {showThemeToggle && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'9px 12px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Icon name={darkMode ? 'moon' : 'sun'} size={15} color={subC} />
                  <span style={{ fontSize:13, fontWeight:600, color:subC }}>{darkMode ? 'Dark Mode' : 'Light Mode'}</span>
                </div>
                <button onClick={onToggleDark} aria-label="Toggle dark mode" style={{ width:40, height:22, borderRadius:999, border:'none', padding:2, cursor:'pointer', flexShrink:0, boxSizing:'border-box', background: darkMode ? 'var(--accent-gradient)' : 'rgba(154,91,38,0.2)' }}>
                  <span style={{ display:'block', width:18, height:18, borderRadius:'50%', background:'#FFF8EE', boxShadow:'0 2px 6px rgba(0,0,0,0.25)', transform: darkMode ? 'translateX(18px)' : 'translateX(0)', transition:'transform 0.2s ease' }}/>
                </button>
              </div>
            )}
            {onLogout && (
              <button onClick={() => { onLogout(); requestClose(); }} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, textAlign:'left', padding:'11px 12px', borderRadius:11, border:'none', cursor:'pointer', fontFamily:"'Karla'", fontSize:14, fontWeight:600, background:'transparent', color:subC }}>
                <Icon name="logout" size={16} color={subC} />
                <span>Sign out</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
