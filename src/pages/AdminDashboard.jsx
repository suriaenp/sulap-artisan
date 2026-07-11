import { useState } from 'react';
import Icon from '../components/Icon';
import Badge from '../components/Badge';
import { useStore } from '../lib/store';
import { money, fmt, fmtShort, fmtTime, payCalc, badge, dayCount } from '../lib/helpers';
import { OFFENSE_TYPES, CURRENT_VENDOR_ID, EVENT_IMG_PALETTE } from '../data/mockData';

const ADMIN_TABS = [
  { id:'overview',   label:'Overview',            icon:'bars' },
  { id:'vendors',    label:'Vendor Applications', icon:'users' },
  { id:'vendorList', label:'Vendor Listing',      icon:'file' },
  { id:'events',     label:'Events',              icon:'tent' },
  { id:'apps',       label:'Event Applications',  icon:'clipboard' },
  { id:'payments',   label:'Payments',            icon:'receipt' },
  { id:'deposits',   label:'Deposit Record',      icon:'wallet' },
  { id:'parking',    label:'Parking',             icon:'car' },
  { id:'photos',     label:'Event Pictures',      icon:'camera' },
  { id:'pass',       label:'Vendor Pass',         icon:'badge' },
  { id:'categories', label:'Categories',          icon:'folder' },
  { id:'activity',   label:'Activity',            icon:'activity' },
  { id:'chart',      label:'Vendor Chart',        icon:'trophy' },
  { id:'compliance', label:'Compliance',          icon:'shield' },
  { id:'content',    label:'Content',             icon:'pen' },
  { id:'settings',   label:'Settings',            icon:'settings' },
];

function Pager({ total, perPage, page, onPage }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  const start = (page-1)*perPage+1, end = Math.min(page*perPage, total);
  const btnStyle = (dis) => ({ background:dis?'#F2EDE6':'#fff', border:'1px solid #e3d8ca', color:dis?'#A09890':'#A6364E', fontSize:12, fontWeight:600, borderRadius:9, padding:'7px 14px', cursor:dis?'not-allowed':'pointer' });
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14 }}>
      <div style={{ fontSize:12, color:'#A09890' }}>{start}–{end} of {total}</div>
      <div style={{ display:'flex', gap:8 }}>
        <button disabled={page<=1} onClick={()=>onPage(page-1)} style={btnStyle(page<=1)}>Prev</button>
        <button disabled={page>=pages} onClick={()=>onPage(page+1)} style={btnStyle(page>=pages)}>Next</button>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { state, set, dispatch, showToast, closeModals, logActivity } = useStore();
  const { aTab, events, vendors, apps, payments, deposits, offenses, eventPhotos, parking, passes, cats, content, settings, activity, filterEvent, page, PER_PAGE, compTab, compSel, chartPeriod, actTab, parkOverride } = state;
  const [showRejected, setShowRejected] = useState(false);

  const vById = id => vendors.find(v=>v.id===id)||{};
  const eById = id => events.find(e=>e.id===id)||{};
  const depRec = id => deposits[id]||{status:'unpaid',inv:'',payDate:'',refundDate:''};
  const payRec = key => payments[key]||{status:'unpaid',paid:0,advice:false,invoice:true,receipt:false};

  const tabStyle = (active) => ({
    display:'inline-flex', alignItems:'center', gap:7, flexShrink:0,
    border:active?'none':'1px solid #e7ddd0', fontFamily:"'DM Sans'",
    fontSize:13, fontWeight:600, borderRadius:999, padding:'9px 16px', cursor:'pointer',
    background:active?'#A6364E':'#faf8f5', color:active?'#FAF8F5':'#6B6560',
  });

  const logout = () => { set({ aScreen:'login' }); showToast('Signed out','leaf'); };

  // Derived filtered data for paginated tabs
  const filteredApps = apps.filter(a => a.eventId === filterEvent);
  const approvedApps = apps.filter(a => a.eventId === filterEvent && a.status === 'approved');
  const pagedApps    = filteredApps.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const pagedPayments= approvedApps.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const pagedPark    = approvedApps.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const pagedPhotos  = approvedApps.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const pagedPass    = approvedApps.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const pendingVendors = vendors.filter(v => v.status === 'pending');
  const approvedVendors = vendors.filter(v => v.status === 'approved' || v.status === 'suspended');
  const rejectedVendors = vendors.filter(v => v.status === 'rejected');
  const pagedVendors = pendingVendors.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const pagedVendorList = approvedVendors.slice((page-1)*PER_PAGE, page*PER_PAGE);

  const curEv = eById(filterEvent);
  const today = new Date(); today.setHours(0,0,0,0);

  return (
    <div>
      {/* Header */}
      <div style={{ background:'#3A1622', padding:'15px 20px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:600, color:'#FAF8F5' }}>Admin Console</div>
          <div style={{ fontSize:11, color:'#C99AAA', marginTop:1 }}>Sulap Artisan</div>
        </div>
        <button onClick={logout} style={{ background:'#54222f', border:'none', color:'#f0d9e0', fontSize:12, fontWeight:600, borderRadius:10, padding:'8px 12px', cursor:'pointer' }}>Sign out</button>
      </div>

      {/* Mobile pill tabs */}
      <div className="admin-tabs-bar" style={{ display:'flex', flexWrap:'wrap', gap:7, padding:'13px 16px', background:'#FAF8F5', borderBottom:'1px solid #f0e9df' }}>
        {ADMIN_TABS.map(t => (
          <button key={t.id} onClick={()=>{ closeModals(); set({aTab:t.id,page:1}); }} style={tabStyle(aTab===t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ── Overview ── */}
      {aTab === 'overview' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div className="overview-grid">
            {[
              { icon:'users',   tint:'#F8E9EE', iconColor:'#A6364E', value:vendors.length,                        label:'Total vendors',     sub:'registered' },
              { icon:'clock',   tint:'#FEF8EC', iconColor:'#B7770D', value:vendors.filter(v=>v.status==='pending').length, label:'Pending review', sub:'awaiting approval' },
              { icon:'tent',    tint:'#E8F5F0', iconColor:'#2D6A4F', value:events.length,                         label:'Active events',     sub:'this season' },
              { icon:'receipt', tint:'#EEF1FB', iconColor:'#3D5BC4', value:Object.values(payments).filter(p=>p.status==='paid').length, label:'Payments confirmed', sub:'this event' },
            ].map(c => (
              <div key={c.label} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:16, padding:'13px 14px' }}>
                <div style={{ width:34, height:34, borderRadius:10, background:c.tint, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon name={c.icon} size={17} color={c.iconColor}/>
                </div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:600, color:'#1C1A17', marginTop:10, lineHeight:1 }}>{c.value}</div>
                <div style={{ fontSize:12, fontWeight:600, color:'#1C1A17', marginTop:5 }}>{c.label}</div>
                <div style={{ fontSize:10.5, color:'#A09890', marginTop:2 }}>{c.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:'#1C1A17', margin:'20px 2px 10px' }}>Quick actions</div>
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {[
              { icon:'users',   label:'Review vendor applications', tab:'vendors' },
              { icon:'tent',    label:'Create a new event',         tab:'events'  },
              { icon:'receipt', label:'Manage payments',            tab:'payments'},
              { icon:'shield',  label:'Log vendor offences',        tab:'compliance'},
            ].map(a => (
              <button key={a.label} onClick={()=>set({aTab:a.tab,page:1})} style={{ display:'flex', alignItems:'center', gap:12, background:'#fff', border:'1px solid #efe7dc', borderRadius:14, padding:'13px 14px', cursor:'pointer', textAlign:'left', fontFamily:"'DM Sans'" }}>
                <div style={{ width:34, height:34, borderRadius:10, background:'#F8E9EE', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Icon name={a.icon} size={17} color="#A6364E"/>
                </div>
                <span style={{ flex:1, fontSize:13.5, fontWeight:600, color:'#1C1A17' }}>{a.label}</span>
                <span style={{ fontSize:17, color:'#A09890' }}>›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Vendor Applications (new sign-ups awaiting a decision) ── */}
      {aTab === 'vendors' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:13, color:'#6B6560' }}><b style={{ color:'#A6364E' }}>{pendingVendors.length}</b> awaiting review</div>
            <button onClick={()=>showToast('Exporting vendors.csv…','download')} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#fff', border:'1px solid #e3d8ca', color:'#A6364E', fontSize:12, fontWeight:600, borderRadius:9, padding:'7px 12px', cursor:'pointer' }}>
              <Icon name="download" size={14} color="#A6364E"/>Export CSV
            </button>
          </div>
          {pendingVendors.length === 0 && (
            <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:16, padding:'24px 16px', textAlign:'center', color:'#A09890', fontSize:13 }}>
              No new applications right now.
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            {pagedVendors.map(v => (
              <div key={v.id} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:16, padding:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:'#1C1A17' }}>{v.business}</div>
                    <div style={{ fontSize:12, color:'#6B6560', marginTop:2 }}>{v.owner} · {v.category}</div>
                  </div>
                  <Badge status={v.status}/>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'8px 14px', marginTop:11, fontSize:11.5, color:'#6B6560' }}>
                  <span style={{ display:'flex', alignItems:'center', gap:5 }}><Icon name="mail" size={13} color="#A09890"/>{v.email}</span>
                  <span style={{ display:'flex', alignItems:'center', gap:5 }}><Icon name="phone" size={13} color="#A09890"/>{v.phone}</span>
                  <span style={{ display:'flex', alignItems:'center', gap:5, color:'#A6364E' }}><Icon name="instagram" size={13} color="#A6364E"/>{v.ig}</span>
                </div>
                <div style={{ fontSize:11.5, color:'#A09890', marginTop:6 }}>Registered {v.regDate}</div>
                <div style={{ display:'flex', gap:9, marginTop:13, alignItems:'center' }}>
                  <button onClick={()=>set({vendorDetailId:v.id, vendorDetailReturnAppId:null})} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#FAF8F5', border:'1px solid #e3d8ca', color:'#A6364E', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'9px 14px', cursor:'pointer' }}>
                    <Icon name="eye" size={14} color="#A6364E"/>View details
                  </button>
                  <div style={{ flex:1 }}/>
                  <button onClick={()=>{ dispatch({type:'MERGE_VENDORS',payload:vendors.map(x=>x.id===v.id?{...x,status:'approved'}:x)}); logActivity('Admin', `approved ${v.business} as a vendor.`, {icon:'check', tint:'#F8E9EE'}); showToast('Vendor approved'+(settings.emailAlerts?' · vendor emailed':''),'check'); }} style={{ background:'#E8F5F0', border:'none', color:'#2D6A4F', fontSize:12, fontWeight:600, borderRadius:9, padding:'8px 14px', cursor:'pointer' }}>Approve</button>
                  <button onClick={()=>{ dispatch({type:'MERGE_VENDORS',payload:vendors.map(x=>x.id===v.id?{...x,status:'rejected'}:x)}); logActivity('Admin', `rejected ${v.business}'s vendor application.`, {icon:'x', tint:'#FDEEEC'}); showToast('Vendor rejected'+(settings.emailAlerts?' · vendor emailed':''),'x'); }} style={{ background:'#FDEEEC', border:'none', color:'#B03A2E', fontSize:12, fontWeight:600, borderRadius:9, padding:'8px 14px', cursor:'pointer' }}>Reject</button>
                </div>
              </div>
            ))}
          </div>
          <Pager total={pendingVendors.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}/>
          {rejectedVendors.length > 0 && (
            <div style={{ marginTop:22, paddingTop:16, borderTop:'1px solid #efe7dc' }}>
              <button onClick={()=>setShowRejected(s=>!s)} style={{ background:'none', border:'none', color:'#A09890', fontSize:12, fontWeight:600, padding:0, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                <Icon name={showRejected?'x':'eye'} size={13} color="#A09890"/>
                {showRejected ? 'Hide' : 'Show'} {rejectedVendors.length} rejected application{rejectedVendors.length>1?'s':''}
              </button>
              {showRejected && (
                <div style={{ display:'flex', flexDirection:'column', gap:11, marginTop:13 }}>
                  {rejectedVendors.map(v => (
                    <div key={v.id} style={{ background:'#FBF7F1', border:'1px solid #efe7dc', borderRadius:16, padding:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:15, fontWeight:700, color:'#1C1A17' }}>{v.business}</div>
                          <div style={{ fontSize:12, color:'#6B6560', marginTop:2 }}>{v.owner} · {v.category}</div>
                        </div>
                        <Badge status={v.status}/>
                      </div>
                      <div style={{ fontSize:11.5, color:'#A09890', marginTop:6 }}>Registered {v.regDate}</div>
                      <button onClick={()=>{ dispatch({type:'MERGE_VENDORS',payload:vendors.map(x=>x.id===v.id?{...x,status:'pending'}:x)}); logActivity('Admin', `moved ${v.business}'s application back to pending review.`, {icon:'info', tint:'#FEF8EC'}); showToast(`${v.business} moved back to pending review`,'info'); }} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:11, width:'100%', background:'#fff', border:'1px solid #e3d8ca', color:'#A6364E', fontSize:12.5, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>
                        <Icon name="pencil" size={13} color="#A6364E"/>Reconsider — move back to pending
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Vendor Listing (master list of approved/suspended vendors) ── */}
      {aTab === 'vendorList' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:13, color:'#6B6560' }}><b style={{ color:'#2D6A4F' }}>{approvedVendors.filter(v=>v.status==='approved').length}</b> approved vendors</div>
            <button onClick={()=>showToast('Exporting vendors.csv…','download')} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#fff', border:'1px solid #e3d8ca', color:'#A6364E', fontSize:12, fontWeight:600, borderRadius:9, padding:'7px 12px', cursor:'pointer' }}>
              <Icon name="download" size={14} color="#A6364E"/>Export CSV
            </button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            {pagedVendorList.map(v => {
              const vOff = offenses.filter(o=>o.vendorId===v.id);
              const typeCounts = {};
              vOff.forEach(o=>{ typeCounts[o.type]=(typeCounts[o.type]||0)+1; });
              return (
                <div key={v.id} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:16, padding:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:'#1C1A17' }}>{v.business}</div>
                      <div style={{ fontSize:12, color:'#6B6560', marginTop:2 }}>{v.owner} · {v.category}</div>
                    </div>
                    <Badge status={v.status}/>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'8px 14px', marginTop:11, fontSize:11.5, color:'#6B6560' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:5 }}><Icon name="mail" size={13} color="#A09890"/>{v.email}</span>
                    <span style={{ display:'flex', alignItems:'center', gap:5 }}><Icon name="phone" size={13} color="#A09890"/>{v.phone}</span>
                    <span style={{ display:'flex', alignItems:'center', gap:5, color:'#A6364E' }}><Icon name="instagram" size={13} color="#A6364E"/>{v.ig}</span>
                  </div>
                  <div style={{ fontSize:11.5, color:'#A09890', marginTop:6 }}>Registered {v.regDate}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#1C1A17', marginTop:12, marginBottom:6 }}>Compliance</div>
                  {vOff.length === 0 ? (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, borderRadius:999, padding:'4px 10px', background:'#E8F5F0', color:'#2D6A4F' }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:'#2D6A4F' }}/>No offences on record
                    </span>
                  ) : (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {Object.entries(typeCounts).map(([type,count]) => {
                        const ot = OFFENSE_TYPES[type]||{};
                        return <span key={type} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, borderRadius:999, padding:'4px 10px', background:ot.bg, color:ot.color }}><span style={{ width:6, height:6, borderRadius:'50%', background:ot.color }}/>{ot.label} ×{count}</span>;
                      })}
                    </div>
                  )}
                  <div style={{ display:'flex', gap:9, marginTop:13, alignItems:'center' }}>
                    <button onClick={()=>set({vendorDetailId:v.id, vendorDetailReturnAppId:null})} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#FAF8F5', border:'1px solid #e3d8ca', color:'#A6364E', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'9px 14px', cursor:'pointer' }}>
                      <Icon name="eye" size={14} color="#A6364E"/>View details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <Pager total={approvedVendors.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}/>
        </div>
      )}

      {/* ── Events ── */}
      {aTab === 'events' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:18, padding:16 }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:600, color:'#1C1A17' }}>Create event</div>
            <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:13 }}>
              <div><div style={lbl}>Event name</div><input value={state.ef.name} onChange={e=>set({ef:{...state.ef,name:e.target.value}})} placeholder="e.g. Harvest Night Market" style={inp}/></div>
              <div>
                <div style={lbl}>Event image</div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:76, height:46, borderRadius:9, background:state.ef.img||EVENT_IMG_PALETTE[0], flexShrink:0 }}/>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {EVENT_IMG_PALETTE.map((g,i) => (
                      <button key={i} onClick={()=>set({ef:{...state.ef,img:g}})} style={{ width:28, height:28, borderRadius:8, background:g, border:(state.ef.img||EVENT_IMG_PALETTE[0])===g?'2px solid #1C1A17':'2px solid transparent', padding:0, cursor:'pointer' }}/>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize:11, color:'#A09890', marginTop:7, lineHeight:1.4 }}>Pick a thumbnail color — shown wherever this event is listed. Real photo upload isn't available yet (needs cloud storage).</div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <div style={{ flex:1 }}><div style={lbl}>Daily start time</div><input type="time" value={state.ef.startTime} onChange={e=>set({ef:{...state.ef,startTime:e.target.value}})} style={inp}/></div>
                <div style={{ flex:1 }}><div style={lbl}>Daily end time</div><input type="time" value={state.ef.endTime} onChange={e=>set({ef:{...state.ef,endTime:e.target.value}})} style={inp}/></div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <div style={{ flex:1 }}><div style={lbl}>Start date</div><input type="date" value={state.ef.start} onChange={e=>set({ef:{...state.ef,start:e.target.value}})} style={inp}/></div>
                <div style={{ flex:1 }}><div style={lbl}>End date</div><input type="date" value={state.ef.end} onChange={e=>set({ef:{...state.ef,end:e.target.value}})} style={inp}/></div>
              </div>
              {state.ef.start && state.ef.end && <div style={{ display:'flex', alignItems:'center', gap:7, background:'#F8E9EE', borderRadius:10, padding:'9px 12px', fontSize:12.5, color:'#A6364E', fontWeight:600 }}><Icon name="calendar" size={15} color="#A6364E"/>Duration: {dayCount(state.ef.start,state.ef.end)} day(s)</div>}
              <div><div style={lbl}>Last date to apply</div><input type="date" value={state.ef.lastApp} onChange={e=>set({ef:{...state.ef,lastApp:e.target.value}})} style={inp}/><div style={{ fontSize:11, color:'#A09890', marginTop:5 }}>Applications close automatically after this date.</div></div>
              <div style={{ display:'flex', gap:10 }}>
                <div style={{ flex:1 }}><div style={lbl}>F&B / day (RM) + 6% SST</div><input inputMode="numeric" value={state.ef.fnb} onChange={e=>set({ef:{...state.ef,fnb:e.target.value}})} placeholder="300" style={inp}/></div>
                <div style={{ flex:1 }}><div style={lbl}>Non-F&B / day (RM) + 6% SST</div><input inputMode="numeric" value={state.ef.nonfnb} onChange={e=>set({ef:{...state.ef,nonfnb:e.target.value}})} placeholder="250" style={inp}/></div>
              </div>
              {(state.ef.fnb || state.ef.nonfnb) && (() => {
                const d = dayCount(state.ef.start,state.ef.end)||1;
                const fnbTotal = Number(state.ef.fnb||0)*d*1.06;
                const nfTotal  = Number(state.ef.nonfnb||0)*d*1.06;
                return (
                  <div style={{ display:'flex', gap:9 }}>
                    <div style={{ flex:1, background:'#E8F5F0', borderRadius:10, padding:'10px 12px' }}><div style={{ fontSize:10.5, color:'#2D6A4F', fontWeight:600 }}>F&B rental total</div><div style={{ fontSize:15, fontWeight:700, color:'#2D6A4F', marginTop:2 }}>RM {money(fnbTotal)}</div><div style={{ fontSize:9.5, color:'#6f9d8a', marginTop:1 }}>inclusive of 6% SST</div></div>
                    <div style={{ flex:1, background:'#F8E9EE', borderRadius:10, padding:'10px 12px' }}><div style={{ fontSize:10.5, color:'#A6364E', fontWeight:600 }}>Non-F&B rental total</div><div style={{ fontSize:15, fontWeight:700, color:'#A6364E', marginTop:2 }}>RM {money(nfTotal)}</div><div style={{ fontSize:9.5, color:'#bd7e95', marginTop:1 }}>inclusive of 6% SST</div></div>
                  </div>
                );
              })()}
              <button onClick={() => {
                if (!state.ef.name) { showToast('Add an event name first','info'); return; }
                const d = dayCount(state.ef.start,state.ef.end)||1;
                const ev = { id:'e'+Date.now(), name:state.ef.name, dateRange:state.ef.start&&state.ef.end ? `${fmtShort(state.ef.start)} – ${fmtShort(state.ef.end)} ${new Date(state.ef.end).getFullYear()}` : 'Dates TBC', location:'Suria Sabah Mall', days:d, applied:0, fnb:Number(state.ef.fnb)||0, nonfnb:Number(state.ef.nonfnb)||0, startTime:state.ef.startTime||'10:00', endTime:state.ef.endTime||'22:00', lastApp:state.ef.lastApp||'', startDate:state.ef.start||'', endDate:state.ef.end||'', img:state.ef.img||EVENT_IMG_PALETTE[0] };
                dispatch({type:'MERGE_EVENTS',payload:[ev,...events]});
                set({ef:{name:'',start:'',end:'',startTime:'',endTime:'',lastApp:'',fnb:'',nonfnb:'',img:EVENT_IMG_PALETTE[0]}});
                logActivity('Admin', `created the ${ev.name} event.`, {icon:'tent', tint:'#E8F5F0'});
                showToast('Event created','tent');
              }} className="cta" style={{ background:'#A6364E', color:'#FAF8F5', border:'none', fontSize:14.5, fontWeight:600, borderRadius:12, padding:14, cursor:'pointer', marginTop:2 }}>Create event</button>
            </div>
          </div>
          <div style={{ fontSize:13, fontWeight:600, color:'#1C1A17', margin:'18px 2px 10px' }}>Existing events</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {events.map(ev => (
              <div key={ev.id} onClick={()=>set({eventDetailId:ev.id,eef:{name:ev.name,location:ev.location||'',start:ev.startDate||'',end:ev.endDate||'',startTime:ev.startTime||'',endTime:ev.endTime||'',lastApp:ev.lastApp||'',fnb:ev.fnb||'',nonfnb:ev.nonfnb||'',img:ev.img||EVENT_IMG_PALETTE[0]}})} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:14, padding:'12px 13px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
                <div style={{ width:76, height:46, borderRadius:9, background:ev.img, flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'#1C1A17' }}>{ev.name}</div>
                  <div style={{ fontSize:11.5, color:'#6B6560', marginTop:3 }}>{ev.dateRange}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#A09890', marginTop:2 }}>
                    <Icon name="clock" size={12} color="#A09890"/>{ev.startTime && ev.endTime ? `${fmtTime(ev.startTime)} – ${fmtTime(ev.endTime)}` : 'Time TBC'} · {apps.filter(a=>a.eventId===ev.id).length} applied
                  </div>
                </div>
                <span style={{ fontSize:17, color:'#A09890' }}>›</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Event Applications ── */}
      {aTab === 'apps' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:12, marginBottom:14 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={lbl}>Filter by event</div>
              <select value={filterEvent} onChange={e=>set({filterEvent:e.target.value,page:1})} style={{ width:'100%', maxWidth:360, border:'1px solid #e3d8ca', background:'#fff', borderRadius:11, padding:'12px 13px', fontSize:14, color:'#1C1A17', outline:'none' }}>
                {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <button onClick={()=>showToast('Exporting…','download')} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#fff', border:'1px solid #e3d8ca', color:'#A6364E', fontSize:12, fontWeight:600, borderRadius:9, padding:'9px 13px', cursor:'pointer', flexShrink:0 }}>
              <Icon name="download" size={14} color="#A6364E"/>Export
            </button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            {pagedApps.map(a => {
              const v = vById(a.vendorId);
              const vOffenses = offenses.filter(o=>o.vendorId===a.vendorId);
              return (
                <div key={a.id} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:16, padding:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14.5, fontWeight:700, color:'#1C1A17' }}>{v.business}</div>
                      <div style={{ fontSize:12, color:'#6B6560', marginTop:2 }}>{v.owner} · {v.category}</div>
                    </div>
                    <Badge status={a.status} label={a.status==='pending'?'Awaiting review':undefined}/>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:7, marginTop:10 }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'#6B6560', background:'#F2EDE6', borderRadius:999, padding:'4px 10px' }}>
                      <Icon name={a.shared?'users':'tent'} size={12} color="#A6364E"/>{a.shared?`Sharing · ${(a.partners||[]).length+1} vendors`:'Solo booth'}
                    </span>
                    {vOffenses.slice(0,3).map((o,i) => {
                      const ot = OFFENSE_TYPES[o.type]||{};
                      return <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, borderRadius:999, padding:'4px 10px', background:ot.bg, color:ot.color }}><span style={{ width:6, height:6, borderRadius:'50%', background:ot.color, display:'inline-block' }}/>{ot.label}</span>;
                    })}
                  </div>
                  <div style={{ display:'flex', gap:9, marginTop:13, alignItems:'center' }}>
                    <button onClick={()=>set({appDetailId:a.id})} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#FAF8F5', border:'1px solid #e3d8ca', color:'#A6364E', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'9px 14px', cursor:'pointer' }}>
                      <Icon name="eye" size={14} color="#A6364E"/>View &amp; share booth
                    </button>
                    <div style={{ flex:1 }}/>
                    <button onClick={()=>{ dispatch({type:'MERGE_APPS',payload:apps.map(x=>x.id===a.id?{...x,status:'approved'}:x)}); logActivity('Admin', `approved ${v.business}'s application for ${eById(a.eventId).name}.`, {icon:'check', tint:'#F8E9EE'}); showToast('Application approved'+(settings.emailAlerts?' · vendor emailed':''),'check'); }} style={{ background:'#E8F5F0', border:'none', color:'#2D6A4F', fontSize:12, fontWeight:600, borderRadius:9, padding:'8px 14px', cursor:'pointer' }}>Approve</button>
                    <button onClick={()=>{ dispatch({type:'MERGE_APPS',payload:apps.map(x=>x.id===a.id?{...x,status:'rejected'}:x)}); logActivity('Admin', `rejected ${v.business}'s application for ${eById(a.eventId).name}.`, {icon:'x', tint:'#FDEEEC'}); showToast('Application rejected'+(settings.emailAlerts?' · vendor emailed':''),'x'); }} style={{ background:'#FDEEEC', border:'none', color:'#B03A2E', fontSize:12, fontWeight:600, borderRadius:9, padding:'8px 14px', cursor:'pointer' }}>Reject</button>
                  </div>
                </div>
              );
            })}
          </div>
          <Pager total={filteredApps.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}/>
        </div>
      )}

      {/* ── Payments ── */}
      {aTab === 'payments' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={lbl}>Filter by event</div>
          <select value={filterEvent} onChange={e=>set({filterEvent:e.target.value,page:1})} style={{ width:'100%', maxWidth:360, border:'1px solid #e3d8ca', background:'#fff', borderRadius:11, padding:'12px 13px', fontSize:14, color:'#1C1A17', outline:'none', marginBottom:13 }}>
            {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <div style={{ display:'flex', flexWrap:'wrap', gap:9, marginBottom:14 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, borderRadius:10, padding:'8px 12px', background:'#FBF7F1', border:'1px solid #efe7dc', color:'#6B6560' }}>
              <Icon name="calendar" size={13} color="#A09890"/>Payment due by {curEv.lastApp ? fmtShort(curEv.lastApp) : 'TBC'}
            </span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, borderRadius:10, padding:'8px 12px', background:'#E8F5F0', color:'#2D6A4F' }}>
              {pagedPayments.filter(a=>payRec(`${a.vendorId}-${a.eventId}`).status==='paid').length} of {pagedPayments.length} fully paid
            </span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {pagedPayments.map((a,idx) => {
              const v = vById(a.vendorId);
              const dep = deposits[a.vendorId]||{status:'unpaid'};
              const calc = payCalc(v, curEv, dep.status);
              const rec = payRec(`${a.vendorId}-${curEv.id}`);
              const isPartial = rec.status === 'partial';
              const cardBorder = rec.status==='paid' ? '#cfe9df' : rec.status==='partial' ? '#f3e6c9' : '#efe7dc';
              return (
                <div key={a.id} style={{ background:'#fff', border:`1px solid ${cardBorder}`, borderRadius:16, padding:15 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ fontSize:11, fontWeight:700, color:'#A09890' }}>#{(page-1)*PER_PAGE+idx+1}</span><span style={{ fontSize:14.5, fontWeight:700, color:'#1C1A17' }}>{v.business}</span></div>
                      <div style={{ fontSize:11.5, color:'#6B6560', marginTop:3 }}>{calc.tier} · RM {calc.rate}/day × {calc.days} days</div>
                    </div>
                    <Badge status={rec.status}/>
                  </div>
                  <div style={{ background:'#FBF7F1', borderRadius:12, padding:'11px 13px', marginTop:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#6B6560' }}><span>Rental subtotal</span><span>RM {money(calc.base)}</span></div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#6B6560', marginTop:5 }}><span>SST (6%)</span><span>RM {money(calc.sst)}</span></div>
                    {calc.needsDeposit && <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#6B6560', marginTop:5 }}><span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>Refundable deposit <span style={{ fontSize:9.5, fontWeight:700, background:'#FEF8EC', color:'#B7770D', borderRadius:5, padding:'1px 5px' }}>NOT YET HELD</span></span><span>RM 100.00</span></div>}
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, fontWeight:700, color:'#1C1A17', marginTop:8, paddingTop:8, borderTop:'1px solid #efe7dc' }}><span>Total due</span><span>RM {money(calc.total)}</span></div>
                    {isPartial && <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginTop:6, color:'#C76A0D', fontWeight:600 }}><span>Paid RM {money(rec.paid)} · Outstanding</span><span>RM {money(calc.total-rec.paid)}</span></div>}
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginTop:11 }}>
                    {[['advice','Payment advice'],['invoice','Invoice'],['receipt','Receipt']].map(([flag,label]) => {
                      const has = rec[flag];
                      return (
                        <button key={flag} onClick={()=>{ const p={...payments}; const cur=p[`${a.vendorId}-${curEv.id}`]||{status:'unpaid',paid:0,advice:false,invoice:true,receipt:false}; p[`${a.vendorId}-${curEv.id}`]={...cur,[flag]:!cur[flag]}; dispatch({type:'MERGE_PAYMENTS',payload:p}); showToast((has?'Removed ':'Uploaded ')+label,'file'); }} style={{ display:'inline-flex', alignItems:'center', gap:6, background:has?'#E8F5F0':'#FAF8F5', border:`1px solid ${has?'#cfe9df':'#e3d8ca'}`, color:has?'#2D6A4F':'#6B6560', fontSize:12, fontWeight:600, borderRadius:9, padding:'7px 11px', cursor:'pointer' }}>
                          <Icon name={has?'check':'upload'} size={13} color={has?'#2D6A4F':'#6B6560'}/>{label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:12, paddingTop:12, borderTop:'1px solid #f1ece4' }}>
                    <span style={{ fontSize:11, fontWeight:600, color:'#A09890', flexShrink:0 }}>Mark:</span>
                    {[['paid','Paid','#E8F5F0','#2D6A4F'],['partial','Partial','#FFF3E0','#C76A0D'],['unpaid','Unpaid','#FEF8EC','#B7770D']].map(([s,l,bg,c]) => (
                      <button key={s} onClick={()=>{ if(s==='partial'){set({payModalKey:`${a.vendorId}-${curEv.id}`,payf:{amount:''}}); return;} const p={...payments}; p[`${a.vendorId}-${curEv.id}`]={...(p[`${a.vendorId}-${curEv.id}`]||{}),status:s,paid:s==='unpaid'?0:(p[`${a.vendorId}-${curEv.id}`]?.paid||0)}; dispatch({type:'MERGE_PAYMENTS',payload:p}); showToast(`Marked ${l}`,'check'); }} style={{ background:rec.status===s?bg:'#FAF8F5', border:`1px solid ${rec.status===s?'transparent':'#e3d8ca'}`, color:rec.status===s?c:'#6B6560', fontSize:11.5, fontWeight:600, borderRadius:9, padding:'7px 11px', cursor:'pointer' }}>{l}</button>
                    ))}
                    <div style={{ flex:1 }}/>
                    <button onClick={()=>showToast(`Payment reminder emailed to ${v.business}`,'bell')} title="Send payment reminder" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:34, height:34, border:'1px solid #e3d8ca', background:'#fff', color:'#A6364E', borderRadius:9, cursor:'pointer', flexShrink:0 }}><Icon name="bell" size={15} color="#A6364E"/></button>
                    <button onClick={()=>{ dispatch({type:'MERGE_APPS',payload:apps.filter(x=>x.id!==a.id)}); showToast(`${v.business} removed — slot released`,'info'); }} title="Remove from event" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:34, height:34, border:'1px solid #f3d5d0', background:'#FDEEEC', color:'#B03A2E', borderRadius:9, cursor:'pointer', flexShrink:0 }}><Icon name="trash" size={15} color="#B03A2E"/></button>
                  </div>
                </div>
              );
            })}
          </div>
          <Pager total={approvedApps.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}/>
        </div>
      )}

      {/* ── Deposit Record ── */}
      {aTab === 'deposits' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:9, marginBottom:14 }}>
            <div style={{ flex:1, minWidth:120, background:'#E8F5F0', borderRadius:13, padding:'12px 14px' }}>
              <div style={{ fontSize:11, fontWeight:600, color:'#2D6A4F' }}>Deposits held</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:'#2D6A4F', marginTop:3, lineHeight:1 }}>RM {money(Object.values(deposits).filter(d=>d.status==='paid').length*100)}</div>
              <div style={{ fontSize:10.5, color:'#6f9d8a', marginTop:3 }}>{Object.values(deposits).filter(d=>d.status==='paid').length} vendors · RM100 each</div>
            </div>
            <div style={{ flex:1, minWidth:120, background:'#EEF1FB', borderRadius:13, padding:'12px 14px' }}>
              <div style={{ fontSize:11, fontWeight:600, color:'#3D5BC4' }}>Refunded</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:'#3D5BC4', marginTop:3, lineHeight:1 }}>{Object.values(deposits).filter(d=>d.status==='refunded').length}</div>
              <div style={{ fontSize:10.5, color:'#7184c9', marginTop:3 }}>returned after market</div>
            </div>
          </div>
          <div style={{ fontSize:11.5, color:'#A09890', marginBottom:11, lineHeight:1.5 }}>The refundable RM100 deposit is tracked once per vendor. While unpaid, it is automatically added to that vendor's first event invoice.</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {vendors.map(v => {
              const dep = depRec(v.id);
              return (
                <div key={v.id} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:14, padding:'13px 14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'#1C1A17' }}>{v.business}</div>
                      <div style={{ fontSize:11.5, color:'#6B6560', marginTop:2 }}>{v.owner}</div>
                    </div>
                    <Badge status={dep.status}/>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'7px 16px', marginTop:10, fontSize:11.5, color:'#6B6560' }}>
                    <span>Invoice <b style={{ color:'#1C1A17' }}>{dep.inv||'—'}</b></span>
                    <span>Paid <b style={{ color:'#1C1A17' }}>{dep.payDate||'—'}</b></span>
                    <span>Refunded <b style={{ color:'#1C1A17' }}>{dep.refundDate||'—'}</b></span>
                  </div>
                  <button onClick={()=>{ const d=depRec(v.id); set({depModalVendor:v.id,depf:{...d}}); }} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:11, width:'100%', background:'#FAF8F5', border:'1px solid #e3d8ca', color:'#A6364E', fontSize:13, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>
                    <Icon name="pencil" size={14} color="#A6364E"/>Update deposit status
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Parking ── */}
      {aTab === 'parking' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={lbl}>Select event</div>
          <select value={filterEvent} onChange={e=>set({filterEvent:e.target.value,page:1})} style={{ width:'100%', maxWidth:360, border:'1px solid #e3d8ca', background:'#fff', borderRadius:11, padding:'12px 13px', fontSize:14, color:'#1C1A17', outline:'none', marginBottom:12 }}>
            {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          {(() => {
            const ev = curEv;
            const start = ev.startDate ? new Date(ev.startDate) : null;
            const end   = ev.endDate   ? new Date(ev.endDate)   : null;
            const inEvent = start && end && today >= start && today <= end;
            const editable = inEvent || parkOverride;
            return (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:9, background:editable?'#E8F5F0':'#FEF8EC', border:`1px solid ${editable?'#cfe9df':'#f3e6c9'}`, borderRadius:12, padding:'11px 13px', marginBottom:14 }}>
                  <Icon name={editable?'check':'lock'} size={15} color={editable?'#2D6A4F':'#B7770D'}/>
                  <div style={{ flex:1, fontSize:12, fontWeight:500, color:editable?'#2D6A4F':'#B7770D', lineHeight:1.4 }}>
                    {editable ? 'Entry is open — market is currently in progress.' : 'Locked — ticket entry is only available during the event dates.'}
                  </div>
                  <button onClick={()=>set({parkOverride:!parkOverride})} style={{ flexShrink:0, background:'rgba(255,255,255,0.65)', border:`1px solid ${editable?'#cfe9df':'#f3e6c9'}`, color:editable?'#2D6A4F':'#B7770D', fontSize:11, fontWeight:600, borderRadius:8, padding:'6px 10px', cursor:'pointer' }}>
                    {parkOverride ? 'Lock' : 'Override'}
                  </button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
                  {pagedPark.map(a => {
                    const v = vById(a.vendorId);
                    const cells = Array.from({length:ev.days||1},(_,i)=>({
                      dayLabel:`Day ${i+1}`, key:`${a.vendorId}-${ev.id}-${i+1}`,
                      value: parking[`${a.vendorId}-${ev.id}-${i+1}`]||'',
                    }));
                    return (
                      <div key={a.id} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:16, padding:13 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:14, fontWeight:700, color:'#1C1A17' }}>{v.business}</div>
                            <div style={{ fontSize:11, color:'#A09890', marginTop:1 }}>Vehicle owner on record</div>
                          </div>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11.5, fontWeight:600, color:'#6B6560', background:'#F2EDE6', borderRadius:6, padding:'4px 9px', flexShrink:0 }}>
                            <Icon name="car" size={13} color="#A6364E"/>{v.plate}
                          </span>
                        </div>
                        <div style={{ display:'flex', gap:8, marginTop:11 }}>
                          {cells.map(c => (
                            <div key={c.key} style={{ flex:1 }}>
                              <div style={{ fontSize:10, color:'#A09890', marginBottom:4, textAlign:'center' }}>{c.dayLabel} ticket</div>
                              <input value={c.value} disabled={!editable} onChange={e=>{ const p={...parking}; p[c.key]=e.target.value; dispatch({type:'MERGE_PARKING',payload:p}); }} placeholder="—" style={{ width:'100%', border:'1px solid #e3d8ca', background:editable?'#fff':'#F2EDE6', borderRadius:9, padding:'9px 8px', fontSize:13, fontWeight:600, textAlign:'center', outline:'none', color:'#1C1A17', cursor:editable?'text':'not-allowed' }}/>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Pager total={approvedApps.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}/>
              </>
            );
          })()}
        </div>
      )}

      {/* ── Event Pictures ── */}
      {aTab === 'photos' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={lbl}>Select event</div>
          <select value={filterEvent} onChange={e=>set({filterEvent:e.target.value,page:1})} style={{ width:'100%', maxWidth:360, border:'1px solid #e3d8ca', background:'#fff', borderRadius:11, padding:'12px 13px', fontSize:14, color:'#1C1A17', outline:'none', marginBottom:8 }}>
            {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <div style={{ fontSize:11.5, color:'#A09890', marginBottom:14 }}>Vendors submit product photos when applying. Download their uploads or upload event photos for them to download.</div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {pagedPhotos.map(a => {
              const v = vById(a.vendorId);
              const key = `${a.vendorId}-${filterEvent}`;
              const ep = eventPhotos[key]||{vendor:0,admin:0};
              const vendorTiles = Array.from({length:ep.vendor||0},(_,i)=>`linear-gradient(135deg,hsl(${i*40+10},50%,70%),hsl(${i*40+30},50%,50%))`);
              const adminTiles  = Array.from({length:ep.admin||0},(_,i)=>`linear-gradient(135deg,hsl(${i*50+200},40%,70%),hsl(${i*50+220},40%,50%))`);
              return (
                <div key={a.id} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:16, padding:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#1C1A17' }}>{v.business}</div>
                    <button onClick={()=>showToast(`Downloading ${v.business} photos…`,'download')} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#FAF8F5', border:'1px solid #e3d8ca', color:'#A6364E', fontSize:11.5, fontWeight:600, borderRadius:9, padding:'7px 11px', cursor:'pointer', flexShrink:0 }}>
                      <Icon name="download" size={13} color="#A6364E"/>Download
                    </button>
                  </div>
                  <div style={{ fontSize:11, fontWeight:600, color:'#A09890', marginTop:12 }}>Vendor uploads ({ep.vendor||0})</div>
                  {vendorTiles.length > 0 && <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:7 }}>{vendorTiles.map((bg,i)=><div key={i} style={{ width:74, height:74, borderRadius:10, background:bg }}/>)}</div>}
                  <div style={{ fontSize:11, fontWeight:600, color:'#A09890', marginTop:13 }}>Admin uploads ({ep.admin||0})</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:7, alignItems:'center' }}>
                    {adminTiles.map((bg,i)=><div key={i} style={{ width:74, height:74, borderRadius:10, background:bg }}/>)}
                    <button onClick={()=>{ const ep2={...eventPhotos}; const cur=ep2[key]||{vendor:0,admin:0}; ep2[key]={...cur,admin:(cur.admin||0)+1}; dispatch({type:'MERGE_PHOTOS',payload:ep2}); showToast(`Photo uploaded for ${v.business}`,'image'); }} style={{ width:74, height:74, borderRadius:10, border:'2px dashed #d8c6b2', background:'#FBF7F1', color:'#A6364E', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, cursor:'pointer', flexShrink:0 }}>
                      <Icon name="upload" size={18} color="#A6364E"/><span style={{ fontSize:9, fontWeight:600 }}>Upload</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <Pager total={approvedApps.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}/>
        </div>
      )}

      {/* ── Vendor Pass ── */}
      {aTab === 'pass' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={lbl}>Select event</div>
          <select value={filterEvent} onChange={e=>set({filterEvent:e.target.value,page:1})} style={{ width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:11, padding:'12px 13px', fontSize:14, color:'#1C1A17', outline:'none', marginBottom:14 }}>
            {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            {pagedPass.map(a => {
              const v = vById(a.vendorId);
              const p = passes[a.vendorId]||{status:'pending'};
              return (
                <div key={a.id} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:16, padding:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'#1C1A17' }}>{v.business}</div>
                      <div style={{ fontSize:11.5, color:'#6B6560', marginTop:3 }}>
                        {p.issued ? `${p.issued} tags issued` : 'No tags yet'}
                        {p.collectDate ? ` · collected ${p.collectDate}` : ''}
                      </div>
                    </div>
                    <Badge status={p.status}/>
                  </div>
                  <button onClick={()=>{ const ex=passes[a.vendorId]||{}; set({passModalVendor:a.vendorId,pf:{collector:ex.collector||'',phone:ex.phone||'',issued:ex.issued||'',collectDate:ex.collectDate||'',returned:ex.returned||'',returnDate:ex.returnDate||''}}); }} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:11, width:'100%', background:'#FAF8F5', border:'1px solid #e3d8ca', color:'#A6364E', fontSize:13, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>
                    <Icon name="pencil" size={14} color="#A6364E"/>Record collection / return
                  </button>
                </div>
              );
            })}
          </div>
          <Pager total={approvedApps.length} perPage={PER_PAGE} page={page} onPage={p=>set({page:p})}/>
        </div>
      )}

      {/* ── Categories ── */}
      {aTab === 'categories' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:16, padding:14, display:'flex', gap:9 }}>
            <input value={state.newCat} onChange={e=>set({newCat:e.target.value})} placeholder="New category name" style={{ flex:1, border:'1px solid #e3d8ca', background:'#FAF8F5', borderRadius:11, padding:'11px 13px', fontSize:14, outline:'none' }}/>
            <button onClick={()=>{ const n=state.newCat.trim(); if(!n) return; dispatch({type:'MERGE_CATS',payload:[...cats,{id:'c'+Date.now(),name:n}]}); set({newCat:''}); logActivity('Admin', `added the "${n}" category.`, {icon:'folder', tint:'#F8E9EE'}); showToast('Category added','check'); }} style={{ background:'#A6364E', color:'#FAF8F5', border:'none', fontSize:14, fontWeight:600, borderRadius:11, padding:'11px 16px', cursor:'pointer' }}>Add</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:14 }}>
            {cats.map(c => (
              <div key={c.id} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:14, padding:'13px 14px', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:34, height:34, borderRadius:10, background:'#F8E9EE', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Icon name="folder" size={17} color="#A6364E"/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'#1C1A17' }}>{c.name}</div>
                  <div style={{ fontSize:11.5, color:'#A09890', marginTop:1 }}>{vendors.filter(v=>v.category===c.name).length} vendors</div>
                </div>
                <button onClick={()=>{ dispatch({type:'MERGE_CATS',payload:cats.filter(x=>x.id!==c.id)}); showToast('Category removed','x'); }} style={{ background:'#FDEEEC', border:'none', width:32, height:32, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', color:'#B03A2E', cursor:'pointer', flexShrink:0 }}>
                  <Icon name="x" size={15} color="#B03A2E"/>
                </button>
              </div>
            ))}
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:'#1C1A17', margin:'20px 2px 11px' }}>Vendors by category</div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {cats.map(c => {
              const members = vendors.filter(v=>v.category===c.name);
              return (
                <div key={c.id} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:16, padding:14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#1C1A17' }}>{c.name}</div>
                    <span style={{ fontSize:11, fontWeight:600, color:'#A6364E', background:'#F8E9EE', borderRadius:999, padding:'3px 9px' }}>{members.length}</span>
                  </div>
                  {members.length > 0 ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:11 }}>
                      {members.map(v => (
                        <div key={v.id} style={{ display:'flex', alignItems:'center', gap:10, background:'#FBF7F1', borderRadius:11, padding:'9px 11px' }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:'#1C1A17' }}>{v.business}</div>
                            <div style={{ fontSize:11, color:'#A09890' }}>{v.owner}</div>
                          </div>
                          <select onChange={e=>{ dispatch({type:'MERGE_VENDORS',payload:vendors.map(x=>x.id===v.id?{...x,category:e.target.value}:x)}); showToast('Vendor re-assigned','folder'); }} value={v.category} style={{ flexShrink:0, border:'1px solid #e3d8ca', background:'#fff', borderRadius:9, padding:'7px 9px', fontSize:12, color:'#6B6560', outline:'none', cursor:'pointer' }}>
                            {cats.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  ) : <div style={{ fontSize:11.5, color:'#A09890', marginTop:9 }}>No vendors in this category yet.</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Activity ── */}
      {aTab === 'activity' && (
        <div style={{ padding:'16px 18px 20px' }}>
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            {[['all','All'],['admin','Admin'],['vendor','Vendor']].map(([id,label]) => (
              <button key={id} onClick={()=>set({actTab:id})} style={{ background:actTab===id?'#A6364E':'#fff', border:`1px solid ${actTab===id?'#A6364E':'#e3d8ca'}`, color:actTab===id?'#FAF8F5':'#6B6560', fontSize:12.5, fontWeight:600, borderRadius:999, padding:'8px 16px', cursor:'pointer' }}>{label}</button>
            ))}
          </div>
          <div style={{ display:'flex', flexDirection:'column' }}>
            {activity.filter(a => actTab==='all' || a.type===actTab).length === 0 && (
              <div style={{ fontSize:13, color:'#A09890', textAlign:'center', padding:'20px 0' }}>No activity yet.</div>
            )}
            {activity.filter(a => actTab==='all' || a.type===actTab).map((a,i,arr) => (
              <div key={i} style={{ display:'flex', gap:13 }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:a.tint, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Icon name={a.icon} size={15} color="#A6364E"/>
                  </div>
                  {i < arr.length-1 && <div style={{ width:2, flex:1, background:'#efe7dc', margin:'4px 0' }}/>}
                </div>
                <div style={{ paddingBottom:18, flex:1 }}>
                  <div style={{ fontSize:13.5, color:'#1C1A17', lineHeight:1.45 }}><span style={{ fontWeight:700 }}>{a.who}</span> {a.what}</div>
                  <div style={{ fontSize:11.5, color:'#A09890', marginTop:3 }}>{a.when}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Vendor Chart ── */}
      {aTab === 'chart' && (
        <div style={{ padding:'14px 16px 20px' }}>
          {(() => {
            const participation = {};
            apps.forEach(a => { participation[a.vendorId]=(participation[a.vendorId]||0)+1; });
            const sorted = Object.entries(participation).sort((a,b)=>b[1]-a[1]);
            const top = sorted[0] ? vById(sorted[0][0]) : {};
            const maxCount = sorted[0]?.[1]||1;
            return (
              <>
                <div style={{ background:'linear-gradient(135deg,#A6364E,#7A2438)', borderRadius:18, padding:18, color:'#FAF8F5' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, fontWeight:600, opacity:0.85 }}><Icon name="trophy" size={15} color="#FAF8F5"/>Most active vendor</div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, marginTop:7, lineHeight:1.1 }}>{top.business||'—'}</div>
                  <div style={{ fontSize:12.5, opacity:0.85, marginTop:3 }}>{sorted[0]?.[1]||0} markets joined</div>
                </div>
                <div style={{ display:'flex', gap:8, margin:'15px 0 13px', flexWrap:'wrap' }}>
                  {['all','2026','last3'].map(p => (
                    <button key={p} onClick={()=>set({chartPeriod:p})} style={{ background:chartPeriod===p?'#A6364E':'#fff', border:`1px solid ${chartPeriod===p?'#A6364E':'#e3d8ca'}`, color:chartPeriod===p?'#FAF8F5':'#6B6560', fontSize:12.5, fontWeight:600, borderRadius:999, padding:'8px 14px', cursor:'pointer' }}>
                      {p==='all'?'All time':p==='2026'?'2026':'Last 3 events'}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:'#1C1A17', margin:'2px 2px 11px' }}>Participation ranking</div>
                <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:16, padding:14, display:'flex', flexDirection:'column', gap:13 }}>
                  {sorted.map(([vid,count],i) => {
                    const v = vById(vid);
                    const pct = Math.round(count/maxCount*100);
                    const rankColors = ['#E8A04B','#A09890','#B87333'];
                    return (
                      <div key={vid} style={{ display:'flex', alignItems:'center', gap:11 }}>
                        <div style={{ width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0, background:i<3?rankColors[i]:'#F2EDE6', color:i<3?'#fff':'#6B6560' }}>{i+1}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:5 }}>
                            <span style={{ fontSize:13, fontWeight:600, color:'#1C1A17' }}>{v.business}</span>
                            <span style={{ fontSize:11.5, fontWeight:600, color:'#A6364E' }}>{count} market{count!==1?'s':''}</span>
                          </div>
                          <div style={{ height:6, borderRadius:3, background:'#F2EDE6', overflow:'hidden' }}>
                            <div style={{ height:'100%', borderRadius:3, background:'linear-gradient(90deg,#C75C84,#A6364E)', width:`${pct}%` }}/>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── Compliance ── */}
      {aTab === 'compliance' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={{ display:'flex', background:'#F2EDE6', borderRadius:12, padding:4, gap:4, marginBottom:14 }}>
            {[['log','Log offences'],['review','Vendor review']].map(([id,label]) => (
              <button key={id} onClick={()=>set({compTab:id})} style={{ flex:1, border:'none', fontSize:13, fontWeight:600, borderRadius:9, padding:'10px 4px', cursor:'pointer', background:compTab===id?'#FAF8F5':'transparent', color:compTab===id?'#1C1A17':'#6B6560', boxShadow:compTab===id?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>{label}</button>
            ))}
          </div>

          {compTab === 'log' && (
            <>
              <div style={lbl}>Event</div>
              <select value={filterEvent} onChange={e=>set({filterEvent:e.target.value,compSel:{}})} style={{ width:'100%', maxWidth:360, border:'1px solid #e3d8ca', background:'#fff', borderRadius:11, padding:'12px 13px', fontSize:14, color:'#1C1A17', outline:'none', marginBottom:14 }}>
                {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
                {Object.entries(OFFENSE_TYPES).map(([type,ot]) => {
                  const sel = compSel[type]||[];
                  const eventVendors = [...new Set(apps.filter(a=>a.eventId===filterEvent&&a.status==='approved').map(a=>a.vendorId))];
                  return (
                    <div key={type} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:14, padding:'13px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                        <span style={{ width:10, height:10, borderRadius:'50%', background:ot.color, flexShrink:0 }}/>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13.5, fontWeight:700, color:'#1C1A17' }}>{ot.label}</div>
                        </div>
                      </div>
                      {sel.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>
                          {sel.map(vid => (
                            <button key={vid} onClick={()=>{ const s={...compSel}; s[type]=(s[type]||[]).filter(x=>x!==vid); set({compSel:s}); }} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#F8E9EE', border:'1px solid #eccdd6', color:'#A6364E', fontSize:11.5, fontWeight:600, borderRadius:999, padding:'5px 7px 5px 11px', cursor:'pointer' }}>
                              {vById(vid).business}<Icon name="x" size={13} color="#A6364E"/>
                            </button>
                          ))}
                        </div>
                      )}
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:9 }}>
                        {eventVendors.filter(vid=>!sel.includes(vid)).map(vid => (
                          <button key={vid} onClick={()=>{ const s={...compSel}; s[type]=[...(s[type]||[]),vid]; set({compSel:s}); }} style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#FAF8F5', border:'1px dashed #d8c6b2', color:'#6B6560', fontSize:11.5, fontWeight:500, borderRadius:999, padding:'5px 11px', cursor:'pointer' }}>+ {vById(vid).business}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={()=>{
                const sel=compSel; const ev=filterEvent; const added=[]; let id=Date.now();
                Object.entries(sel).forEach(([type,vids])=>(vids||[]).forEach(vid=>added.push({id:'o'+(id++),vendorId:vid,eventId:ev,type})));
                if(!added.length){ showToast('Select at least one vendor first','info'); return; }
                dispatch({type:'MERGE_OFFENSES',payload:[...offenses,...added]});
                set({compSel:{}});
                logActivity('Admin', `logged ${added.length} offence${added.length>1?'s':''} for ${curEv.name}.`, {icon:'shield', tint:'#F8E9EE'});
                showToast(`${added.length} offence${added.length>1?'s':''} logged`,'shield');
              }} className="cta" style={{ marginTop:14, width:'100%', background:'#A6364E', color:'#FAF8F5', border:'none', fontSize:14, fontWeight:600, borderRadius:12, padding:13, cursor:'pointer' }}>
                Log selected offences for {curEv.name}
              </button>
            </>
          )}

          {compTab === 'review' && (
            <>
              <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:14, padding:'13px 14px', marginBottom:13 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#1C1A17', marginBottom:9 }}>Offence legend</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'8px 16px' }}>
                  {Object.entries(OFFENSE_TYPES).map(([type,ot]) => (
                    <span key={type} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11.5, color:'#6B6560' }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:ot.color }}/>
                      {ot.label}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {vendors.map(v => {
                  const vOff = offenses.filter(o=>o.vendorId===v.id);
                  const typeCounts = {};
                  vOff.forEach(o=>{ typeCounts[o.type]=(typeCounts[o.type]||0)+1; });
                  return (
                    <div key={v.id} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:14, padding:'13px 14px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:'#1C1A17' }}>{v.business}</div>
                          <div style={{ fontSize:11.5, color:'#6B6560', marginTop:1 }}>{v.category}</div>
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, color:'#6B6560', background:'#F2EDE6', borderRadius:999, padding:'5px 11px', flexShrink:0 }}>{vOff.length} total</span>
                      </div>
                      {vOff.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>
                          {Object.entries(typeCounts).map(([type,count]) => {
                            const ot = OFFENSE_TYPES[type]||{};
                            return <span key={type} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, borderRadius:999, padding:'4px 10px', background:ot.bg, color:ot.color }}><span style={{ width:6, height:6, borderRadius:'50%', background:ot.color }}/>{ot.label} ×{count}</span>;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Content ── */}
      {aTab === 'content' && (
        <div style={{ padding:'14px 16px 20px' }}>
          <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:18, padding:16 }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:600, color:'#1C1A17' }}>Homepage content</div>
            <div style={{ fontSize:12, color:'#A09890', marginTop:3 }}>Update public-facing branding without code.</div>
            <div style={{ marginTop:16 }}>
              <div style={lbl}>Badge / status text</div>
              <input value={state.cf?.purpose ?? content.purpose} onChange={e=>set({cf:{...(state.cf||content),purpose:e.target.value}})} style={inp}/>
            </div>
            <div style={{ marginTop:14 }}><div style={lbl}>Homepage title</div><textarea value={state.cf?.title ?? content.title} onChange={e=>set({cf:{...(state.cf||content),title:e.target.value}})} style={{ ...inp, minHeight:64, resize:'none' }}/></div>
            <div style={{ marginTop:14 }}><div style={lbl}>Intro / purpose</div><textarea value={state.cf?.subtitle ?? content.subtitle} onChange={e=>set({cf:{...(state.cf||content),subtitle:e.target.value}})} style={{ ...inp, minHeight:84, resize:'none' }}/></div>
            <div style={{ borderTop:'1px solid #f1ece4', marginTop:18, paddingTop:16 }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:600, color:'#1C1A17' }}>Application — market terms</div>
              <div style={{ fontSize:12, color:'#A09890', marginTop:3 }}>Shown on the last step of the vendor application. Vendors must accept before submitting.</div>
              <textarea value={state.cf?.terms ?? content.terms} onChange={e=>set({cf:{...(state.cf||content),terms:e.target.value}})} style={{ ...inp, minHeight:240, marginTop:12, fontSize:13, lineHeight:1.6, resize:'vertical' }}/>
            </div>
            <button onClick={()=>{ set({content:{...state.cf},cf:null}); logActivity('Admin', 'updated the homepage content.', {icon:'pen', tint:'#F8E9EE'}); showToast('Content updated','check'); }} className="cta" style={{ marginTop:16, width:'100%', background:'#A6364E', color:'#FAF8F5', border:'none', fontSize:14.5, fontWeight:600, borderRadius:12, padding:14, cursor:'pointer' }}>Save changes</button>
          </div>
        </div>
      )}

      {/* ── Settings ── */}
      {aTab === 'settings' && (
        <div style={{ padding:'14px 16px 20px', display:'flex', flexDirection:'column', gap:11 }}>
          {[
            { key:'autoApprove', title:'Auto-approve vendors', desc:'Automatically approve all new vendor registrations without manual review.' },
            { key:'publicEvents', title:'Show events publicly', desc:'Display upcoming markets on the public home page.' },
            { key:'emailAlerts', title:'Email alerts', desc:'Send email notifications to vendors on status changes.' },
          ].map(s => {
            const on = settings[s.key];
            return (
              <div key={s.key} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:14, padding:14, display:'flex', alignItems:'center', gap:13 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:'#1C1A17' }}>{s.title}</div>
                  <div style={{ fontSize:11.5, color:'#A09890', marginTop:2, lineHeight:1.4 }}>{s.desc}</div>
                </div>
                <div onClick={()=>set({settings:{...settings,[s.key]:!on}})} style={{ width:48, height:28, borderRadius:14, background:on?'#A6364E':'#ddd2c4', position:'relative', cursor:'pointer', flexShrink:0, transition:'background .2s' }}>
                  <div style={{ position:'absolute', top:3, left:on?22:3, width:22, height:22, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 1px 4px rgba(0,0,0,0.15)' }}/>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Admin Profile ── */}
      {aTab === 'profile' && (
        <div style={{ padding:'16px 16px 20px', display:'flex', flexDirection:'column', gap:13 }}>
          <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:18, padding:18, display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:54, height:54, borderRadius:'50%', background:'#3A1622', display:'flex', alignItems:'center', justifyContent:'center', color:'#FAF8F5', fontWeight:700, fontSize:18, flexShrink:0 }}>SA</div>
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:600, color:'#1C1A17' }}>Siti Aminah</div>
              <div style={{ fontSize:12.5, color:'#6B6560', marginTop:2 }}>Portal Administrator</div>
            </div>
          </div>
          <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:16, padding:'4px 16px' }}>
            {[['Email','admin@sulapartisan.com'],['Role','Super admin'],['Last sign-in','Today, 9:12 AM']].map(([k,v],i,arr) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'13px 0', borderBottom:i<arr.length-1?'1px solid #f1ece4':'none' }}>
                <span style={{ fontSize:12.5, color:'#A09890' }}>{k}</span>
                <span style={{ fontSize:13.5, fontWeight:600, color:'#1C1A17' }}>{v}</span>
              </div>
            ))}
          </div>
          <button onClick={logout} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#FDEEEC', border:'1px solid #f5d9d3', color:'#B03A2E', fontSize:14, fontWeight:600, borderRadius:14, padding:14, cursor:'pointer', marginTop:4 }}>
            <Icon name="x" size={16} color="#B03A2E"/>Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const lbl = { display:'block', fontSize:12, fontWeight:600, color:'#1C1A17', marginBottom:6 };
const inp = { width:'100%', border:'1px solid #e3d8ca', background:'#FAF8F5', borderRadius:11, padding:'12px 13px', fontSize:14, outline:'none', display:'block' };
