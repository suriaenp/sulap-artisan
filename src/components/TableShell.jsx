import Icon from './Icon';

// Shared "glass table" system, originated by the Categories/Payments tabs
// (PROJECT_NOTES rules 29-37) and now reused by every admin list tab, and —
// since 2026-07 — the vendor portal too. Extracted out of AdminDashboard.jsx
// so both dashboards import the same implementation instead of each
// maintaining their own copy.
//
// Deliberately hardcoded to the original design handoff's own hex/rgba
// palette rather than the app's `--bg-card`/`--text-primary` theme variables —
// same tradeoff as `Sheet` (rule 19): this panel stays a light cream glass
// card regardless of the admin dark-mode toggle, verified in-browser that
// text stays legible in both modes since the panel background itself never
// goes dark. Not something this pass revisits — see PROJECT_NOTES rule 31/32.

// Numbered-pill pagination (page 1, 2, 3 … last, with a "Page X of Y" label) —
// used where a denser, more modern pager reads better than a plain Prev/Next.
// Fixed "01 02 03 04 05 … last" pill pagination — the head window stays put
// regardless of the active page; Previous/Next still step through every page
// one at a time. Always renders, even for a single page, so every tab's
// sticky footer bar is consistently present instead of disappearing on tabs
// with too little data to need paging.
export function ModernPager({ total, perPage, page, onPage }) {
  const pages = Math.ceil(total / perPage) || 1;
  const pad = n => String(n).padStart(2, '0');
  const headCount = Math.min(5, pages);
  const head = Array.from({ length: headCount }, (_, i) => i + 1);
  const hasTail = pages > headCount;
  const hasGap = pages > headCount + 1;
  const outlineStyle = (dis) => ({ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10, border:'1px solid rgba(154,91,38,0.2)', background:'rgba(255,255,255,0.6)', color:dis?'#B8A48C':'#8A6A4A', fontSize:13, fontWeight:700, cursor:dis?'not-allowed':'pointer', fontFamily:"'Karla',sans-serif", opacity:dis?0.6:1 });
  const gradientStyle = (dis) => ({ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10, border:'none', background:dis?'rgba(154,91,38,0.35)':'linear-gradient(135deg, #B97434, #7A431A)', color:'#FFF8EE', fontSize:13, fontWeight:700, cursor:dis?'not-allowed':'pointer', fontFamily:"'Karla',sans-serif" });
  const pillStyle = (active) => ({ width:34, height:34, borderRadius:10, border:active?'none':'1px solid rgba(154,91,38,0.2)', background:active?'linear-gradient(135deg, #B97434, #7A431A)':'rgba(255,255,255,0.6)', color:active?'#FFF8EE':'#6B4E33', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Karla',sans-serif" });
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12, padding:'16px 14px' }}>
      <div style={{ fontSize:13, color:'#8A6A4A' }}>Page {page} of {pages}</div>
      <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
        <button disabled={page<=1} onClick={()=>onPage(page-1)} style={outlineStyle(page<=1)}>‹ Previous</button>
        {head.map(n => <button key={n} onClick={()=>onPage(n)} style={pillStyle(n===page)}>{pad(n)}</button>)}
        {hasGap && <span style={{ width:22, textAlign:'center', color:'#8A6A4A', fontSize:13 }}>…</span>}
        {hasTail && <button onClick={()=>onPage(pages)} style={pillStyle(pages===page)}>{pad(pages)}</button>}
        <button disabled={page>=pages} onClick={()=>onPage(page+1)} style={gradientStyle(page>=pages)}>Next ›</button>
      </div>
    </div>
  );
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
            <div style={{ fontFamily:"'Marcellus',serif", fontWeight:400, fontSize:26, margin:'0 0 6px', color:'#3A2210' }}>{title}</div>
            {subtitle && <div style={{ margin:0, fontSize:14, color:'#8A6A4A' }}>{subtitle}</div>}
          </div>
          {headerAction}
        </div>

        {aboveControls}
        {banner}

        <div style={{ background:'rgba(255,255,255,0.55)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid rgba(154,91,38,0.16)', borderRadius:24, padding:'22px 24px 8px', boxSizing:'border-box', boxShadow:'0 20px 50px rgba(58,34,16,0.12)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap', marginBottom:16 }}>
            <div style={{ fontFamily:"'Marcellus',serif", fontSize:19, color:'#3A2210' }}>{panelTitle}</div>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              {onSearchChange && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px', borderRadius:12, border:'1px solid rgba(154,91,38,0.2)', background:'rgba(255,255,255,0.6)', minWidth:200 }}>
                  <Icon name="search" size={15} color="#9A5B26"/>
                  <input value={searchValue} onChange={e=>onSearchChange(e.target.value)} placeholder={searchPlaceholder} style={{ border:'none', outline:'none', background:'transparent', fontSize:13.5, color:'#3A2210', width:'100%', fontFamily:"'Karla',sans-serif" }}/>
                </div>
              )}
              {filterControl}
            </div>
          </div>

          {toolbar}

          <div style={{ overflowX:'auto' }}>
            <div style={{ minWidth }}>
              <div style={{ display:'grid', gridTemplateColumns:gridTemplate, gap:10, alignItems:'center', padding:'0 14px 12px', fontSize:12, fontWeight:700, letterSpacing:'0.06em', color:'#8A6A4A', textTransform:'uppercase', borderBottom:'1px solid rgba(154,91,38,0.14)' }}>
                {headerCells}
              </div>
              {isEmpty ? (
                <div style={{ padding:'28px 14px', textAlign:'center', color:'#8A6A4A', fontSize:13.5 }}>{emptyMessage}</div>
              ) : children}
            </div>
          </div>

          <div style={{ position:'sticky', bottom:0, zIndex:5, marginTop:8, background:'rgba(253,246,235,0.94)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', borderTop:'1px solid rgba(154,91,38,0.16)', borderRadius:'0 0 24px 24px' }}>
            <ModernPager total={total} perPage={perPage} page={page} onPage={onPage}/>
          </div>
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
    <div style={{ background:'rgba(255,255,255,0.55)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid rgba(154,91,38,0.16)', borderRadius:20, padding:'14px 18px 6px', boxSizing:'border-box', marginTop:13 }}>
      <div style={{ overflowX:'auto' }}>
        <div style={{ minWidth }}>
          <div style={{ display:'grid', gridTemplateColumns:gridTemplate, gap:10, alignItems:'center', padding:'0 12px 10px', fontSize:11.5, fontWeight:700, letterSpacing:'0.06em', color:'#8A6A4A', textTransform:'uppercase', borderBottom:'1px solid rgba(154,91,38,0.14)' }}>
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
    <div style={{ position:'relative', display:'inline-flex', alignItems:'center', gap:8, padding:'10px 16px', borderRadius:12, border:'1px solid rgba(154,91,38,0.22)', background:'rgba(255,255,255,0.6)', color:'#6B4E33', fontSize:13.5, fontWeight:700, cursor:'pointer', fontFamily:"'Karla',sans-serif" }}>
      <Icon name={icon} size={14} color="#6B4E33"/>
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
    green:  { border:'1px solid rgba(90,145,110,0.3)',  background:'rgba(90,145,110,0.14)' },
    red:    { border:'1px solid rgba(196,74,74,0.3)',   background:'rgba(196,74,74,0.1)' },
    muted:  { border:'1px solid rgba(154,91,38,0.1)',   background:'rgba(154,91,38,0.06)' },
    outline:{ border:'1px solid rgba(154,91,38,0.22)',  background:'rgba(255,255,255,0.6)' },
  };
  return (
    <button title={title} onClick={onClick} disabled={disabled} style={{ width:size, height:size, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:disabled?'default':'pointer', opacity:disabled?0.5:1, ...styles[tone] }}>
      {children}
    </button>
  );
}
