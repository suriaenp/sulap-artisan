import { useState } from 'react';
import Icon from '../components/Icon';
import Badge from '../components/Badge';
import PhotoTile from '../components/PhotoTile';
import { useStore } from '../lib/store';
import { money, fmt, fmtShort, fmtTime, payCalc, EINVOICE_FIELDS, einvoiceComplete, DETAILS_FIELDS } from '../lib/helpers';
import { CURRENT_VENDOR_ID, EMPTY_EINVOICE } from '../data/mockData';
import { fileToPhoto, downloadPhoto, downloadZip, safeName, photoExt } from '../lib/photoFiles';
import { scanAndRecord, scanNotice } from '../lib/payScan';

const TABS = [
  { id:'events',   label:'Available Markets' },
  { id:'apps',     label:'My Applications' },
  { id:'photos',   label:'Product Photos' },
  { id:'eventPics',label:'Event Pictures' },
  { id:'docs',     label:'Documents' },
  { id:'payments', label:'Payments' },
  { id:'parking',  label:'Parking' },
  { id:'pass',     label:'Vendor Pass' },
  { id:'compliance', label:'Compliance' },
  { id:'profile',  label:'Profile' },
];

export default function VendorDashboard() {
  const { state, set, dispatch, showToast, closeModals, logActivity } = useStore();
  const { vTab, events, vendors, apps, payments, refunds, deposits, parking, passes, eventPhotos, offenses, offenseTypes, settings, cats, profileRequests } = state;
  const me = vendors.find(v => v.id === CURRENT_VENDOR_ID) || {};
  const today = new Date(); today.setHours(0,0,0,0);
  const einvoiceOk = einvoiceComplete(me);
  const pendingReq = (section) => profileRequests.find(r => r.vendorId === CURRENT_VENDOR_ID && r.section === section && r.status === 'pending');
  const submitRequest = (section, changes) => {
    dispatch({ type:'MERGE_PROFILE_REQUESTS', payload: [...profileRequests, { id:`pr-${Date.now()}`, vendorId:CURRENT_VENDOR_ID, section, changes, submittedAt: fmtShort(new Date()), status:'pending' }] });
    logActivity(me.business, section === 'einvoice' ? 'submitted E-Invoice & bank details for admin review.' : 'requested changes to their vendor profile.', { icon:'pencil', tint:'#F2EDE6', type:'vendor' });
    showToast('Change request sent to admin', 'check');
  };

  // ── Vendor details (locked — request-based) ──
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState(null);
  const detailsReq = pendingReq('details');
  const startEditDetails = () => { setDetailsForm({ business:me.business||'', owner:me.owner||'', category:me.category||'', email:me.email||'', phone:me.phone||'', plate:me.plate||'', desc:me.desc||'' }); setEditingDetails(true); };
  const sendDetailsRequest = () => {
    if (!detailsForm.business.trim() || !detailsForm.owner.trim() || !detailsForm.email.trim() || !detailsForm.phone.trim()) { showToast('Please fill in all required fields', 'info'); return; }
    submitRequest('details', detailsForm);
    setEditingDetails(false);
  };

  // ── Social media & power supply (directly vendor-editable) ──
  const [editingSocial, setEditingSocial] = useState(false);
  const [socialForm, setSocialForm] = useState(null);
  const startEditSocial = () => { setSocialForm({ ig:me.ig||'', fb:me.fb||'', tiktok:me.tiktok||'', power:me.power||'' }); setEditingSocial(true); };
  const saveSocial = () => {
    dispatch({ type:'MERGE_VENDORS', payload: vendors.map(v => v.id===CURRENT_VENDOR_ID ? { ...v, ...socialForm } : v) });
    logActivity(me.business, 'updated their social media & power supply info.', { icon:'pencil', tint:'#F2EDE6', type:'vendor' });
    showToast('Updated', 'check');
    setEditingSocial(false);
  };

  // ── E-Invoice & bank details (locked — request-based, required before applying) ──
  const [editingEI, setEditingEI] = useState(false);
  const [eiForm, setEiForm] = useState(null);
  const einvoiceReq = pendingReq('einvoice');
  const startEditEI = () => { setEiForm({ ...EMPTY_EINVOICE, ...(me.einvoice||{}) }); setEditingEI(true); };
  const saveEI = () => {
    if (EINVOICE_FIELDS.some(([k]) => !eiForm[k].trim())) { showToast('Please fill in every field (use "N/A" for SST if not registered)', 'info'); return; }
    submitRequest('einvoice', eiForm);
    setEditingEI(false);
  };

  const depRec = (id) => deposits[id] || { status:'unpaid', inv:'', payDate:'', refundDate:'' };
  const payRec = (key) => payments[key] || { status:'unpaid', paid:0, advice:false, invoice:false, receipt:false };
  const refundRec = (key) => refunds[key] || { status:'none' };

  const tabStyle = (active) => ({
    flex:1, border:active?'none':'1px solid #efe7dc', fontFamily:"'Karla'",
    fontSize:12.5, fontWeight:600, borderRadius:11, padding:'10px 4px', cursor:'pointer',
    background:active?'#9A5B26':'#fff', color:active?'#FAF8F5':'#6B6560',
  });

  const logout = () => { set({ vScreen:'login' }); showToast('Signed out','leaf'); };

  return (
    <div>
      {/* Header */}
      <div style={{ background:'linear-gradient(160deg,#F3E4CC,#F2EDE6)', padding:'16px 20px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:11 }}>
          <div style={{ width:42, height:42, borderRadius:'50%', background:'linear-gradient(140deg,#B97434,#9A5B26)', display:'flex', alignItems:'center', justifyContent:'center', color:'#FAF8F5', fontWeight:700, fontSize:16 }}>
            {(me.business||'').slice(0,2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize:12, color:'#6B6560' }}>Welcome back,</div>
            <div style={{ fontFamily:"'Marcellus',serif", fontSize:18, fontWeight:400, color:'#1C1A17', lineHeight:1.1 }}>{me.business}</div>
          </div>
        </div>
        <button onClick={logout} style={{ background:'#FAF8F5', border:'1px solid #e3d3c1', color:'#9A5B26', fontSize:12, fontWeight:600, borderRadius:10, padding:'8px 12px', cursor:'pointer' }}>Sign out</button>
      </div>

      {/* Mobile tab bar */}
      <div className="vendor-tabs-bar" style={{ display:'flex', flexWrap:'wrap', gap:7, padding:'13px 16px 6px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { closeModals(); set({ vTab:t.id, page:1 }); }} style={tabStyle(vTab===t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ── Compliance ── */}
      {vTab === 'compliance' && (
        <div style={{ padding:'6px 16px 20px', display:'flex', flexDirection:'column', gap:13 }}>
          {(() => {
            const myOff = offenses.filter(o => o.vendorId === CURRENT_VENDOR_ID);
            const skipN = settings.skipMarkets ?? 1;
            if (!myOff.length) return (
              <div style={{ textAlign:'center', padding:'60px 30px', color:'#A09890', display:'flex', flexDirection:'column', alignItems:'center' }}>
                <div style={{ width:64, height:64, borderRadius:'50%', background:'#E8F5F0', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon name="shield" size={30} color="#2D6A4F"/>
                </div>
                <div style={{ fontSize:14, fontWeight:600, color:'#2D6A4F', marginTop:13 }}>No offences on record</div>
                <div style={{ fontSize:12.5, marginTop:5, lineHeight:1.5 }}>Keep it up! A clean record keeps you eligible for every market.</div>
              </div>
            );
            // Group offences by market, most recent market first
            const groups = [];
            myOff.forEach(o => {
              let g = groups.find(x => x.eventId === o.eventId);
              if (!g) { g = { eventId:o.eventId, ev: events.find(e=>e.id===o.eventId)||{}, offs:[] }; groups.push(g); }
              g.offs.push(o);
            });
            groups.sort((a,b) => (b.ev.startDate||'').localeCompare(a.ev.startDate||''));
            return (
              <>
                <div style={{ display:'flex', gap:9, background:'#FEF8EC', border:'1px solid #f3e6c9', borderRadius:12, padding:'12px 13px', fontSize:12, color:'#B7770D', lineHeight:1.45 }}>
                  <Icon name="info" size={15} color="#B7770D" style={{ marginTop:1 }}/>
                  This tab is your compliance record — offences the Sulap team has logged against your booth. Policy: vendors with offences sit out the next {skipN} market{skipN>1?'s':''} after the incident, though the Sulap team may allow earlier participation at their discretion.
                </div>
                <div className="admin-cards">
                  {groups.map(g => (
                    <div key={g.eventId} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:16, padding:14 }}>
                      <div style={{ fontFamily:"'Marcellus',serif", fontSize:15.5, fontWeight:400, color:'#1C1A17' }}>{g.ev.name||'Unknown market'}</div>
                      {g.ev.dateRange && <div style={{ fontSize:11.5, color:'#A09890', marginTop:2 }}>{g.ev.dateRange}</div>}
                      <div style={{ display:'flex', flexDirection:'column', gap:11, marginTop:12 }}>
                        {g.offs.map((o,oi) => {
                          const ot = offenseTypes[o.type]||{};
                          const oPhotos = o.photos||[];
                          return (
                            <div key={o.id} style={oi>0 ? { paddingTop:11, borderTop:'1px solid #f1ece4' } : undefined}>
                              <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11.5, fontWeight:600, borderRadius:999, padding:'5px 11px', background:ot.bg, color:ot.color }}><span style={{ width:6, height:6, borderRadius:'50%', background:ot.color }}/>{ot.label||'Offence'}</span>
                              {oPhotos.length > 0 ? (
                                <>
                                  <div style={{ fontSize:11, fontWeight:600, color:'#A09890', marginTop:10 }}>Photos from the Sulap team ({oPhotos.length})</div>
                                  <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:7 }}>
                                    {oPhotos.map((ph,i) => (
                                      <PhotoTile key={ph.id} photo={ph} size={72} onDownload={()=>downloadPhoto(ph, `${safeName(g.ev.name||'offence')} - evidence - ${String(i+1).padStart(2,'0')}.${photoExt(ph)}`)}/>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <div style={{ fontSize:11.5, color:'#A09890', marginTop:9 }}>No photos attached to this record.</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:11.5, color:'#A09890', lineHeight:1.5 }}>If you believe a record was logged in error, contact the Sulap team with your booth details.</div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── Profile ── */}
      {vTab === 'profile' && (
        <div style={{ padding:'6px 16px 20px', display:'flex', flexDirection:'column', gap:13 }}>
          {/* Vendor details — locked, request-based */}
          <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:18, padding:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:18, fontWeight:400, color:'#1C1A17' }}>Vendor details</div>
              {!editingDetails && !detailsReq && (
                <span onClick={startEditDetails} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'#9A5B26', cursor:'pointer', flexShrink:0 }}>
                  <Icon name="pencil" size={13} color="#9A5B26"/>Request a change
                </span>
              )}
            </div>

            {detailsReq && !editingDetails && (
              <div style={{ display:'flex', gap:9, background:'#FEF8EC', border:'1px solid #f3e6c9', borderRadius:12, padding:'12px 13px', margin:'13px 0 0', fontSize:12, color:'#B7770D', lineHeight:1.45 }}>
                <Icon name="clock" size={15} color="#B7770D" style={{ marginTop:1 }} />
                Change request sent {detailsReq.submittedAt} — pending admin review. You'll see the update here once it's decided.
              </div>
            )}

            {editingDetails ? (
              <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:12 }}>
                {DETAILS_FIELDS.map(([k,label]) => (
                  <div key={k}>
                    <label style={lbl}>{label}</label>
                    {k === 'category' ? (
                      <select value={detailsForm.category} onChange={e=>setDetailsForm({ ...detailsForm, category:e.target.value })} style={inp}>
                        {cats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    ) : k === 'desc' ? (
                      <textarea value={detailsForm.desc} onChange={e=>setDetailsForm({ ...detailsForm, desc:e.target.value })} style={{ ...inp, minHeight:74, resize:'none' }} />
                    ) : (
                      <input value={detailsForm[k]} onChange={e=>setDetailsForm({ ...detailsForm, [k]:e.target.value })} style={inp} />
                    )}
                  </div>
                ))}
                <div style={{ fontSize:11, color:'#A09890' }}>Your changes are sent to Sulap Artisan for review — they won't appear here until admin approves.</div>
                <div style={{ display:'flex', gap:9, marginTop:2 }}>
                  <button onClick={()=>setEditingDetails(false)} style={{ flex:1, background:'#F2EDE6', color:'#1C1A17', border:'none', fontSize:13.5, fontWeight:600, borderRadius:12, padding:12, cursor:'pointer' }}>Cancel</button>
                  <button onClick={sendDetailsRequest} style={{ flex:1, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:13.5, fontWeight:600, borderRadius:12, padding:12, cursor:'pointer' }}>Send request</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop:14, display:'flex', flexDirection:'column' }}>
                {DETAILS_FIELDS.map(([k,label],i,arr) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:14, padding:'11px 0', borderBottom:i<arr.length-1?'1px solid #f1ece4':'none' }}>
                    <span style={{ fontSize:12.5, color:'#A09890', flexShrink:0 }}>{label}</span>
                    <span style={{ fontSize:13.5, fontWeight:600, color:'#1C1A17', textAlign:'right' }}>{me[k] || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Social media & power supply — directly vendor-editable */}
          <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:18, padding:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:18, fontWeight:400, color:'#1C1A17' }}>Social media &amp; power supply</div>
              {!editingSocial && (
                <span onClick={startEditSocial} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'#9A5B26', cursor:'pointer', flexShrink:0 }}>
                  <Icon name="pencil" size={13} color="#9A5B26"/>Edit
                </span>
              )}
            </div>
            {editingSocial ? (
              <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:11 }}>
                {[['instagram','ig','@instagram_handle'],['facebook','fb','Facebook page name or URL'],['tiktok','tiktok','@tiktok_handle']].map(([icon,key,ph]) => (
                  <div key={key} style={{ display:'flex', alignItems:'center', gap:11, border:'1px solid #e3d8ca', background:'#fff', borderRadius:12, padding:'0 14px' }}>
                    <Icon name={icon} size={18} color="#9A5B26" />
                    <input value={socialForm[key]} onChange={e=>setSocialForm({ ...socialForm, [key]:e.target.value })} placeholder={ph} style={{ flex:1, border:'none', padding:'13px 0', fontSize:14.5, outline:'none', background:'transparent' }} />
                  </div>
                ))}
                <div>
                  <label style={lbl}>Power supply needs</label>
                  <textarea value={socialForm.power} onChange={e=>setSocialForm({ ...socialForm, power:e.target.value })} placeholder="List machines + voltage" style={{ ...inp, minHeight:74, resize:'none' }} />
                </div>
                <div style={{ display:'flex', gap:9, marginTop:2 }}>
                  <button onClick={()=>setEditingSocial(false)} style={{ flex:1, background:'#F2EDE6', color:'#1C1A17', border:'none', fontSize:13.5, fontWeight:600, borderRadius:12, padding:12, cursor:'pointer' }}>Cancel</button>
                  <button onClick={saveSocial} style={{ flex:1, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:13.5, fontWeight:600, borderRadius:12, padding:12, cursor:'pointer' }}>Save</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop:14, display:'flex', flexDirection:'column' }}>
                {[['Instagram',me.ig],['Facebook',me.fb],['TikTok',me.tiktok],['Power supply needs',me.power]].map(([k,v],i,arr) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:14, padding:'11px 0', borderBottom:i<arr.length-1?'1px solid #f1ece4':'none' }}>
                    <span style={{ fontSize:12.5, color:'#A09890', flexShrink:0 }}>{k}</span>
                    <span style={{ fontSize:13.5, fontWeight:600, color: k==='Power supply needs'?'#1C1A17':'#9A5B26', textAlign:'right' }}>{v || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* E-Invoice & bank details — locked, request-based, required (once approved) before applying to markets */}
          {me.status === 'approved' ? (
            <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:18, padding:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontFamily:"'Marcellus',serif", fontSize:18, fontWeight:400, color:'#1C1A17' }}>E-Invoice &amp; bank details</div>
                  <div style={{ fontSize:11.5, color:'#A09890', marginTop:2 }}>Used for e-invoicing and deposit refunds</div>
                </div>
                {!editingEI && !einvoiceReq && (
                  <span onClick={startEditEI} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'#9A5B26', cursor:'pointer', flexShrink:0 }}>
                    <Icon name="pencil" size={13} color="#9A5B26"/>{einvoiceOk ? 'Request a change' : 'Complete now'}
                  </span>
                )}
              </div>

              {einvoiceReq && !editingEI && (
                <div style={{ display:'flex', gap:9, background:'#FEF8EC', border:'1px solid #f3e6c9', borderRadius:12, padding:'12px 13px', marginTop:13, fontSize:12, color:'#B7770D', lineHeight:1.45 }}>
                  <Icon name="clock" size={15} color="#B7770D" style={{ marginTop:1 }} />
                  Submitted {einvoiceReq.submittedAt} — pending admin review. {!einvoiceOk && "You'll be able to apply to markets once it's approved."}
                </div>
              )}

              {!einvoiceOk && !editingEI && !einvoiceReq && (
                <div style={{ display:'flex', gap:9, background:'#FEF8EC', border:'1px solid #f3e6c9', borderRadius:12, padding:'12px 13px', marginTop:13, fontSize:12, color:'#B7770D', lineHeight:1.45 }}>
                  <Icon name="info" size={15} color="#B7770D" style={{ marginTop:1 }} />
                  Required before you can apply to any market. Please complete every field — enter "N/A" for SST if you're not SST-registered. Submitted details go to admin for review before they take effect.
                </div>
              )}

              {editingEI ? (
                <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:12 }}>
                  {EINVOICE_FIELDS.map(([k,label,hint]) => (
                    <div key={k}>
                      <label style={lbl}>{label}</label>
                      <input value={eiForm[k]} onChange={e=>setEiForm({ ...eiForm, [k]:e.target.value })} placeholder={hint} style={inp} />
                      {hint && <div style={{ fontSize:10.5, color:'#A09890', marginTop:4 }}>{hint}</div>}
                    </div>
                  ))}
                  <div style={{ display:'flex', gap:9, marginTop:2 }}>
                    <button onClick={()=>setEditingEI(false)} style={{ flex:1, background:'#F2EDE6', color:'#1C1A17', border:'none', fontSize:13.5, fontWeight:600, borderRadius:12, padding:12, cursor:'pointer' }}>Cancel</button>
                    <button onClick={saveEI} style={{ flex:1, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:13.5, fontWeight:600, borderRadius:12, padding:12, cursor:'pointer' }}>Send request</button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop:14, display:'flex', flexDirection:'column' }}>
                  {EINVOICE_FIELDS.map(([k,label],i,arr) => (
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:14, padding:'11px 0', borderBottom:i<arr.length-1?'1px solid #f1ece4':'none' }}>
                      <span style={{ fontSize:12.5, color:'#A09890', flexShrink:0 }}>{label}</span>
                      <span style={{ fontSize:13.5, fontWeight:600, color:'#1C1A17', textAlign:'right' }}>{(me.einvoice&&me.einvoice[k]) || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display:'flex', gap:9, background:'#F2EDE6', border:'1px solid #e3d8ca', borderRadius:12, padding:'12px 13px', fontSize:12, color:'#6B6560', lineHeight:1.45 }}>
              <Icon name="info" size={15} color="#A09890" style={{ marginTop:1 }} />
              You'll be asked to complete E-Invoice &amp; bank details here once your vendor registration is approved.
            </div>
          )}
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
                    <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'#1C1A17', lineHeight:1.15 }}>{ev.name}</div>
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
                    <span style={{ background:'#F3E4CC', color:'#9A5B26', fontSize:11, fontWeight:600, borderRadius:7, padding:'4px 8px' }}>Non-F&B RM {ev.nonfnb}/day · RM {fmt(ev.nonfnb*ev.days)}</span>
                  </div>
                  <button
                    onClick={() => {
                      if (applied) { showToast('You have already applied','info'); return; }
                      if (!vendorApproved) { showToast('Your vendor registration must be approved before you can apply to markets','lock'); return; }
                      if (!einvoiceOk) { showToast('Please complete your E-Invoice & bank details in Profile before applying','lock'); return; }
                      if (!open)   { showToast('Applications closed for this market','lock'); return; }
                      set({ showApplyModal:true, applyEventId:ev.id, applyShare:null, applyPartners:[], applyPartnerSearch:'' });
                    }}
                    style={{ width:'100%', marginTop:11, border:'none', borderRadius:11, padding:11, fontSize:13, fontWeight:600, cursor: (applied||!open||!vendorApproved||!einvoiceOk)?'default':'pointer', background: applied?(st==='rejected'?'#FDEEEC':'#E8F5F0'):((!vendorApproved||!einvoiceOk)?'#F2EDE6':(open?'#9A5B26':'#F2EDE6')), color: applied?(st==='rejected'?'#B03A2E':'#2D6A4F'):((!vendorApproved||!einvoiceOk)?'#A09890':(open?'#FAF8F5':'#A09890')) }}
                  >
                    {applied ? (st==='approved'?'Approved': st==='rejected'?'Not selected':'Applied') : (!vendorApproved ? 'Awaiting registration approval' : !einvoiceOk ? 'Complete E-Invoice info to apply' : (open?'Apply to this market':'Applications closed'))}
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
                        <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'#1C1A17' }}>{ev.name}</div>
                        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#6B6560', marginTop:5 }}>
                          <Icon name="calendar" size={13} color="#A09890"/>{ev.dateRange}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11.5, color:'#9A5B26', marginTop:6 }}>
                          <Icon name={a.shared?'users':'tent'} size={12} color="#9A5B26"/>
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

      {/* ── Product Photos ── */}
      {vTab === 'photos' && (
        <div style={{ padding:'12px 16px 20px', display:'flex', flexDirection:'column', gap:13 }}>
          <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:18, padding:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:18, fontWeight:400, color:'#1C1A17' }}>Product photos</div>
              <span style={{ fontSize:12, fontWeight:600, color:'#9A5B26', background:'#F3E4CC', borderRadius:999, padding:'4px 11px' }}>{(me.productPhotos||[]).length} of 8</span>
            </div>
            <div style={{ fontSize:12.5, color:'#6B6560', lineHeight:1.5, marginTop:7 }}>These photos represent your brand across every market you apply to. When you update them here, the Sulap team automatically sees your latest set.</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:9, marginTop:14 }}>
              {(me.productPhotos||[]).map(ph => (
                <PhotoTile key={ph.id} photo={ph} size={90} onRemove={()=>{
                  const next = (me.productPhotos||[]).filter(x=>x.id!==ph.id);
                  dispatch({type:'MERGE_VENDORS', payload: vendors.map(x=>x.id===me.id?{...x,productPhotos:next}:x)});
                  logActivity(me.business, 'removed a product photo.', {icon:'image', tint:'#F3E4CC', type:'vendor'});
                  showToast('Photo removed','image');
                }}/>
              ))}
              <label style={{ width:90, height:90, borderRadius:10, border:'2px dashed #d8c6b2', background:'#FBF7F1', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, cursor:'pointer', flexShrink:0 }}>
                <input type="file" accept="image/*" multiple style={{ display:'none' }} onChange={async e => {
                  const files = [...e.target.files]; e.target.value = '';
                  const cur = me.productPhotos||[];
                  const room = 8 - cur.length;
                  if (room <= 0) { showToast('Up to 8 photos — remove one first','info'); return; }
                  if (files.length > room) showToast('Up to 8 photos — extra files were skipped','info');
                  const added = await Promise.all(files.slice(0, room).map(fileToPhoto));
                  if (!added.length) return;
                  dispatch({type:'MERGE_VENDORS', payload: vendors.map(x=>x.id===me.id?{...x,productPhotos:[...cur,...added]}:x)});
                  logActivity(me.business, `uploaded ${added.length} new product photo(s).`, {icon:'image', tint:'#F3E4CC', type:'vendor'});
                  showToast(`${added.length} photo(s) uploaded`,'check');
                }}/>
                <Icon name="upload" size={20} color="#9A5B26"/><span style={{ fontSize:10, fontWeight:600, color:'#9A5B26' }}>Add photos</span>
              </label>
            </div>
          </div>
          <div style={{ display:'flex', gap:9, background:'#FEF8EC', border:'1px solid #f3e6c9', borderRadius:12, padding:'12px 13px', fontSize:12, color:'#B7770D', lineHeight:1.45 }}>
            <Icon name="info" size={15} color="#B7770D" style={{ marginTop:1 }}/>
            Keep your photos current — the Sulap team uses your latest set for every event you join, including printed and social media materials.
          </div>
        </div>
      )}

      {/* ── Event Pictures ── */}
      {vTab === 'eventPics' && (
        <div style={{ padding:'12px 16px 20px' }}>
          {(() => {
            const myApproved = apps.filter(a => a.vendorId === CURRENT_VENDOR_ID && a.status === 'approved');
            if (!myApproved.length) return (
              <div style={{ textAlign:'center', padding:'60px 30px', color:'#A09890', display:'flex', flexDirection:'column', alignItems:'center' }}>
                <Icon name="camera" size={34} color="#bcae9c"/>
                <div style={{ fontSize:14, fontWeight:600, color:'#6B6560', marginTop:13 }}>No event pictures yet</div>
                <div style={{ fontSize:12.5, marginTop:5, lineHeight:1.5 }}>Once you're approved for a market, photos taken by the Sulap team will appear here.</div>
              </div>
            );
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
                {myApproved.map(a => {
                  const ev = events.find(e => e.id === a.eventId) || {};
                  const photos = eventPhotos[`${CURRENT_VENDOR_ID}-${ev.id}`] || [];
                  return (
                    <div key={a.id} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:18, padding:16 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'#1C1A17' }}>{ev.name}</div>
                          <div style={{ fontSize:12, color:'#6B6560', marginTop:4 }}>{ev.dateRange} · {photos.length} photo(s) from the Sulap team</div>
                        </div>
                        {photos.length > 0 && (
                          <button onClick={async ()=>{
                            showToast('Preparing your download…','download');
                            await downloadZip(
                              photos.map((ph,i)=>({ filename:`${safeName(ev.name)} - ${String(i+1).padStart(3,'0')}.${photoExt(ph)}`, photo:ph })),
                              `${safeName(ev.name)} - event photos.zip`
                            );
                            showToast('ZIP saved to your downloads','check');
                          }} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#9A5B26', border:'none', color:'#FAF8F5', fontSize:12, fontWeight:600, borderRadius:9, padding:'8px 12px', cursor:'pointer', flexShrink:0 }}>
                            <Icon name="download" size={13} color="#FAF8F5"/>Download all
                          </button>
                        )}
                      </div>
                      {photos.length > 0 ? (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:9, marginTop:13 }}>
                          {photos.map((ph,i) => (
                            <PhotoTile key={ph.id} photo={ph} size={90} onDownload={()=>downloadPhoto(ph, `${safeName(ev.name)} - ${String(i+1).padStart(3,'0')}.${photoExt(ph)}`)}/>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display:'flex', alignItems:'center', gap:8, background:'#FBF7F1', borderRadius:11, padding:'11px 13px', marginTop:12, fontSize:12.5, color:'#A09890' }}>
                          <Icon name="clock" size={14} color="#A09890"/>The Sulap team hasn't uploaded photos for this market yet.
                        </div>
                      )}
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
              <span style={{ fontSize:13, color:'#9A5B26', fontWeight:600, cursor:'pointer' }}>{d.action}</span>
            </div>
          ))}
          <div style={{ border:'2px dashed #d8c6b2', borderRadius:16, background:'#FBF7F1', padding:24, textAlign:'center', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center' }}>
            <Icon name="folder" size={26} color="#9A5B26"/>
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
                    <Icon name="receipt" size={16} color="#9A5B26"/>
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
            const notice = scanNotice(rec, calc);
            const uploadAdvice = async (field, e) => {
              const f = e.target.files[0]; e.target.value = '';
              if (!f) return;
              const doc = await fileToPhoto(f);
              showToast('Scanning your payment advice for the amount…','search');
              await scanAndRecord(doc, payKey, field, { payments, vendors, events, deposits, dispatch, showToast, logActivity, who: me.business });
            };
            return (
              <div key={a.id} style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:18, overflow:'hidden', boxShadow:'0 3px 12px rgba(120,80,40,0.05)' }}>
                <div style={{ padding:'15px 16px', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'#1C1A17' }}>{ev.name}</div>
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
                      <span style={{ fontFamily:"'Marcellus',serif", fontSize:21, fontWeight:400, color:'#1C1A17' }}>RM {money(calc.total)}</span>
                    </div>
                    {isPartial && overpaidAmt <= 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:11.5, color:'#C76A0D', fontWeight:600, marginTop:5 }}><span>Paid RM {money(rec.paid)} · Outstanding</span><span>RM {money(calc.total-rec.paid)}</span></div>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:'#FAF8F5', border:'1px solid #efe7dc', borderRadius:10, padding:'9px 11px' }}>
                      <Icon name="file" size={15} color="#9A5B26"/><span style={{ fontSize:12, color:'#6B6560' }}>{rec.invoice ? rec.invoice.name : 'Invoice not issued yet'}</span>
                    </div>
                    <button onClick={()=>rec.invoice ? set({docPreview:{payKey, field:'invoice', editable:false}}) : showToast('Your invoice will appear here once the Sulap team issues it','info')} style={{ display:'flex', alignItems:'center', gap:6, background:rec.invoice?'#9A5B26':'#F2EDE6', color:rec.invoice?'#FAF8F5':'#A09890', border:'none', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'10px 13px', cursor:'pointer' }}>
                      <Icon name="eye" size={14} color={rec.invoice?'#FAF8F5':'#A09890'}/>Invoice
                    </button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:9 }}>
                    {rec.advice ? (
                      <button onClick={()=>set({docPreview:{payKey, field:'advice', editable:true}})} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#E8F5F0', border:'1px solid #cfe9df', color:'#2D6A4F', fontSize:12.5, fontWeight:600, borderRadius:10, padding:10, cursor:'pointer' }}>
                        <Icon name="eye" size={14} color="#2D6A4F"/>Payment advice uploaded — view
                      </button>
                    ) : (
                      <label style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#FAF8F5', border:'1px solid #e3d8ca', color:'#6B6560', fontSize:12.5, fontWeight:600, borderRadius:10, padding:10, cursor:'pointer', textAlign:'center' }}>
                        <input type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={e=>uploadAdvice('advice',e)}/>
                        <Icon name="upload" size={14} color="#6B6560"/>Upload payment advice (PDF or photo) — amount is read automatically
                      </label>
                    )}
                    {(isPartial || rec.advice2) && (rec.advice2 ? (
                      <button onClick={()=>set({docPreview:{payKey, field:'advice2', editable:true}})} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#E8F5F0', border:'1px solid #cfe9df', color:'#2D6A4F', fontSize:12.5, fontWeight:600, borderRadius:10, padding:10, cursor:'pointer' }}>
                        <Icon name="eye" size={14} color="#2D6A4F"/>Second payment advice uploaded — view
                      </button>
                    ) : (
                      <label style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#FAF8F5', border:'1px solid #e3d8ca', color:'#6B6560', fontSize:12.5, fontWeight:600, borderRadius:10, padding:10, cursor:'pointer', textAlign:'center' }}>
                        <input type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={e=>uploadAdvice('advice2',e)}/>
                        <Icon name="upload" size={14} color="#6B6560"/>Upload second payment advice (remaining balance)
                      </label>
                    ))}
                    {rec.receipt && (
                      <button onClick={()=>set({docPreview:{payKey, field:'receipt', editable:false}})} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#FAF8F5', border:'1px solid #e3d8ca', color:'#9A5B26', fontSize:12.5, fontWeight:600, borderRadius:10, padding:10, cursor:'pointer' }}>
                        <Icon name="eye" size={14} color="#9A5B26"/>Official receipt from Sulap — view
                      </button>
                    )}
                    {notice && notice.kind === 'unread' && (
                      <div style={{ background:'#F7F4EF', border:'1px solid #EFEAE2', borderRadius:10, padding:'9px 12px', fontSize:11.5, color:'#8A837B', lineHeight:1.45 }}>
                        Auto-scan couldn't read an amount from your payment advice — the Sulap team will verify it manually.
                      </div>
                    )}
                    {notice && notice.kind === 'match' && (
                      <div style={{ background:'#F1F7F3', border:'1px solid #E3EFE7', borderRadius:10, padding:'9px 12px', fontSize:11.5, color:'#5F8A72', lineHeight:1.45 }}>
                        Auto-scan: your payment advice matches the total due (RM {money(notice.scanned)}).
                      </div>
                    )}
                    {notice && (notice.kind === 'short' || notice.kind === 'over') && (
                      <div style={{ background:'#FDF9EE', border:'1px solid #F3EBD5', borderRadius:10, padding:'9px 12px', fontSize:11.5, color:'#A98B3D', lineHeight:1.45 }}>
                        Auto-scan read RM {money(notice.scanned)} from your advice{notice.kind==='short' ? ` — RM ${money(notice.diff)} of the total due is still outstanding.` : ` — RM ${money(notice.diff)} more than the total due; a refund will be arranged.`}
                      </div>
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
                          <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'#1C1A17' }}>{ev.name}</div>
                          <div style={{ fontSize:12, color:'#6B6560', marginTop:4 }}>{ev.location} · {ev.dateRange}</div>
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, borderRadius:999, padding:'5px 11px', background:hasTicket?'#E8F5F0':'#FEF8EC', color:hasTicket?'#2D6A4F':'#B7770D' }}>{hasTicket?'Assigned':'Pending'}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:12, background:'#F2EDE6', borderRadius:10, padding:'8px 12px', width:'fit-content' }}>
                        <Icon name="car" size={15} color="#9A5B26"/><span style={{ fontSize:12.5, fontWeight:600, color:'#1C1A17' }}>{me.plate}</span>
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
                      <div style={{ fontFamily:"'Marcellus',serif", fontSize:19, fontWeight:400, marginTop:3 }}>Vendor Pass</div>
                    </div>
                    <Badge status={p.status} />
                  </div>
                  <div style={{ marginTop:18, fontFamily:"'Marcellus',serif", fontSize:22, fontWeight:400 }}>{me.business}</div>
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

const lbl = { display:'block', fontSize:12.5, fontWeight:600, color:'#1C1A17', marginBottom:6 };
const inp = { width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:12, padding:'13px 14px', fontSize:14.5, outline:'none', display:'block' };
