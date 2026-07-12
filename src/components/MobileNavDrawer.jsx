import Icon from './Icon';

// Slide-in mobile nav drawer — replaces the old wrapping pill tab bar (which grew to
// several cramped rows once a portal had 10+ tabs) with a single "current tab" trigger
// in the header that opens this full list instead.
export default function MobileNavDrawer({ open, onClose, title, subtitle, tabs, activeId, onSelect, dark }) {
  if (!open) return null;
  const panelBg = dark ? '#2A1708' : '#FAF8F5';
  const borderC = dark ? '#4A2A0F' : 'var(--border-light)';
  const headC   = dark ? '#FAF8F5' : 'var(--text-primary)';
  const subC    = dark ? 'rgba(250,248,245,0.5)' : 'var(--text-muted)';

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:90, background:'rgba(28,26,23,0.5)', display:'flex' }}>
      <div onClick={e=>e.stopPropagation()} className="themed-scroll" style={{
        width:'82%', maxWidth:300, height:'100%', background:panelBg,
        display:'flex', flexDirection:'column', boxShadow:'4px 0 24px rgba(0,0,0,0.18)',
        animation:'drawerIn .22s ease',
      }}>
        <div style={{ padding:'18px 16px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:`1px solid ${borderC}`, flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:headC }}>{title}</div>
            {subtitle && <div style={{ fontSize:11, color:subC, marginTop:2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ background:dark?'rgba(250,248,245,0.08)':'var(--bg-subtle)', border:'none', width:32, height:32, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
            <Icon name="x" size={16} color={headC} />
          </button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:9 }}>
          {tabs.map(t => {
            const active = activeId === t.id;
            return (
              <button key={t.id} onClick={() => { onSelect(t.id); onClose(); }} style={{
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
      </div>
    </div>
  );
}
