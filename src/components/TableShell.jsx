import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

// Every glass card in this app sets `backdrop-filter` (the blur), which per
// spec makes that card a new *containing block* for any `position: fixed`
// descendant — so a fixed-positioned pager docked at `bottom: 0` resolves
// against the card's own (scrollable) height, not the real viewport, landing
// far below the visible screen instead of pinned to it. `useIsMobile` +
// `createPortal` (below) sidestep this by rendering the mobile dock directly
// under `document.body`, outside every filtered ancestor, once fixed.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

// Shared "glass table" system, originated by the Categories/Payments tabs
// (PROJECT_NOTES rules 29-37) and now reused by every admin list tab, and —
// since 2026-07 — the vendor portal too. Extracted out of AdminDashboard.jsx
// so both dashboards import the same implementation instead of each
// maintaining their own copy.
//
// Was originally hardcoded to the design handoff's own light-only hex/rgba
// palette (rules 31/32/37/43) — reversed 2026-07-18 after a dark-mode
// screenshot showed the sticky pagination footer as a jarring bright-cream
// bar floating on the dark page. Now uses the app's theme-aware `--glass-*`
// tokens (index.css) so the whole card, not just the footer, goes properly
// dark. Per-tab row content (each tab's own hand-authored `.map()` rows) is
// unaffected by this — this file is only the shared shell.

// Numbered-pill pagination (page 1, 2, 3 … last, with a "Page X of Y" label) —
// used where a denser, more modern pager reads better than a plain Prev/Next.
// Fixed "01 02 03 04 05 … last" pill pagination — the head window stays put
// regardless of the active page; Previous/Next still step through every page
// one at a time.
//
// Renders its own docking wrapper (`.pager-dock`, index.css) rather than
// leaving each call site to hand-roll one — on desktop that's a `position:
// sticky` bar pinned to the bottom of the table card (unchanged, always
// shows "Page 1 of 1" even for a single page, so every tab's footer looks
// consistent — a deliberate choice, rule 38). Below 768px, `.pager-dock`
// becomes a `position: fixed` bar docked to the actual screen bottom instead
// — sticky-within-the-card was overlapping the last couple of rows as you
// scrolled through a long list on a short mobile viewport, reading as a
// translucent bar floating over data rather than a footer (rule 48). A fixed
// bar with nothing to page through is a bigger cost on a small screen than
// on desktop, so `.pager-dock--empty` hides it there specifically — see
// rule 48 for why desktop keeps the always-visible "Page 1 of 1" behavior.
export function ModernPager({ total, perPage, page, onPage }) {
  const pages = Math.ceil(total / perPage) || 1;
  const pad = n => String(n).padStart(2, '0');
  const headCount = Math.min(5, pages);
  const head = Array.from({ length: headCount }, (_, i) => i + 1);
  const hasTail = pages > headCount;
  const hasGap = pages > headCount + 1;
  const outlineStyle = (dis) => ({ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10, border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', color:'var(--text-secondary)', fontSize:13, fontWeight:700, cursor:dis?'not-allowed':'pointer', fontFamily:"'Karla',sans-serif", opacity:dis?0.5:1 });
  const gradientStyle = (dis) => ({ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10, border:'none', background:dis?'rgba(154,91,38,0.35)':'var(--accent-gradient)', color:'#FFF8EE', fontSize:13, fontWeight:700, cursor:dis?'not-allowed':'pointer', fontFamily:"'Karla',sans-serif" });
  const pillStyle = (active) => ({ width:34, height:34, borderRadius:10, border:active?'none':'1px solid var(--glass-chip-border)', background:active?'var(--accent-gradient)':'var(--glass-input)', color:active?'#FFF8EE':'var(--text-secondary)', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Karla',sans-serif" });
  const isMobile = useIsMobile();
  const dock = (
    <div className={`pager-dock${pages <= 1 ? ' pager-dock--empty' : ''}`}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12, padding:'16px 14px' }}>
        <div style={{ fontSize:13, color:'var(--text-muted)' }}>Page {page} of {pages}</div>
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          <button disabled={page<=1} onClick={()=>onPage(page-1)} style={outlineStyle(page<=1)}>‹ Previous</button>
          {head.map(n => <button key={n} onClick={()=>onPage(n)} style={pillStyle(n===page)}>{pad(n)}</button>)}
          {hasGap && <span style={{ width:22, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>…</span>}
          {hasTail && <button onClick={()=>onPage(pages)} style={pillStyle(pages===page)}>{pad(pages)}</button>}
          <button disabled={page>=pages} onClick={()=>onPage(page+1)} style={gradientStyle(page>=pages)}>Next ›</button>
        </div>
      </div>
    </div>
  );
  // On mobile the dock is `position: fixed` (index.css) — portaled straight to
  // <body> so it escapes every ancestor glass-card's `backdrop-filter`, which
  // would otherwise trap it as a containing block (see note above). Desktop's
  // `position: sticky` doesn't have that problem, so it stays right in place.
  return isMobile && typeof document !== 'undefined' ? createPortal(dock, document.body) : dock;
}

// The Categories/Payments table look (decorative ambient glow scoped to its
// own clipped layer — never the tab's own overflow, which would silently
// break the sticky footer's `position:sticky` — translucent glass panel,
// header-row + grid-row table, and a sticky `ModernPager` footer) factored
// out so every list tab shares one implementation instead of each
// re-declaring the same ~80 lines of chrome.
export function TableShell({
  title, subtitle, headerAction,
  aboveControls, banner,
  panelTitle,
  searchValue, onSearchChange, searchPlaceholder = 'Search vendor…',
  filterControl, toolbar,
  headerCells, gridTemplate, minWidth = 700,
  isEmpty, emptyMessage,
  children,
  total, perPage, page, onPage,
}) {
  return (
    // `minHeight` keeps the decorative glow circles (sized for a tall, fully-
    // populated page) from dominating short-content tabs — without it, a tab
    // with only 1-2 rows shrinks the wrapper down to roughly the glow circles'
    // own diameter, so they cover almost the entire visible area instead of
    // just softly shading the corners, reading as a heavy smudge/shadow.
    <div style={{ position:'relative', padding:'28px 24px 32px', minHeight:560 }}>
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
        <div style={{ position:'absolute', top:-120, right:-80, width:420, height:420, borderRadius:'50%', background:'radial-gradient(circle at 40% 40%, rgba(233,160,92,0.35), transparent 70%)', filter:'blur(50px)' }}/>
        <div style={{ position:'absolute', bottom:-160, left:-100, width:460, height:460, borderRadius:'50%', background:'radial-gradient(circle at 40% 40%, rgba(154,91,38,0.22), transparent 70%)', filter:'blur(60px)' }}/>
      </div>
      <div style={{ position:'relative', zIndex:1 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:20, flexWrap:'wrap', marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:"'Marcellus',serif", fontWeight:400, fontSize:26, margin:'0 0 6px', color:'var(--text-primary)' }}>{title}</div>
            {subtitle && <div style={{ margin:0, fontSize:14, color:'var(--text-muted)' }}>{subtitle}</div>}
          </div>
          {headerAction}
        </div>

        {aboveControls}
        {banner}

        <div style={{ background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:24, padding:'22px 24px 8px', boxSizing:'border-box', boxShadow:'0 20px 50px rgba(58,34,16,0.12)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap', marginBottom:16 }}>
            <div style={{ fontFamily:"'Marcellus',serif", fontSize:19, color:'var(--text-primary)' }}>{panelTitle}</div>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              {onSearchChange && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px', borderRadius:12, border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', minWidth:200 }}>
                  <Icon name="search" size={15} color="#9A5B26"/>
                  <input value={searchValue} onChange={e=>onSearchChange(e.target.value)} placeholder={searchPlaceholder} style={{ border:'none', outline:'none', background:'transparent', fontSize:13.5, color:'var(--text-primary)', width:'100%', fontFamily:"'Karla',sans-serif" }}/>
                </div>
              )}
              {filterControl}
            </div>
          </div>

          {toolbar}

          <div style={{ overflowX:'auto' }}>
            <div style={{ minWidth }}>
              <div style={{ display:'grid', gridTemplateColumns:gridTemplate, gap:10, alignItems:'center', padding:'0 14px 12px', fontSize:12, fontWeight:700, letterSpacing:'0.06em', color:'var(--text-muted)', textTransform:'uppercase', borderBottom:'1px solid var(--glass-divider)' }}>
                {headerCells}
              </div>
              {isEmpty ? (
                <div style={{ padding:'28px 14px', textAlign:'center', color:'var(--text-muted)', fontSize:13.5 }}>{emptyMessage}</div>
              ) : children}
            </div>
          </div>

          <ModernPager total={total} perPage={perPage} page={page} onPage={onPage}/>
        </div>
      </div>
    </div>
  );
}

// Compact non-sticky table used for a secondary/nested list within a tab that
// already has its own TableShell (e.g. a collapsible "rejected"/"decided"
// sub-list) — same header-row + grid-row look, no duplicate page title/glow.
export function MiniTablePanel({ headerCells, gridTemplate, minWidth = 700, children }) {
  return (
    <div style={{ background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:20, padding:'14px 18px 6px', boxSizing:'border-box', marginTop:13 }}>
      <div style={{ overflowX:'auto' }}>
        <div style={{ minWidth }}>
          <div style={{ display:'grid', gridTemplateColumns:gridTemplate, gap:10, alignItems:'center', padding:'0 12px 10px', fontSize:11.5, fontWeight:700, letterSpacing:'0.06em', color:'var(--text-muted)', textTransform:'uppercase', borderBottom:'1px solid var(--glass-divider)' }}>
            {headerCells}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// Filter-pill control shared by every table's panel header — a native
// `<select>` layered transparent over a styled pill (icon + current value).
export function FilterPill({ icon = 'sliders', label, value, onChange, options }) {
  return (
    <div style={{ position:'relative', display:'inline-flex', alignItems:'center', gap:8, padding:'10px 16px', borderRadius:12, border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)', color:'var(--text-secondary)', fontSize:13.5, fontWeight:700, cursor:'pointer', fontFamily:"'Karla',sans-serif" }}>
      <Icon name={icon} size={14} color="var(--text-secondary)"/>
      <span style={{ whiteSpace:'nowrap' }}>{label}</span>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%' }}>
        {options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

// Round icon-only action button matching the Payments tab's Documents/Actions
// column buttons — tone: 'green' (positive/view), 'red' (destructive),
// 'outline' (neutral), 'muted' (disabled/waiting).
export function IconBtn({ tone = 'outline', size = 30, title, onClick, children, disabled }) {
  const styles = {
    green:  { border:'1px solid var(--tint-green-border)', background:'var(--tint-green-bg)' },
    red:    { border:'1px solid var(--tint-red-border)',   background:'var(--tint-red-bg)' },
    muted:  { border:'1px solid var(--glass-divider)',     background:'var(--glass-divider)' },
    outline:{ border:'1px solid var(--glass-chip-border)', background:'var(--glass-input)' },
  };
  return (
    <button title={title} onClick={onClick} disabled={disabled} style={{ width:size, height:size, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:disabled?'default':'pointer', opacity:disabled?0.5:1, ...styles[tone] }}>
      {children}
    </button>
  );
}
