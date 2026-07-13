import { useState } from 'react';
import Icon from './Icon';

// Slide-in mobile nav drawer — replaces the old wrapping pill tab bar (which grew to
// several cramped rows once a portal had 10+ tabs) with a single "current tab" trigger
// in the header that opens this full list instead. The "Reorder" toggle is the
// touch-friendly counterpart to the desktop sidebar's drag-to-rearrange: each row
// gains up/down nudge buttons that call onMove(id, ±1).
export default function MobileNavDrawer({ open, onClose, title, subtitle, tabs, activeId, onSelect, onMove, dark }) {
  const [reordering, setReordering] = useState(false);
  if (!open) return null;
  const panelBg = dark ? '#2A1708' : '#FAF8F5';
  const borderC = dark ? '#4A2A0F' : 'var(--border-light)';
  const headC   = dark ? '#FAF8F5' : 'var(--text-primary)';
  const subC    = dark ? 'rgba(250,248,245,0.5)' : 'var(--text-muted)';

  const nudgeBtn = (disabled) => ({
    width: 30, height: 30, borderRadius: 8, border: `1px solid ${borderC}`,
    background: dark ? 'rgba(250,248,245,0.06)' : 'var(--bg-card)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1, flexShrink: 0,
  });

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
          <div style={{ display:'flex', gap:7, alignItems:'center', flexShrink:0 }}>
            {onMove && (
              <button onClick={() => setReordering(r => !r)} style={{
                background: reordering ? (dark ? 'rgba(250,248,245,0.13)' : 'var(--tint-pink-bg)') : (dark ? 'rgba(250,248,245,0.08)' : 'var(--bg-subtle)'),
                border:'none', borderRadius:9, padding:'0 11px', height:32, cursor:'pointer',
                fontFamily:"'Karla'", fontSize:12, fontWeight:700,
                color: reordering ? (dark ? '#FAF8F5' : '#9A5B26') : headC,
              }}>
                {reordering ? 'Done' : 'Reorder'}
              </button>
            )}
            <button onClick={onClose} style={{ background:dark?'rgba(250,248,245,0.08)':'var(--bg-subtle)', border:'none', width:32, height:32, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              <Icon name="x" size={16} color={headC} />
            </button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:9 }}>
          {reordering && (
            <div style={{ fontSize:11, color:subC, lineHeight:1.45, padding:'4px 12px 8px' }}>
              Use the arrows to rearrange your tabs — the order is saved on this device.
            </div>
          )}
          {tabs.map((t, i) => {
            const active = activeId === t.id;
            return (
              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                <button onClick={() => { if (reordering) return; onSelect(t.id); onClose(); }} style={{
                  flex:1, minWidth:0, display:'flex', alignItems:'center', gap:10, textAlign:'left',
                  padding:'11px 12px', borderRadius:11, border:'none', cursor: reordering ? 'default' : 'pointer',
                  fontFamily:"'Karla'", fontSize:14, fontWeight: active ? 700 : 500,
                  background: active ? (dark ? 'rgba(250,248,245,0.13)' : 'var(--tint-pink-bg)') : 'transparent',
                  color: active ? (dark ? '#FAF8F5' : '#9A5B26') : (dark ? 'rgba(250,248,245,0.65)' : 'var(--text-secondary)'),
                }}>
                  {t.icon && <Icon name={t.icon} size={16} color={active ? (dark ? '#FAF8F5' : '#9A5B26') : (dark ? 'rgba(250,248,245,0.5)' : 'var(--text-muted)')} />}
                  <span>{t.label}</span>
                </button>
                {reordering && (
                  <>
                    <button onClick={() => onMove(t.id, -1)} disabled={i === 0} style={nudgeBtn(i === 0)} aria-label={`Move ${t.label} up`}>
                      <Icon name="arrowLeft" size={13} color={headC} style={{ transform:'rotate(90deg)' }} />
                    </button>
                    <button onClick={() => onMove(t.id, 1)} disabled={i === tabs.length - 1} style={nudgeBtn(i === tabs.length - 1)} aria-label={`Move ${t.label} down`}>
                      <Icon name="arrowLeft" size={13} color={headC} style={{ transform:'rotate(-90deg)' }} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
