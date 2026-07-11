import Icon from './Icon';
import Badge from './Badge';
import { useStore } from '../lib/store';
import { OFFENSE_TYPES, CURRENT_VENDOR_ID, EVENT_IMG_PALETTE } from '../data/mockData';
import { dayCount, fmtShort, money } from '../lib/helpers';

// ── shared sheet wrapper ──────────────────────────────────────────────────────
function Sheet({ onClose, children, maxW = 560, centered = false }) {
  return (
    <div onClick={onClose} style={{ position:'absolute', inset:0, zIndex:70, background:'rgba(28,26,23,0.5)', display:'flex', alignItems: centered ? 'center' : 'flex-end', justifyContent:'center', padding: centered ? 24 : 0 }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:maxW, background:'#FAF8F5', borderRadius: centered ? 20 : '26px 26px 0 0', padding:'22px 22px 30px', maxHeight:'90%', overflowY:'auto', animation:'modalIn 0.22s ease' }}>
        {!centered && <div style={{ width:40, height:4, borderRadius:3, background:'#ddd2c4', margin:'0 auto 16px' }}/>}
        {children}
      </div>
    </div>
  );
}

function SheetHeader({ title, sub, onClose }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
      <div style={{ minWidth:0 }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:600, color:'#1C1A17' }}>{title}</div>
        {sub && <div style={{ fontSize:13, color:'#6B6560', marginTop:2 }}>{sub}</div>}
      </div>
      <button onClick={onClose} style={{ background:'#F2EDE6', border:'none', width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', color:'#1C1A17', cursor:'pointer', flexShrink:0 }}>
        <Icon name="x" size={17} color="#1C1A17"/>
      </button>
    </div>
  );
}

// ── Vendor Application Detail ─────────────────────────────────────────────────
export function VendorDetailModal() {
  const { state, dispatch, set, showToast, logActivity } = useStore();
  const { vendorDetailId, vendorDetailReturnAppId, vendors, settings } = state;
  if (!vendorDetailId) return null;
  const v = vendors.find(x=>x.id===vendorDetailId)||{};
  const tileColors = ['linear-gradient(135deg,#F0D8DD,#C75C84)','linear-gradient(135deg,#cdbBa0,#8B6F4E)','linear-gradient(135deg,#d8c0a8,#9c7a52)'];
  const close = () => vendorDetailReturnAppId
    ? set({vendorDetailId:null, vendorDetailReturnAppId:null, appDetailId:vendorDetailReturnAppId})
    : set({vendorDetailId:null});
  return (
    <Sheet onClose={close} centered>
      <SheetHeader title={v.business} sub={`${v.owner} · ${v.category}`} onClose={close}/>
      <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginTop:12 }}>
        <Badge status={v.status}/>
      </div>
      <div style={{ fontSize:13.5, color:'#4a443e', lineHeight:1.55, marginTop:14 }}>{v.desc}</div>
      <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:14, padding:'13px 14px', marginTop:14, display:'flex', flexDirection:'column', gap:9 }}>
        {[['mail',v.email],['phone',v.phone],['instagram',`${v.ig} · ${v.fb}`]].map(([icon,val]) => (
          <div key={icon} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12.5, color:'#4a443e' }}>
            <Icon name={icon} size={14} color="#A09890"/>{val}
          </div>
        ))}
        <div style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12.5, color:'#4a443e' }}>
          <Icon name="info" size={14} color="#A09890" style={{ marginTop:2 }}/><span>Power: {v.power}</span>
        </div>
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:'#1C1A17', margin:'16px 2px 8px' }}>Product photos</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:9 }}>
        {tileColors.slice(0,v.photos||2).map((bg,i)=><div key={i} style={{ width:96, height:96, borderRadius:12, background:bg }}/>)}
      </div>
      {v.status === 'pending' && (
        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button onClick={()=>{ dispatch({type:'MERGE_VENDORS',payload:vendors.map(x=>x.id===vendorDetailId?{...x,status:'approved'}:x)}); logActivity('Admin', `approved ${v.business} as a vendor.`, {icon:'check', tint:'#F8E9EE'}); showToast('Vendor approved'+(settings.emailAlerts?' · vendor emailed':''),'check'); close(); }} style={{ flex:1, background:'#2D6A4F', color:'#fff', border:'none', fontSize:14, fontWeight:600, borderRadius:12, padding:13, cursor:'pointer' }}>Approve vendor</button>
          <button onClick={()=>{ dispatch({type:'MERGE_VENDORS',payload:vendors.map(x=>x.id===vendorDetailId?{...x,status:'rejected'}:x)}); logActivity('Admin', `rejected ${v.business}'s vendor application.`, {icon:'x', tint:'#FDEEEC'}); showToast('Vendor rejected'+(settings.emailAlerts?' · vendor emailed':''),'x'); close(); }} style={{ flex:1, background:'#FDEEEC', color:'#B03A2E', border:'none', fontSize:14, fontWeight:600, borderRadius:12, padding:13, cursor:'pointer' }}>Reject</button>
        </div>
      )}
      {v.status === 'approved' && (
        <div style={{ marginTop:24, paddingTop:14, borderTop:'1px solid #efe7dc', textAlign:'center' }}>
          <button
            onClick={()=>{
              if (!window.confirm(`Suspend ${v.business}? They will lose access to apply for markets until reinstated.`)) return;
              dispatch({type:'MERGE_VENDORS',payload:vendors.map(x=>x.id===vendorDetailId?{...x,status:'suspended'}:x)});
              logActivity('Admin', `suspended ${v.business}.`, {icon:'shield', tint:'#F2EDE6'});
              showToast('Vendor suspended'+(settings.emailAlerts?' · vendor emailed':''),'shield');
              close();
            }}
            style={{ background:'none', border:'none', color:'#A09890', fontSize:11.5, fontWeight:600, padding:'4px 8px', cursor:'pointer', textDecoration:'underline', textUnderlineOffset:3 }}
          >
            Suspend vendor
          </button>
        </div>
      )}
      {v.status === 'suspended' && (
        <div style={{ marginTop:20 }}>
          <button onClick={()=>{ dispatch({type:'MERGE_VENDORS',payload:vendors.map(x=>x.id===vendorDetailId?{...x,status:'approved'}:x)}); logActivity('Admin', `reinstated ${v.business}.`, {icon:'check', tint:'#E8F5F0'}); showToast('Vendor reinstated'+(settings.emailAlerts?' · vendor emailed':''),'check'); close(); }} style={{ width:'100%', background:'#2D6A4F', color:'#fff', border:'none', fontSize:14, fontWeight:600, borderRadius:12, padding:13, cursor:'pointer' }}>Reinstate vendor</button>
        </div>
      )}
    </Sheet>
  );
}

// ── Event Application Detail ──────────────────────────────────────────────────
export function AppDetailModal() {
  const { state, dispatch, set, showToast } = useStore();
  const { appDetailId, apps, vendors, events } = state;
  if (!appDetailId) return null;
  const a = apps.find(x=>x.id===appDetailId)||{};
  const v = vendors.find(x=>x.id===a.vendorId)||{};
  const ev = events.find(x=>x.id===a.eventId)||{};
  const partners = (a.partners||[]).map(pid=>vendors.find(x=>x.id===pid)).filter(Boolean);
  const tileColors = ['linear-gradient(135deg,#F0D8DD,#C75C84)','linear-gradient(135deg,#cdbBa0,#8B6F4E)','linear-gradient(135deg,#d8c0a8,#9c7a52)'];
  const close = () => set({appDetailId:null});
  return (
    <Sheet onClose={close} centered>
      <SheetHeader title={v.business} sub={`${ev.name} · ${v.category}`} onClose={close}/>
      <span style={{ display:'inline-block', marginTop:8 }}><Badge status={a.status}/></span>
      <div style={{ fontSize:13.5, color:'#4a443e', lineHeight:1.55, marginTop:13 }}>{v.desc}</div>
      <div style={{ fontSize:12, fontWeight:700, color:'#1C1A17', margin:'15px 2px 8px' }}>Product photos</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:9 }}>
        {tileColors.slice(0,v.photos||2).map((bg,i)=><div key={i} style={{ width:88, height:88, borderRadius:12, background:bg }}/>)}
      </div>
      <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:16, padding:15, marginTop:18 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Icon name="users" size={17} color="#A6364E"/><div style={{ fontSize:14, fontWeight:700, color:'#1C1A17' }}>Booth sharing</div>
        </div>
        <div style={{ fontSize:11.5, color:'#A09890', marginTop:4, lineHeight:1.45 }}>Declared by the vendor when they applied.</div>
        {a.shared && partners.length > 0 ? (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:12 }}>
              {partners.map(p => (
                <div key={p.id} onClick={()=>set({appDetailId:null, vendorDetailId:p.id, vendorDetailReturnAppId:appDetailId})} style={{ display:'flex', alignItems:'center', gap:10, background:'#F8E9EE', borderRadius:11, padding:'9px 11px', cursor:'pointer' }}>
                  <Icon name="users" size={15} color="#A6364E"/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#1C1A17' }}>{p.business}</div>
                    <div style={{ fontSize:11, color:'#A09890' }}>{p.category}</div>
                  </div>
                  <span style={{ fontSize:16, color:'#A09890' }}>›</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:11.5, color:'#6B6560', marginTop:10 }}>Sharing one booth · {partners.length} partner(s) + this vendor</div>
          </>
        ) : (
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#FBF7F1', borderRadius:11, padding:'11px 13px', marginTop:12, fontSize:12.5, color:'#6B6560' }}>
            <Icon name="tent" size={15} color="#A09890"/>Solo booth — not sharing.
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ── Event Detail / Edit Modal ─────────────────────────────────────────────────
export function EventDetailModal() {
  const { state, dispatch, set, showToast, logActivity } = useStore();
  const { eventDetailId, eef, events } = state;
  if (!eventDetailId) return null;
  const ev = events.find(x=>x.id===eventDetailId)||{};
  const close = () => set({eventDetailId:null});
  const upd = (k,val) => set({eef:{...eef,[k]:val}});
  const inp = { width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:11, padding:'11px 12px', fontSize:14, outline:'none' };
  const d = dayCount(eef.start,eef.end)||1;
  const fnbTotal = Number(eef.fnb||0)*d*1.06;
  const nfTotal  = Number(eef.nonfnb||0)*d*1.06;
  const save = () => {
    if (!eef.name) { showToast('Event name is required','info'); return; }
    const dateRange = eef.start && eef.end ? `${fmtShort(eef.start)} – ${fmtShort(eef.end)} ${new Date(eef.end).getFullYear()}` : 'Dates TBC';
    dispatch({type:'MERGE_EVENTS',payload:events.map(x=>x.id===eventDetailId ? {
      ...x,
      name:eef.name,
      location:eef.location,
      dateRange,
      days:d,
      startDate:eef.start,
      endDate:eef.end,
      startTime:eef.startTime,
      endTime:eef.endTime,
      lastApp:eef.lastApp,
      fnb:Number(eef.fnb)||0,
      nonfnb:Number(eef.nonfnb)||0,
      img:eef.img||EVENT_IMG_PALETTE[0],
    } : x)});
    logActivity('Admin', `updated details for the ${eef.name} event.`, {icon:'tent', tint:'#E8F5F0'});
    showToast('Event updated','check');
    close();
  };
  return (
    <Sheet onClose={close} centered maxW={520}>
      <SheetHeader title="Edit event" sub={ev.name} onClose={close}/>
      <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:13 }}>
        <div><div style={lbl}>Event name</div><input value={eef.name} onChange={e=>upd('name',e.target.value)} placeholder="e.g. Harvest Night Market" style={inp}/></div>
        <div><div style={lbl}>Location</div><input value={eef.location} onChange={e=>upd('location',e.target.value)} placeholder="e.g. Suria Sabah Mall" style={inp}/></div>
        <div>
          <div style={lbl}>Event image</div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:76, height:46, borderRadius:9, background:eef.img||EVENT_IMG_PALETTE[0], flexShrink:0 }}/>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {EVENT_IMG_PALETTE.map((g,i) => (
                <button key={i} onClick={()=>upd('img',g)} style={{ width:28, height:28, borderRadius:8, background:g, border:(eef.img||EVENT_IMG_PALETTE[0])===g?'2px solid #1C1A17':'2px solid transparent', padding:0, cursor:'pointer' }}/>
              ))}
            </div>
          </div>
          <div style={{ fontSize:11, color:'#A09890', marginTop:7, lineHeight:1.4 }}>Pick a thumbnail color — shown wherever this event is listed. Real photo upload isn't available yet (needs cloud storage).</div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <div style={{ flex:1 }}><div style={lbl}>Daily start time</div><input type="time" value={eef.startTime} onChange={e=>upd('startTime',e.target.value)} style={inp}/></div>
          <div style={{ flex:1 }}><div style={lbl}>Daily end time</div><input type="time" value={eef.endTime} onChange={e=>upd('endTime',e.target.value)} style={inp}/></div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <div style={{ flex:1 }}><div style={lbl}>Start date</div><input type="date" value={eef.start} onChange={e=>upd('start',e.target.value)} style={inp}/></div>
          <div style={{ flex:1 }}><div style={lbl}>End date</div><input type="date" value={eef.end} onChange={e=>upd('end',e.target.value)} style={inp}/></div>
        </div>
        {eef.start && eef.end && <div style={{ display:'flex', alignItems:'center', gap:7, background:'#F8E9EE', borderRadius:10, padding:'9px 12px', fontSize:12.5, color:'#A6364E', fontWeight:600 }}><Icon name="calendar" size={15} color="#A6364E"/>Duration: {d} day(s)</div>}
        <div><div style={lbl}>Last date to apply</div><input type="date" value={eef.lastApp} onChange={e=>upd('lastApp',e.target.value)} style={inp}/><div style={{ fontSize:11, color:'#A09890', marginTop:5 }}>Applications close automatically after this date.</div></div>
        <div style={{ display:'flex', gap:10 }}>
          <div style={{ flex:1 }}><div style={lbl}>F&amp;B / day (RM) + 6% SST</div><input inputMode="numeric" value={eef.fnb} onChange={e=>upd('fnb',e.target.value)} placeholder="300" style={inp}/></div>
          <div style={{ flex:1 }}><div style={lbl}>Non-F&amp;B / day (RM) + 6% SST</div><input inputMode="numeric" value={eef.nonfnb} onChange={e=>upd('nonfnb',e.target.value)} placeholder="250" style={inp}/></div>
        </div>
        {(eef.fnb || eef.nonfnb) && (
          <div style={{ display:'flex', gap:9 }}>
            <div style={{ flex:1, background:'#E8F5F0', borderRadius:10, padding:'10px 12px' }}><div style={{ fontSize:10.5, color:'#2D6A4F', fontWeight:600 }}>F&amp;B rental total</div><div style={{ fontSize:15, fontWeight:700, color:'#2D6A4F', marginTop:2 }}>RM {money(fnbTotal)}</div><div style={{ fontSize:9.5, color:'#6f9d8a', marginTop:1 }}>inclusive of 6% SST</div></div>
            <div style={{ flex:1, background:'#F8E9EE', borderRadius:10, padding:'10px 12px' }}><div style={{ fontSize:10.5, color:'#A6364E', fontWeight:600 }}>Non-F&amp;B rental total</div><div style={{ fontSize:15, fontWeight:700, color:'#A6364E', marginTop:2 }}>RM {money(nfTotal)}</div><div style={{ fontSize:9.5, color:'#bd7e95', marginTop:1 }}>inclusive of 6% SST</div></div>
          </div>
        )}
        <button onClick={save} className="cta" style={{ background:'#A6364E', color:'#FAF8F5', border:'none', fontSize:14.5, fontWeight:600, borderRadius:12, padding:14, cursor:'pointer', marginTop:2 }}>Save changes</button>
      </div>
    </Sheet>
  );
}

// ── Vendor Apply Modal ────────────────────────────────────────────────────────
export function ApplyModal() {
  const { state, dispatch, set, showToast, logActivity } = useStore();
  const { showApplyModal, applyEventId, applyShare, applyPartners, applyPartnerSearch, apps, events, vendors } = state;
  if (!showApplyModal || !applyEventId) return null;
  const ev = events.find(e=>e.id===applyEventId)||{};
  const me = vendors.find(v=>v.id===CURRENT_VENDOR_ID)||{};
  const isFnb = me.category === 'Food & Beverage';
  const partnerObjs = applyPartners.map(pid=>vendors.find(v=>v.id===pid)).filter(Boolean);
  const close = () => set({showApplyModal:false,applyEventId:null});

  const results = applyPartnerSearch.trim()
    ? vendors.filter(v => v.id !== CURRENT_VENDOR_ID && v.status === 'approved' && !applyPartners.includes(v.id) && v.business.toLowerCase().includes(applyPartnerSearch.toLowerCase()) && (v.category==='Food & Beverage')===isFnb).slice(0,5)
    : [];

  const submit = () => {
    if (applyShare === null) { showToast("Tell us if you'll share a booth",'info'); return; }
    if (applyShare && applyPartners.length === 0) { showToast('Add at least one booth partner','info'); return; }
    const newApp = { id:'a'+Date.now(), vendorId:CURRENT_VENDOR_ID, eventId:applyEventId, status:'pending', shared:!!applyShare, partners:[...applyPartners] };
    dispatch({type:'MERGE_APPS',payload:[...apps,newApp]});
    set({showApplyModal:false,applyEventId:null});
    logActivity(me.business, `applied for ${ev.name}.`, {icon:'clipboard', tint:'#F8E9EE', type:'vendor'});
    showToast('Application submitted','mail');
  };

  const btnSel = (active) => ({ flex:1, border:`1.5px solid ${active?'#A6364E':'#e3d8ca'}`, background:active?'#F8E9EE':'#fff', color:active?'#A6364E':'#6B6560', fontSize:13, fontWeight:600, borderRadius:12, padding:13, cursor:'pointer' });

  return (
    <Sheet onClose={close} maxW={480}>
      <SheetHeader title="Apply to this market" sub={`${ev.name} · ${ev.dateRange}`} onClose={close}/>
      <div style={{ fontSize:13, fontWeight:600, color:'#1C1A17', margin:'18px 0 9px' }}>Will you be sharing a booth?</div>
      <div style={{ display:'flex', gap:9 }}>
        <button onClick={()=>set({applyShare:false,applyPartners:[]})} style={btnSel(applyShare===false)}>No, solo booth</button>
        <button onClick={()=>set({applyShare:true})} style={btnSel(applyShare===true)}>Yes, sharing</button>
      </div>
      {applyShare === true && (
        <div style={{ marginTop:16 }}>
          <div style={{ fontSize:12.5, fontWeight:600, color:'#1C1A17', marginBottom:7 }}>Who are you sharing with?</div>
          {partnerObjs.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:9 }}>
              {partnerObjs.map(p => (
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, background:'#F8E9EE', borderRadius:11, padding:'9px 11px' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#1C1A17' }}>{p.business}</div>
                    <div style={{ fontSize:11, color:'#A09890' }}>{p.category}</div>
                  </div>
                  <button onClick={()=>set({applyPartners:applyPartners.filter(x=>x!==p.id)})} style={{ background:'#fff', border:'1px solid #eccdd6', width:30, height:30, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:'#B03A2E', cursor:'pointer', flexShrink:0 }}>
                    <Icon name="x" size={14} color="#B03A2E"/>
                  </button>
                </div>
              ))}
            </div>
          )}
          {applyPartners.length < 2 && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:8, border:'1px solid #e3d8ca', background:'#fff', borderRadius:11, padding:'0 12px' }}>
                <Icon name="search" size={15} color="#A09890"/>
                <input value={applyPartnerSearch} onChange={e=>set({applyPartnerSearch:e.target.value})} placeholder="Search a registered vendor…" style={{ flex:1, border:'none', background:'none', padding:'11px 0', fontSize:13.5, outline:'none', color:'#1C1A17' }}/>
              </div>
              {results.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
                  {results.map(r => (
                    <button key={r.id} onClick={()=>set({applyPartners:[...applyPartners,r.id],applyPartnerSearch:''})} style={{ display:'flex', alignItems:'center', gap:10, background:'#fff', border:'1px solid #efe7dc', borderRadius:11, padding:'9px 11px', cursor:'pointer', textAlign:'left' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'#1C1A17' }}>{r.business}</div>
                        <div style={{ fontSize:11, color:'#A09890' }}>{r.category}</div>
                      </div>
                      <span style={{ fontSize:12, fontWeight:700, color:'#A6364E', flexShrink:0 }}>+ Add</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {applyPartners.length >= 2 && <div style={{ fontSize:11.5, color:'#A09890', marginTop:9 }}>Booth is full — up to 3 vendors total.</div>}
          <div style={{ fontSize:11, color:'#A09890', marginTop:9, display:'flex', alignItems:'flex-start', gap:5, lineHeight:1.4 }}>
            <Icon name="info" size={12} color="#B7770D" style={{ marginTop:1, flexShrink:0 }}/>
            {isFnb ? 'Only F&B vendors can share your booth.' : 'Only non-F&B vendors can share your booth.'} Max 3 vendors per booth.
          </div>
        </div>
      )}
      <button onClick={submit} className="cta" style={{ marginTop:20, width:'100%', background:'#A6364E', color:'#FAF8F5', border:'none', fontSize:14.5, fontWeight:600, borderRadius:12, padding:14, cursor:'pointer' }}>Submit application</button>
    </Sheet>
  );
}

// ── Vendor Pass Modal ─────────────────────────────────────────────────────────
export function PassModal() {
  const { state, dispatch, set, showToast } = useStore();
  const { passModalVendor, pf, vendors, passes } = state;
  if (!passModalVendor) return null;
  const v = vendors.find(x=>x.id===passModalVendor)||{};
  const close = () => set({passModalVendor:null});
  const inp = { width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:11, padding:'11px 12px', fontSize:14, outline:'none' };
  const upd = (k,val) => set({pf:{...pf,[k]:val}});
  const save = (status) => {
    dispatch({type:'MERGE_PASSES',payload:{[passModalVendor]:{...pf,status}}});
    set({passModalVendor:null});
    showToast(`Pass marked ${status}`,'badge');
  };
  return (
    <Sheet onClose={close} maxW={460}>
      <SheetHeader title="Vendor pass" sub={v.business} onClose={close}/>
      <div style={{ marginTop:18, display:'flex', flexDirection:'column', gap:13 }}>
        <div style={{ display:'flex', gap:10 }}>
          <div style={{ flex:1 }}><div style={lbl}>Collector name</div><input value={pf.collector||''} onChange={e=>upd('collector',e.target.value)} placeholder="Name" style={inp}/></div>
          <div style={{ flex:1 }}><div style={lbl}>Phone</div><input value={pf.phone||''} onChange={e=>upd('phone',e.target.value)} placeholder="01x-xxxxxxx" style={inp}/></div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <div style={{ flex:1 }}><div style={lbl}>Tags issued</div><input inputMode="numeric" value={pf.issued||''} onChange={e=>upd('issued',e.target.value)} placeholder="0" style={inp}/></div>
          <div style={{ flex:1 }}><div style={lbl}>Collection date</div><input type="date" value={pf.collectDate||''} onChange={e=>upd('collectDate',e.target.value)} style={inp}/></div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <div style={{ flex:1 }}><div style={lbl}>Tags returned</div><input inputMode="numeric" value={pf.returned||''} onChange={e=>upd('returned',e.target.value)} placeholder="0" style={inp}/></div>
          <div style={{ flex:1 }}><div style={lbl}>Return date</div><input type="date" value={pf.returnDate||''} onChange={e=>upd('returnDate',e.target.value)} style={inp}/></div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:6 }}>
          <button onClick={()=>save('collected')} style={{ flex:1, background:'#2D6A4F', color:'#fff', border:'none', fontSize:14, fontWeight:600, borderRadius:12, padding:13, cursor:'pointer' }}>Mark collected</button>
          <button onClick={()=>save('returned')} style={{ flex:1, background:'#A6364E', color:'#fff', border:'none', fontSize:14, fontWeight:600, borderRadius:12, padding:13, cursor:'pointer' }}>Mark returned</button>
        </div>
      </div>
    </Sheet>
  );
}

// ── Partial Payment Modal ─────────────────────────────────────────────────────
export function PayModal() {
  const { state, dispatch, set, showToast } = useStore();
  const { payModalKey, payf, payments, vendors, events, filterEvent } = state;
  if (!payModalKey) return null;
  const [vid, eid] = payModalKey.split('-');
  const v = vendors.find(x=>x.id===vid)||{};
  const ev = events.find(x=>x.id===eid)||{};
  const dep = state.deposits[vid]||{status:'unpaid'};
  const { payCalc: pc, money: m } = (() => { const { payCalc, money } = require('../lib/helpers'); return { payCalc, money }; })();
  const calc = pc(v, ev, dep.status);
  const close = () => set({payModalKey:null});
  const save = () => {
    const amt = parseFloat(payf.amount)||0;
    const p={...payments}; p[payModalKey]={...(p[payModalKey]||{}),status:'partial',paid:amt};
    dispatch({type:'MERGE_PAYMENTS',payload:p});
    set({payModalKey:null});
    showToast('Marked partially paid','check');
  };
  return (
    <div onClick={close} style={{ position:'absolute', inset:0, zIndex:75, background:'rgba(28,26,23,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:380, background:'#FAF8F5', borderRadius:20, padding:22, animation:'modalIn 0.22s ease' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:600, color:'#1C1A17' }}>Record partial payment</div>
            <div style={{ fontSize:12.5, color:'#6B6560', marginTop:2 }}>{v.business}</div>
          </div>
          <button onClick={close} style={{ background:'#F2EDE6', border:'none', width:32, height:32, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <Icon name="x" size={16} color="#1C1A17"/>
          </button>
        </div>
        <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:12, padding:'11px 13px', marginTop:14, display:'flex', justifyContent:'space-between', fontSize:13, color:'#6B6560' }}>
          <span>Total due</span><span style={{ fontWeight:700, color:'#1C1A17' }}>RM {calc.total.toLocaleString('en-MY',{minimumFractionDigits:2})}</span>
        </div>
        <div style={{ marginTop:14 }}>
          <div style={lbl}>Amount received (RM)</div>
          <input inputMode="decimal" value={payf.amount||''} onChange={e=>set({payf:{...payf,amount:e.target.value}})} placeholder="0.00" style={{ width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:11, padding:'12px 13px', fontSize:15, outline:'none' }}/>
        </div>
        <button onClick={save} style={{ marginTop:16, width:'100%', background:'#C76A0D', color:'#fff', border:'none', fontSize:14, fontWeight:600, borderRadius:12, padding:13, cursor:'pointer' }}>Save partial payment</button>
      </div>
    </div>
  );
}

// ── Deposit Modal ─────────────────────────────────────────────────────────────
export function DepositModal() {
  const { state, dispatch, set, showToast, logActivity } = useStore();
  const { depModalVendor, depf, vendors } = state;
  if (!depModalVendor) return null;
  const v = vendors.find(x=>x.id===depModalVendor)||{};
  const close = () => set({depModalVendor:null});
  const upd = (k,val) => set({depf:{...depf,[k]:val}});
  const save = () => {
    dispatch({type:'MERGE_DEPOSITS',payload:{[depModalVendor]:{...depf}}});
    set({depModalVendor:null});
    logActivity('Admin', `updated deposit record for ${v.business}.`, {icon:'wallet', tint:'#EEF1FB'});
    showToast('Deposit record saved','check');
  };
  const inp = { width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:11, padding:'11px 13px', fontSize:14, outline:'none' };
  return (
    <Sheet onClose={close} maxW={460}>
      <SheetHeader title="Deposit record" sub={`${v.business} · RM100 refundable`} onClose={close}/>
      <div style={{ fontSize:12, fontWeight:600, color:'#1C1A17', margin:'16px 0 7px' }}>Status</div>
      <div style={{ display:'flex', gap:8 }}>
        {['unpaid','paid','refunded'].map(s => (
          <button key={s} onClick={()=>upd('status',s)} style={{ flex:1, border:`1.5px solid ${depf.status===s?'#A6364E':'#e3d8ca'}`, background:depf.status===s?'#F8E9EE':'#fff', color:depf.status===s?'#A6364E':'#6B6560', fontSize:13, fontWeight:600, borderRadius:12, padding:11, cursor:'pointer', textTransform:'capitalize' }}>{s}</button>
        ))}
      </div>
      <div style={{ marginTop:14 }}><div style={lbl}>Deposit invoice no.</div><input value={depf.inv||''} onChange={e=>upd('inv',e.target.value)} placeholder="DEP-0000" style={inp}/></div>
      <div style={{ marginTop:13 }}><div style={lbl}>Date paid</div><input type="date" value={depf.payDate||''} onChange={e=>upd('payDate',e.target.value)} style={inp}/></div>
      {depf.status === 'refunded' && <div style={{ marginTop:13 }}><div style={lbl}>Date refunded</div><input type="date" value={depf.refundDate||''} onChange={e=>upd('refundDate',e.target.value)} style={inp}/></div>}
      <button onClick={save} style={{ marginTop:18, width:'100%', background:'#A6364E', color:'#fff', border:'none', fontSize:14, fontWeight:600, borderRadius:12, padding:13, cursor:'pointer' }}>Save deposit record</button>
    </Sheet>
  );
}

const lbl = { display:'block', fontSize:12, fontWeight:600, color:'#1C1A17', marginBottom:6 };
