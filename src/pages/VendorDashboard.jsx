import Icon from '../components/Icon';
import Badge from '../components/Badge';
import { useStore } from '../lib/store';
import { money, fmt, fmtShort, fmtTime, payCalc } from '../lib/helpers';
import { CURRENT_VENDOR_ID } from '../data/mockData';

const TABS = [
  { id:'events',   label:'Available Markets' },
  { id:'apps',     label:'My Applications' },
  { id:'docs',     label:'Documents' },
  { id:'payments', label:'Payments' },
  { id:'parking',  label:'Parking' },
  { id:'pass',     label:'Vendor Pass' },
  { id:'profile',  label:'Profile' },
];

export default function VendorDashboard() {
  const { state, set, dispatch, showToast, closeModals, logActivity } = useStore();
  const { vTab, events, vendors, apps, payments, refunds, deposits, parking, passes } = state;
  const me = vendors.find(v => v.id === CURRENT_VENDOR_ID) || {};
  const today = new Date(); today.setHours(0,0,0,0);

  const depRec = (id) => deposits[id] || { status:'unpaid', inv:'', payDate:'', refundDate:'' };
  const payRec = (key) => payments[key] || { status:'unpaid', paid:0, advice:false, invoice:false, receipt:false };
  const refundRec = (key) => refunds[key] || { status:'none' };

  const tabStyle = (active) => ({
    flex:1, border:active?'none':'1px solid #efe7dc', fontFamily:"'DM Sans'",
    fontSize:12.5, fontWeight:600, borderRadius:11, padding:'10px 4px', cursor:'pointer',
    background:active?'#A6364E':'#fff', color:active?'#FAF8F5':'#6B6560',
  });

  const logout = () => { set({ vScreen:'login' }); showToast('Signed out','leaf'); };

  return (
    <div>
      {/* Header */}
      <div style={{ background:'linear-gradient(160deg,#F8E9EE,#F2EDE6)', padding:'16px 20px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:11 }}>
          <div style={{ width:42, height:42, borderRadius:'50%', background:'linear-gradient(140deg,#C75C84,#A6364E)', display:'flex', alignItems:'center', justifyContent:'center', color:'#FAF8F5', fontWeight:700, fontSize:16 }}>
            {(me.business||'').slice(0,2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize:12, color:'#6B6560' }}>Welcome back,</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:600, color:'#1C1A17', lineHeight:1.1 }}>{me.business}</div>
          </div>
        </div>
        <button onClick={logout} style={{ background:'#FAF8F5', border:'1px solid #e3d3c1', color:'#A6364E', fontSize:12, fontWeight:600, borderRadius:10, padding:'8px 12px', cursor:'pointer' }}>Sign out</button>
      </div>

      {/* Mobile tab bar */}
      <div className="vendor-tabs-bar" style={{ display:'flex', flexWrap:'wrap', gap:7, padding:'13px 16px 6px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { closeModals(); set({ vTab:t.id, page:1 }); }} style={tabStyle(vTab===t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ── Profile ── */}
      {vTab === 'profile' && (
        <div style={{ padding:'6px 16px 20px', display:'flex', flexDirection:'column', gap:13 }}>
          <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:18, padding:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:600, color:'#1C1A17' }}>Vendor details</div>
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'#A6364E', cursor:'pointer' }}><Icon name="pencil" size={13} color="#A6364E"/>Edit</span>
            </div>
            <div style={{ marginTop:14, display:'flex', flexDirection:'column' }}>
              {[['Brand name',me.business],['Contact person',me.owner],['Category',me.category],['Email',me.email],['Phone',me.phone],['Instagram',me.ig]].map(([k,v],i,arr) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 0', borderBottom:i<arr.length-1?'1px solid #f1ece4':'none' }}>
                  <span style={{ fontSize:12.5, color:'#A09890' }}>{k}</span>
                  <span style={{ fontSize:13.5, fontWeight:600, color: k==='Instagram'?'#A6364E':'#1C1A17' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:18, padding:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#1C1A17' }}>Product description</div>
            <div style={{ fontSize:13, color:'#6B6560', lineHeight:1.5, marginTop:7 }}>{me.desc}</div>
          </div>
          <div style={{ display:'flex', gap:9, background:'#FEF8EC', border:'1px solid #f3e6c9', borderRadius:12, padding:'12px 13px', fontSize:12, color:'#B7770D', lineHeight:1.45 }}>
            <Icon name="info" size={15} color="#B7770D" style={{ marginTop:1 }} />
            This is the information Sulap Artisan has on record. Contact admin to update locked fields.
          </div>
        </div>
      )}

      {/* ── Available Markets ── */}
      {vTab === 'events' && (
        <div style={{ padding:'12px 16px 20px', display:'flex', flexDirection:'column', gap:13 }}>
          {events.map(ev => {
            const myApp = apps.find(a => a.vendorId === CURRENT_VENDOR_ID && a.eventId === ev.id);
            const open = !ev.lastApp || new Date(ev.lastApp) >= today;
            const applied = !!myApp;
            const st = myApp?.status;
            const vendorApproved = me.status === 'approved';
            return (
              <div key={ev.id} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:18, overflow:'hidden', boxShadow:'0 3px 12px rgba(120,80,40,0.05)' }}>
                <div style={{ display:'flex', gap:13, padding:13 }}>
                  <div style={{ width:110, height:66, borderRadius:12, background:ev.img, flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:600, color:'#1C1A17', lineHeight:1.15 }}>{ev.name}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#6B6560', marginTop:5 }}>
                      <Icon name="calendar" size={13} color="#A09890"/>{ev.dateRange}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:9, fontSize:12, color:'#6B6560', marginTop:3 }}>
                      <span style={{ display:'flex', alignItems:'center', gap:5 }}><Icon name="clock" size={13} color="#A09890"/>{ev.startTime && ev.endTime ? `${fmtTime(ev.startTime)} – ${fmtTime(ev.endTime)}` : 'TBC'}</span>
                    </div>
                  </div>
                </div>
                <div style={{ padding:'0 13px 13px' }}>
                  <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                    <span style={{ background:'#E8F5F0', color:'#2D6A4F', fontSize:11, fontWeight:600, borderRadius:7, padding:'4px 8px' }}>F&B RM {ev.fnb}/day · {ev.days}d = RM {fmt(ev.fnb*ev.days)}</span>
                    <span style={{ background:'#F8E9EE', color:'#A6364E', fontSize:11, fontWeight:600, borderRadius:7, padding:'4px 8px' }}>Non-F&B RM {ev.nonfnb}/day · RM {fmt(ev.nonfnb*ev.days)}</span>
                  </div>
                  <button
                    onClick={() => {
                      if (applied) { showToast('You have already applied','info'); return; }
                      if (!vendorApproved) { showToast('Your vendor registration must be approved before you can apply to markets','lock'); return; }
                      if (!open)   { showToast('Applications closed for this market','lock'); return; }
                      set({ showApplyModal:true, applyEventId:ev.id, applyShare:null, applyPartners:[], applyPartnerSearch:'' });
                    }}
                    style={{ width:'100%', marginTop:11, border:'none', borderRadius:11, padding:11, fontSize:13, fontWeight:600, cursor: (applied||!open||!vendorApproved)?'default':'pointer', background: applied?(st==='rejected'?'#FDEEEC':'#E8F5F0'):(!vendorApproved?'#F2EDE6':(open?'#A6364E':'#F2EDE6')), color: applied?(st==='rejected'?'#B03A2E':'#2D6A4F'):(!vendorApproved?'#A09890':(open?'#FAF8F5':'#A09890')) }}
                  >
                    {applied ? (st==='approved'?'Approved': st==='rejected'?'Not selected':'Applied') : (!vendorApproved ? 'Awaiting registration approval' : (open?'Apply to this market':'Applications closed'))}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── My Applications ── */}
      {vTab === 'apps' && (
        <div style={{ padding:'12px 16px 20px' }}>
          {(() => {
            const myApps = apps.filter(a => a.vendorId === CURRENT_VENDOR_ID);
            if (!myApps.length) return (
              <div style={{ textAlign:'center', padding:'60px 30px', color:'#A09890', display:'flex', flexDirection:'column', alignItems:'center' }}>
                <Icon name="folder" size={34} color="#bcae9c" />
                <div style={{ fontSize:14, fontWeight:600, color:'#6B6560', marginTop:13 }}>No applications yet</div>
                <div style={{ fontSize:12.5, marginTop:5, lineHeight:1.5 }}>Head to Available markets and apply to your first event.</div>
              </div>
            );
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
                {myApps.map(a => {
                  const ev = events.find(e => e.id === a.eventId) || {};
                  const partnerNames = (a.partners||[]).map(pid => (vendors.find(v=>v.id===pid)?.business||'Unknown'));
                  return (
                    <div key={a.id} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:16, padding:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:600, color:'#1C1A17' }}>{ev.name}</div>
                        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#6B6560', marginTop:5 }}>
                          <Icon name="calendar" size={13} color="#A09890"/>{ev.dateRange}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11.5, color:'#A6364E', marginTop:6 }}>
                          <Icon name={a.shared?'users':'tent'} size={12} color="#A6364E"/>
                          {a.shared ? `Sharing booth with ${partnerNames.join(', ')}` : 'Solo booth'}
                        </div>
                      </div>
                      <Badge status={a.status} label={a.status==='pending'?'Awaiting review':undefined} />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Documents ── */}
      {vTab === 'docs' && (
        <div style={{ padding:'12px 16px 20px', display:'flex', flexDirection:'column', gap:11 }}>
          {[
            { icon:'file', tint:'#E8F5F0', iconColor:'#2D6A4F', title:'SSM Registration', sub:'Uploaded · ssm_cert.pdf', subColor:'#2D6A4F', action:'Replace' },
            { icon:'badge', tint:'#FEF8EC', iconColor:'#B7770D', title:'Halal / Food Cert', sub:'Optional · not uploaded', subColor:'#B7770D', action:'Upload' },
          ].map(d => (
            <div key={d.title} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:16, padding:15, display:'flex', alignItems:'center', gap:13 }}>
              <div style={{ width:42, height:42, borderRadius:11, background:d.tint, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Icon name={d.icon} size={20} color={d.iconColor}/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:'#1C1A17' }}>{d.title}</div>
                <div style={{ fontSize:12, color:d.subColor, marginTop:2 }}>{d.sub}</div>
              </div>
              <span style={{ fontSize:13, color:'#A6364E', fontWeight:600, cursor:'pointer' }}>{d.action}</span>
            </div>
          ))}
          <div style={{ border:'2px dashed #d8c6b2', borderRadius:16, background:'#FBF7F1', padding:24, textAlign:'center', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center' }}>
            <Icon name="folder" size={26} color="#A6364E"/>
            <div style={{ fontSize:13.5, fontWeight:600, color:'#1C1A17', marginTop:9 }}>Add another document</div>
            <div style={{ fontSize:11.5, color:'#A09890', marginTop:3 }}>PDF, JPG or PNG up to 10MB</div>
          </div>
        </div>
      )}

      {/* ── Payments ── */}
      {vTab === 'payments' && (
        <div style={{ padding:'6px 16px 20px', display:'flex', flexDirection:'column', gap:13 }}>
          {/* Deposit card */}
          {(() => {
            const dep = depRec(CURRENT_VENDOR_ID);
            return (
              <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:16, padding:'14px 15px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <Icon name="receipt" size={16} color="#A6364E"/>
                    <span style={{ fontSize:14, fontWeight:700, color:'#1C1A17' }}>Security deposit</span>
                  </div>
                  <Badge status={dep.status} />
                </div>
                <div style={{ fontSize:12, color:'#6B6560', lineHeight:1.45, marginTop:8 }}>A refundable RM100 deposit is required once per vendor. It will be returned after your first market.</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 16px', marginTop:9, fontSize:11.5, color:'#A09890' }}>
                  <span>Invoice <b style={{ color:'#6B6560' }}>{dep.inv||'—'}</b></span>
                  <span>Paid <b style={{ color:'#6B6560' }}>{dep.payDate||'—'}</b></span>
                  <span>Refunded <b style={{ color:'#6B6560' }}>{dep.refundDate||'—'}</b></span>
                </div>
              </div>
            );
          })()}
          {/* Event payments */}
          {apps.filter(a => a.vendorId === CURRENT_VENDOR_ID && a.status === 'approved').map(a => {
            const ev = events.find(e => e.id === a.eventId) || {};
            const dep = depRec(CURRENT_VENDOR_ID);
            const calc = payCalc(me, ev, dep.status);
            const payKey = `${CURRENT_VENDOR_ID}-${ev.id}`;
            const rec = payRec(payKey);
            const ref = refundRec(payKey);
            const isPartial = rec.status === 'partial';
            const overpaidAmt = rec.paid - calc.total;
            const toggleAdvice = (field, label) => {
              const p = {...payments};
              const cur = p[payKey] || { status:'unpaid', paid:0, advice:false, invoice:false, receipt:false };
              const wasUploaded = cur[field];
              p[payKey] = {...cur, [field]: !wasUploaded};
              dispatch({type:'MERGE_PAYMENTS', payload:p});
              logActivity(me.business, `${wasUploaded?'removed':'uploaded'} ${label} for ${ev.name}.`, {icon:'file', tint:'#F8E9EE', type:'vendor'});
              showToast(wasUploaded?`${label} removed`:`${label} uploaded`,'file');
            };
            return (
              <div key={a.id} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:18, overflow:'hidden', boxShadow:'0 3px 12px rgba(120,80,40,0.05)' }}>
                <div style={{ padding:'15px 16px', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:600, color:'#1C1A17' }}>{ev.name}</div>
                    <div style={{ fontSize:12, color:'#6B6560', marginTop:4 }}>{ev.dateRange}</div>
                  </div>
                  <Badge status={rec.status} />
                </div>
                <div style={{ padding:'0 16px 14px' }}>
                  <div style={{ background:'#FBF7F1', borderRadius:12, padding:'11px 13px', marginBottom:11 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#6B6560' }}><span>{calc.tier} · RM {calc.rate}/day × {calc.days} days</span><span>RM {money(calc.base)}</span></div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#6B6560', marginTop:5 }}><span>SST (6%)</span><span>RM {money(calc.sst)}</span></div>
                    {calc.needsDeposit && <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#6B6560', marginTop:5 }}><span>Security deposit (one-time)</span><span>RM 100.00</span></div>}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:8, paddingTop:8, borderTop:'1px solid #efe7dc' }}>
                      <span style={{ fontSize:13, fontWeight:600, color:'#1C1A17' }}>Total due</span>
                      <span style={{ fontFamily:"'Playfair Display',serif", fontSize:21, fontWeight:600, color:'#1C1A17' }}>RM {money(calc.total)}</span>
                    </div>
                    {isPartial && overpaidAmt <= 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:11.5, color:'#C76A0D', fontWeight:600, marginTop:5 }}><span>Paid RM {money(rec.paid)} · Outstanding</span><span>RM {money(calc.total-rec.paid)}</span></div>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:'#FAF8F5', border:'1px solid #efe7dc', borderRadius:10, padding:'9px 11px' }}>
                      <Icon name="file" size={15} color="#A6364E"/><span style={{ fontSize:12, color:'#6B6560' }}>INV-{ev.id?.toUpperCase()}-001</span>
                    </div>
                    <button style={{ display:'flex', alignItems:'center', gap:6, background:'#A6364E', color:'#FAF8F5', border:'none', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'10px 13px', cursor:'pointer' }}>
                      <Icon name="download" size={14} color="#FAF8F5"/>Invoice
                    </button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:9 }}>
                    <button onClick={()=>toggleAdvice('advice','Payment advice')} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:rec.advice?'#E8F5F0':'#FAF8F5', border:`1px solid ${rec.advice?'#cfe9df':'#e3d8ca'}`, color:rec.advice?'#2D6A4F':'#6B6560', fontSize:12.5, fontWeight:600, borderRadius:10, padding:10, cursor:'pointer' }}>
                      <Icon name={rec.advice?'check':'upload'} size={14} color={rec.advice?'#2D6A4F':'#6B6560'}/>{rec.advice?'Payment advice uploaded':'Upload payment advice'}
                    </button>
                    {isPartial && (
                      <button onClick={()=>toggleAdvice('advice2','second payment advice')} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:rec.advice2?'#E8F5F0':'#FAF8F5', border:`1px solid ${rec.advice2?'#cfe9df':'#e3d8ca'}`, color:rec.advice2?'#2D6A4F':'#6B6560', fontSize:12.5, fontWeight:600, borderRadius:10, padding:10, cursor:'pointer' }}>
                        <Icon name={rec.advice2?'check':'upload'} size={14} color={rec.advice2?'#2D6A4F':'#6B6560'}/>{rec.advice2?'Second payment advice uploaded':'Upload second payment advice (remaining balance)'}
                      </button>
                    )}
                  </div>
                  {overpaidAmt > 0 && ref.status !== 'closed' && (
                    <div style={{ display:'flex', alignItems:'flex-start', gap:8, background:'#FDEEEC', border:'1px solid #f3d5d0', borderRadius:11, padding:'10px 12px', marginTop:11, fontSize:12, color:'#B03A2E', lineHeight:1.45 }}>
                      <Icon name="info" size={14} color="#B03A2E" style={{ marginTop:1 }}/>
                      <div>You've overpaid by RM {money(overpaidAmt)}. {ref.status==='completed' ? `Refund completed · Ref ${ref.refCode} · ${ref.date} ${fmtTime(ref.time)}.` : `We're arranging a refund — you'll be notified once it's processed.`}</div>
                    </div>
                  )}
                  {overpaidAmt > 0 && ref.status === 'closed' && (
                    <div style={{ fontSize:11, color:'#A09890', marginTop:9 }}>Refund closed · Ref {ref.refCode} · {ref.date} {fmtTime(ref.time)}</div>
                  )}
                </div>
              </div>
            );
          })}
          <div style={{ display:'flex', gap:9, background:'#E8F5F0', border:'1px solid #cfe9df', borderRadius:12, padding:'12px 13px', fontSize:12, color:'#2D6A4F', lineHeight:1.45 }}>
            <Icon name="info" size={15} color="#2D6A4F" style={{ marginTop:1 }}/>
            Pay via bank transfer to the account on your invoice. Admin verifies receipt within 2 working days.
          </div>
        </div>
      )}

      {/* ── Parking ── */}
      {vTab === 'parking' && (
        <div style={{ padding:'6px 16px 20px' }}>
          {(() => {
            const myParkApps = apps.filter(a => a.vendorId === CURRENT_VENDOR_ID && a.status === 'approved');
            if (!myParkApps.length) return (
              <div style={{ textAlign:'center', padding:'60px 30px', color:'#A09890', display:'flex', flexDirection:'column', alignItems:'center' }}>
                <Icon name="car" size={34} color="#bcae9c"/>
                <div style={{ fontSize:14, fontWeight:600, color:'#6B6560', marginTop:13 }}>No parking assigned yet</div>
                <div style={{ fontSize:12.5, marginTop:5, lineHeight:1.5 }}>Parking serials appear here once admin allocates them before market day.</div>
              </div>
            );
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
                {myParkApps.map(a => {
                  const ev = events.find(e => e.id === a.eventId) || {};
                  const cells = Array.from({length:ev.days||1},(_,i)=>({
                    dayLabel:`Day ${i+1}`,
                    value: parking[`${CURRENT_VENDOR_ID}-${ev.id}-${i+1}`] || '—',
                  }));
                  const hasTicket = cells.some(c => c.value !== '—');
                  return (
                    <div key={a.id} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:18, padding:16 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:600, color:'#1C1A17' }}>{ev.name}</div>
                          <div style={{ fontSize:12, color:'#6B6560', marginTop:4 }}>{ev.location} · {ev.dateRange}</div>
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, borderRadius:999, padding:'5px 11px', background:hasTicket?'#E8F5F0':'#FEF8EC', color:hasTicket?'#2D6A4F':'#B7770D' }}>{hasTicket?'Assigned':'Pending'}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:12, background:'#F2EDE6', borderRadius:10, padding:'8px 12px', width:'fit-content' }}>
                        <Icon name="car" size={15} color="#A6364E"/><span style={{ fontSize:12.5, fontWeight:600, color:'#1C1A17' }}>{me.plate}</span>
                      </div>
                      <div style={{ display:'flex', gap:8, marginTop:12 }}>
                        {cells.map((c,i) => (
                          <div key={i} style={{ flex:1, textAlign:'center', background:'#E8F5F0', border:'1px solid #cfe9df', borderRadius:10, padding:'10px 4px' }}>
                            <div style={{ fontSize:10, color:'#2D6A4F', fontWeight:600 }}>{c.dayLabel}</div>
                            <div style={{ fontSize:15, fontWeight:700, color:'#2D6A4F', marginTop:3 }}>{c.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Vendor Pass ── */}
      {vTab === 'pass' && (
        <div style={{ padding:'6px 16px 20px', display:'flex', flexDirection:'column', gap:13 }}>
          {apps.filter(a => a.vendorId === CURRENT_VENDOR_ID && a.status === 'approved').map(a => {
            const ev = events.find(e => e.id === a.eventId) || {};
            const p = passes[CURRENT_VENDOR_ID] || { status:'pending' };
            return (
              <div key={a.id} style={{ borderRadius:20, overflow:'hidden', boxShadow:'0 6px 20px rgba(120,80,40,0.12)' }}>
                <div style={{ background:'linear-gradient(150deg,#2A241C,#4A3320)', padding:'18px 18px 16px', color:'#FAF8F5' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontSize:10, letterSpacing:'0.16em', textTransform:'uppercase', color:'rgba(250,248,245,0.6)' }}>Sulap Artisan</div>
                      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:600, marginTop:3 }}>Vendor Pass</div>
                    </div>
                    <Badge status={p.status} />
                  </div>
                  <div style={{ marginTop:18, fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:600 }}>{me.business}</div>
                  <div style={{ fontSize:12.5, color:'rgba(250,248,245,0.72)', marginTop:3 }}>{ev.name}</div>
                </div>
                <div style={{ background:'#fff', padding:'14px 18px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', border:'1px solid #efe7dc', borderTop:'none' }}>
                  <div><div style={{ fontSize:10.5, color:'#A09890', letterSpacing:'0.04em' }}>REFERENCE</div><div style={{ fontSize:13, fontWeight:700, color:'#1C1A17', marginTop:2 }}>SA-{ev.id?.toUpperCase()}-{CURRENT_VENDOR_ID.toUpperCase()}</div></div>
                  <div style={{ textAlign:'right' }}><div style={{ fontSize:10.5, color:'#A09890', letterSpacing:'0.04em' }}>BOOTH</div><div style={{ fontSize:13, fontWeight:700, color:'#1C1A17', marginTop:2 }}>A-07</div></div>
                </div>
              </div>
            );
          })}
          <div style={{ display:'flex', gap:9, background:'#FEF8EC', border:'1px solid #f3e6c9', borderRadius:12, padding:'12px 13px', fontSize:12, color:'#B7770D', lineHeight:1.45 }}>
            <Icon name="badge" size={15} color="#B7770D" style={{ marginTop:1 }}/>
            Show this pass at the vendor check-in counter on market day for booth access.
          </div>
        </div>
      )}
    </div>
  );
}
