import Icon from '../components/Icon';
import { useStore } from '../lib/store';
import { fmtShort, fmtTime } from '../lib/helpers';

export default function PublicHome() {
  const { state, set, showToast, closeModals } = useStore();
  const { events, content } = state;

  const today = new Date(); today.setHours(0,0,0,0);
  const goRegister = () => { closeModals(); set({ view:'vendor', vScreen:'register', regStep:1, tcAccepted:false, tcScrolled:false }); };
  const goVendor   = () => { closeModals(); set({ view:'vendor' }); };
  const goAdmin    = () => { closeModals(); set({ view:'admin' }); };

  return (
    <div>
      {/* Sticky nav */}
      <div style={{
        position:'sticky', top:0, zIndex:5,
        display:'flex', justifyContent:'space-between', alignItems:'center', gap:16,
        padding:'13px 22px',
        background:'rgba(250,248,245,0.92)', backdropFilter:'blur(8px)',
        borderBottom:'1px solid #f0e9df',
      }}>
        <img className="home-logo" src="/assets/sulap-lockup.png" alt="Sulap Artisan" style={{ height:40, width:'auto', display:'block' }} />
        <div className="home-topnav" style={{ display:'none', alignItems:'center', gap:4, flexShrink:0 }}>
          <button onClick={goVendor} style={{ background:'none', border:'none', fontSize:13.5, fontWeight:600, color:'#6B6560', borderRadius:9, padding:'8px 13px', cursor:'pointer' }}>Vendor Portal</button>
          <button onClick={goAdmin}  style={{ background:'none', border:'none', fontSize:13.5, fontWeight:600, color:'#6B6560', borderRadius:9, padding:'8px 13px', cursor:'pointer' }}>Admin</button>
          <button onClick={goRegister} style={{ background:'#A6364E', border:'none', fontSize:13.5, fontWeight:600, color:'#FAF8F5', borderRadius:10, padding:'9px 16px', cursor:'pointer', whiteSpace:'nowrap', boxShadow:'0 3px 10px rgba(166,54,78,0.2)' }}>Apply as a Vendor</button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ margin:'0 16px', borderRadius:24, background:'linear-gradient(160deg,#F8E9EE,#F2EDE6)', padding:'24px 22px 26px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', right:-30, top:-30, width:130, height:130, borderRadius:'50%', background:'rgba(199,92,132,0.10)' }}/>
        <div style={{ position:'absolute', right:24, bottom:-40, width:90, height:90, borderRadius:'50%', background:'rgba(166,54,78,0.07)' }}/>
        <span style={{ display:'inline-flex', alignItems:'center', gap:7, background:'#FAF8F5', border:'1px solid #ecdfd0', color:'#2D6A4F', fontSize:12, fontWeight:600, borderRadius:999, padding:'6px 13px' }}>
          <Icon name="leaf" size={14} color="#2D6A4F" />{content.purpose}
        </span>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:30, lineHeight:1.12, fontWeight:600, color:'#1C1A17', marginTop:16 }}>{content.title}</div>
        <div style={{ fontSize:14, lineHeight:1.5, color:'#6B6560', marginTop:12 }}>{content.subtitle}</div>
        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button onClick={goRegister} className="home-cta-primary" style={{ flex:1, background:'#A6364E', color:'#FAF8F5', border:'none', fontSize:14, fontWeight:600, borderRadius:13, padding:'13px 22px', cursor:'pointer', whiteSpace:'nowrap', boxShadow:'0 4px 12px rgba(166,54,78,0.22)' }}>Apply as a Vendor</button>
          <button onClick={goVendor}   style={{ flexShrink:0, background:'#FAF8F5', color:'#A6364E', border:'1px solid #e3d3c1', fontSize:14, fontWeight:600, borderRadius:13, padding:'13px 16px', cursor:'pointer' }}>Portal</button>
        </div>
      </div>

      {/* Upcoming events */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'16px 20px 4px' }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:600, color:'#1C1A17' }}>Upcoming Markets</div>
        <span style={{ fontSize:12, color:'#6B6560' }}>{events.length} events</span>
      </div>

      <div className="event-cards" style={{ padding:'6px 16px 20px' }}>
        {events.map(ev => {
          const open = !ev.lastApp || new Date(ev.lastApp) >= today;
          const timeLabel = ev.startTime && ev.endTime ? `${fmtTime(ev.startTime)} – ${fmtTime(ev.endTime)} daily` : 'Time TBC';
          const totalNonFnb = ev.nonfnb * ev.days;
          return (
            <div key={ev.id} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:20, overflow:'hidden', boxShadow:'0 4px 14px rgba(120,80,40,0.06)' }}>
              <div style={{ height:140, background:ev.img, position:'relative', display:'flex', alignItems:'flex-end' }}>
                <span style={{ position:'absolute', top:10, right:12, display:'inline-flex', alignItems:'center', gap:5, background:'rgba(250,248,245,0.94)', color:open?'#2D6A4F':'#8a6d2e', fontSize:11, fontWeight:600, borderRadius:999, padding:'5px 10px' }}>
                  <Icon name={open?'clock':'lock'} size={13} color={open?'#2D6A4F':'#8a6d2e'} />
                  {open ? (ev.lastApp ? `Apply by ${fmtShort(ev.lastApp)}` : 'Open for applications') : 'Applications closed'}
                </span>
                <div style={{ position:'absolute', inset:0, background:'linear-gradient(rgba(0,0,0,0) 55%,rgba(0,0,0,0.22))', pointerEvents:'none' }}/>
              </div>
              <div style={{ padding:'14px 16px 16px' }}>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:600, color:'#1C1A17', lineHeight:1.15 }}>{ev.name}</div>
                <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#6B6560', marginTop:7 }}>
                  <Icon name="calendar" size={14} color="#A09890" />{ev.dateRange}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#6B6560', marginTop:3 }}>
                  <Icon name="clock" size={14} color="#A09890" />{timeLabel}
                </div>
                <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginTop:12 }}>
                  <span style={{ background:'#E8F5F0', color:'#2D6A4F', fontSize:11.5, fontWeight:600, borderRadius:8, padding:'5px 9px' }}>F&B · RM {ev.fnb}/day</span>
                  <span style={{ background:'#F8E9EE', color:'#A6364E', fontSize:11.5, fontWeight:600, borderRadius:8, padding:'5px 9px' }}>Non-F&B · RM {ev.nonfnb}/day</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:13, paddingTop:13, borderTop:'1px solid #f1ece4' }}>
                  <span style={{ fontSize:12, color:'#A09890' }}>Total {ev.days} days · <span style={{ color:'#1C1A17', fontWeight:600 }}>from RM {totalNonFnb}</span></span>
                  <button
                    onClick={open ? goRegister : () => showToast('Applications closed for this market', 'lock')}
                    style={{ background:open?'#A6364E':'#F2EDE6', color:open?'#FAF8F5':'#A09890', border:'none', fontSize:13, fontWeight:600, borderRadius:10, padding:'8px 16px', cursor:open?'pointer':'not-allowed' }}
                  >{open ? 'Apply' : 'Closed'}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
