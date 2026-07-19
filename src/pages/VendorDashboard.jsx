import { useState } from 'react';
import Icon from '../components/Icon';
import Badge from '../components/Badge';
import PhotoTile from '../components/PhotoTile';
import MobileNavDrawer from '../components/MobileNavDrawer';
import PortalHeader from '../components/PortalHeader';
import PortalFooter from '../components/PortalFooter';
import DigitalPassCard from '../components/DigitalPassCard';
import ParkingPassCard from '../components/ParkingPassCard';
import { useStore } from '../lib/store';
import { money, fmt, fmtShort, fmtTime, payCalc, EINVOICE_FIELDS, einvoiceComplete, DETAILS_FIELDS, orderTabs, eventDayDate, monthDayLabel, fmtTime12, isoLocal, parseDateOnly } from '../lib/helpers';
import { EMPTY_EINVOICE, PASS_SELF_SERVICE_MAX } from '../data/mockData';
import { fileToPhoto, downloadPhoto, downloadZip, safeName, photoExt } from '../lib/photoFiles';
import { scanAndRecord, scanNotice } from '../lib/payScan';

// Gallery-upload + direct camera-capture, side by side — reused across every
// Vendor Pass photo field (initial application, extra slot, single-person edit).
function PhotoPickerPair({ size = 52, photo, onPick }) {
  return (
    <>
      <label style={{ width:size, height:size, borderRadius:size>=48?12:11, border:'2px dashed #d8c6b2', background: photo?.url ? 'transparent' : '#FBF7F1', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, overflow:'hidden' }} title="Upload from gallery">
        {photo?.url
          ? <img src={photo.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
          : <Icon name="image" size={size>=48?18:16} color="#9A5B26"/>}
        <input type="file" accept="image/*" style={{ display:'none' }} onChange={onPick}/>
      </label>
      <label style={{ width:34, height:34, borderRadius:10, border:'1px solid #e3d8ca', background:'#FBF7F1', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }} title="Take a photo">
        <Icon name="camera" size={14} color="#9A5B26"/>
        <input type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={onPick}/>
      </label>
    </>
  );
}

// Crucial for mall entry outside operating hours — reused above every pass-photo submit action.
function PassPhotoNotice() {
  return (
    <div style={{ display:'flex', gap:9, background:'#FDEEEC', border:'1px solid #f3d5d0', borderRadius:12, padding:'12px 13px', fontSize:12, color:'#B03A2E', lineHeight:1.45, marginBottom:12 }}>
      <Icon name="info" size={15} color="#B03A2E" style={{ marginTop:1 }}/>
      Only upload a photo of the actual person who'll be at the booth — no random or unrelated pictures. This pass is used to verify entry at the mall outside normal operating hours, so a mismatched photo may be turned away at the door.
    </div>
  );
}

// Parking Pass exit cutoff — fixed at 11:59PM every market day, independent
// of that event's actual operating hours (event.startTime/endTime).
const PARKING_EXIT_TIME = '23:59';

// Single source of truth for vendor portal tabs — the sidebar and the mobile
// drawer both render from this list (same pattern as ADMIN_TABS).
export const VENDOR_TABS = [
  { id:'events',   label:'Available Markets', icon:'calendar' },
  { id:'apps',     label:'My Applications',   icon:'clipboard' },
  { id:'photos',   label:'Product Photos',    icon:'image' },
  { id:'eventPics',label:'Event Pictures',    icon:'camera' },
  { id:'docs',     label:'Documents',         icon:'file' },
  { id:'payments', label:'Payments',          icon:'receipt' },
  { id:'parking',  label:'Parking',           icon:'car' },
  { id:'pass',     label:'Vendor Pass',       icon:'badge' },
  { id:'compliance', label:'Compliance',      icon:'shield' },
  { id:'profile',  label:'Profile',           icon:'users' },
];

export default function VendorDashboard() {
  const { state, set, dispatch, showToast, closeModals, logActivity } = useStore();
  const { vTab, events, vendors, apps, payments, refunds, deposits, parking, passApps, eventPhotos, offenses, offenseTypes, settings, cats, profileRequests } = state;
  // The signed-in vendor comes from the store (set by VendorLogin's real
  // email+password match) — no more hardcoded myId.
  const myId = state.currentVendorId;
  const me = vendors.find(v => v.id === myId) || {};
  const today = new Date(); today.setHours(0,0,0,0);
  const einvoiceOk = einvoiceComplete(me);
  const pendingReq = (section) => profileRequests.find(r => r.vendorId === myId && r.section === section && r.status === 'pending');
  const submitRequest = (section, changes) => {
    dispatch({ type:'MERGE_PROFILE_REQUESTS', payload: [...profileRequests, { id:`pr-${Date.now()}`, vendorId:myId, section, changes, submittedAt: fmtShort(new Date()), status:'pending' }] });
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
    dispatch({ type:'MERGE_VENDORS', payload: vendors.map(v => v.id===myId ? { ...v, ...socialForm } : v) });
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

  const logout = () => { set({ vScreen:'login', currentVendorId:null }); showToast('Signed out','leaf'); };
  const [drawerOpen, setDrawerOpen] = useState(false);
  const orderedTabs = orderTabs(VENDOR_TABS, state.vTabOrder);
  const activeTabLabel = VENDOR_TABS.find(t => t.id === vTab)?.label || 'Menu';

  // ── Vendor Pass (apply / additional-pass forms) ──
  // Each pass holder is approved/rejected/edited individually (person.status) — there is
  // no single whole-application status. See PROJECT_NOTES.md rule 21. A vendor can
  // self-service fill slots up to PASS_SELF_SERVICE_MAX with no admin action needed —
  // going beyond that is admin-initiated only (admin grants extra slots directly, no
  // vendor-side "request more passes" flow to wait on).
  const [passForms, setPassForms] = useState({});   // eventId -> [{name,photo}] draft for the first-time application (up to PASS_SELF_SERVICE_MAX people)
  const [extraForms, setExtraForms] = useState({}); // passAppId -> {name,photo} draft for an already-unlocked extra slot
  const [editingPersonId, setEditingPersonId] = useState(null); // pass-holder id currently being edited (to swap name/photo & resubmit)
  const [personEditForm, setPersonEditForm] = useState(null);   // {name, photo} draft for editingPersonId
  const getInitialForm = (eventId) => passForms[eventId] || [{ name:'', photo:null }, { name:'', photo:null }];
  const updateInitialForm = (eventId, idx, patch) => {
    const form = getInitialForm(eventId).map((p,i) => i===idx ? { ...p, ...patch } : p);
    setPassForms(f => ({ ...f, [eventId]: form }));
  };
  const addInitialFormRow = (eventId) => {
    const form = getInitialForm(eventId);
    if (form.length >= PASS_SELF_SERVICE_MAX) return;
    setPassForms(f => ({ ...f, [eventId]: [...form, { name:'', photo:null }] }));
  };
  const submitInitialApp = (eventId, ev) => {
    const filled = getInitialForm(eventId).filter(p => p.name.trim() && p.photo);
    if (!filled.length) { showToast('Add at least one pass holder — name + photo required', 'info'); return; }
    const people = filled.map((p,i) => ({ id:`vp${Date.now()}p${i}`, name:p.name.trim(), photo:p.photo, status:'pending', rejectReason:null, decidedAt:null }));
    const rec = { id:'vp'+Date.now(), vendorId:myId, eventId, extraApproved:0, boothNumber:'', people, submittedAt: fmtShort(new Date()) };
    dispatch({ type:'MERGE_PASS_APPS', payload:[...passApps, rec] });
    setPassForms(f => ({ ...f, [eventId]: undefined }));
    logActivity(me.business, `applied for a Vendor Pass — ${ev.name}.`, { icon:'badge', tint:'#F3E4CC', type:'vendor' });
    showToast('Vendor Pass application submitted', 'badge');
  };
  const submitExtraSlot = (passApp, ev) => {
    const draft = extraForms[passApp.id] || { name:'', photo:null };
    if (!draft.name.trim() || !draft.photo) { showToast('Name + photo required', 'info'); return; }
    const person = { id:`vp${Date.now()}p${passApp.people.length}`, name:draft.name.trim(), photo:draft.photo, status:'pending', rejectReason:null, decidedAt:null };
    dispatch({ type:'MERGE_PASS_APPS', payload: passApps.map(p => p.id===passApp.id ? { ...p, people:[...p.people, person] } : p) });
    setExtraForms(f => ({ ...f, [passApp.id]: undefined }));
    logActivity(me.business, `added an additional Vendor Pass holder — ${ev.name}.`, { icon:'badge', tint:'#F3E4CC', type:'vendor' });
    showToast('Pass added — awaiting admin review', 'badge');
  };
  // Editing one pass holder (whether currently approved or rejected) — resets just that
  // person back to 'pending' for re-review, without touching any of the vendor's other
  // pass holders or their approval status.
  const startEditPerson = (person) => { setEditingPersonId(person.id); setPersonEditForm({ name:person.name, photo:person.photo }); };
  const cancelEditPerson = () => { setEditingPersonId(null); setPersonEditForm(null); };
  const submitPersonEdit = (passApp, person, ev) => {
    if (!personEditForm.name.trim() || !personEditForm.photo) { showToast('Name + photo required', 'info'); return; }
    dispatch({ type:'MERGE_PASS_APPS', payload: passApps.map(p => p.id===passApp.id ? { ...p, people: p.people.map(pp => pp.id===person.id ? { ...pp, name:personEditForm.name.trim(), photo:personEditForm.photo, status:'pending', rejectReason:null, decidedAt:null } : pp) } : p) });
    cancelEditPerson();
    logActivity(me.business, `updated a Vendor Pass holder's details — ${ev.name}.`, { icon:'badge', tint:'#F3E4CC', type:'vendor' });
    showToast('Updated — resubmitted for admin review', 'badge');
  };
  // Testing helper — clears this vendor's Vendor Pass application for an event so the
  // whole apply → admin approve → digital pass flow can be walked through again from
  // scratch. Not a real business action; for trying out the flow only.
  const resetMyPassForTesting = (eventId, ev) => {
    if (!window.confirm(`Reset your Vendor Pass for ${ev.name}? This clears your application so you can apply again from scratch (testing only).`)) return;
    dispatch({ type:'MERGE_PASS_APPS', payload: passApps.filter(p => !(p.vendorId === myId && p.eventId === eventId)) });
    setPassForms(f => ({ ...f, [eventId]: undefined }));
    cancelEditPerson();
    showToast('Vendor Pass reset — try the flow again', 'badge');
  };

  return (
    <div>
      <PortalHeader title={activeTabLabel} />

      {/* Mobile nav trigger — opens the tab drawer instead of a wrapping pill row */}
      <button className="vendor-tabs-bar" onClick={() => setDrawerOpen(true)} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'13px 16px', background:'var(--bg-card)', border:'none', borderBottom:'1px solid var(--border-faint)', cursor:'pointer', textAlign:'left' }}>
        <Icon name="menu" size={18} color="#9A5B26" />
        <span style={{ fontFamily:"'Karla'", fontSize:14, fontWeight:700, color:'var(--text-primary)', flex:1 }}>{activeTabLabel}</span>
        <Icon name="arrowLeft" size={15} color="var(--text-muted)" style={{ transform:'rotate(180deg)' }} />
      </button>
      <MobileNavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="My Portal"
        subtitle={me.business}
        tabs={orderedTabs}
        activeId={vTab}
        onSelect={id => { closeModals(); set({ vTab:id, page:1 }); }}
        onLogout={logout}
      />

      {/* Keyed per tab so switching remounts the wrapper and replays the tabIn animation */}
      <div key={vTab} className="tab-panel">

      {/* ── Compliance ── */}
      {vTab === 'compliance' && (
        <div style={{ padding:'6px 16px 20px', display:'flex', flexDirection:'column', gap:13 }}>
          {(() => {
            const myOff = offenses.filter(o => o.vendorId === myId);
            const skipN = settings.skipMarkets ?? 1;
            if (!myOff.length) return (
              <div style={{ textAlign:'center', padding:'60px 30px', color:'var(--text-muted)', display:'flex', flexDirection:'column', alignItems:'center' }}>
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
                    <div key={g.eventId} className="dc-row-hover" style={{ background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:16, padding:14 }}>
                      <div style={{ fontFamily:"'Marcellus',serif", fontSize:15.5, fontWeight:400, color:'var(--text-primary)' }}>{g.ev.name||'Unknown market'}</div>
                      {g.ev.dateRange && <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:2 }}>{g.ev.dateRange}</div>}
                      <div style={{ display:'flex', flexDirection:'column', gap:11, marginTop:12 }}>
                        {g.offs.map((o,oi) => {
                          const ot = offenseTypes[o.type]||{};
                          const oPhotos = o.photos||[];
                          return (
                            <div key={o.id} style={oi>0 ? { paddingTop:11, borderTop:'1px solid var(--glass-divider)' } : undefined}>
                              <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11.5, fontWeight:600, borderRadius:999, padding:'5px 11px', background:ot.bg, color:ot.color }}><span style={{ width:6, height:6, borderRadius:'50%', background:ot.color }}/>{ot.label||'Offence'}</span>
                              {oPhotos.length > 0 ? (
                                <>
                                  <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', marginTop:10 }}>Photos from the Sulap team ({oPhotos.length})</div>
                                  <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:7 }}>
                                    {oPhotos.map((ph,i) => (
                                      <PhotoTile key={ph.id} photo={ph} size={72} onDownload={()=>downloadPhoto(ph, `${safeName(g.ev.name||'offence')} - evidence - ${String(i+1).padStart(2,'0')}.${photoExt(ph)}`)}/>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:9 }}>No photos attached to this record.</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:11.5, color:'var(--text-muted)', lineHeight:1.5 }}>If you believe a record was logged in error, contact the Sulap team with your booth details.</div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── Profile ── */}
      {vTab === 'profile' && (
        <div style={{ padding:'6px 16px 20px', display:'flex', flexDirection:'column', gap:13 }}>
          {/* Vendor details — locked, request-based */}
          <div style={{ background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:18, padding:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:18, fontWeight:400, color:'var(--text-primary)' }}>Vendor details</div>
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
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>Your changes are sent to Sulap Artisan for review — they won't appear here until admin approves.</div>
                <div style={{ display:'flex', gap:9, marginTop:2 }}>
                  <button onClick={()=>setEditingDetails(false)} style={{ flex:1, background:'#F2EDE6', color:'var(--text-primary)', border:'none', fontSize:13.5, fontWeight:600, borderRadius:12, padding:12, cursor:'pointer' }}>Cancel</button>
                  <button onClick={sendDetailsRequest} style={{ flex:1, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:13.5, fontWeight:600, borderRadius:12, padding:12, cursor:'pointer' }}>Send request</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop:14, display:'flex', flexDirection:'column' }}>
                {DETAILS_FIELDS.map(([k,label],i,arr) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:14, padding:'11px 0', borderBottom:i<arr.length-1?'1px solid var(--glass-divider)':'none' }}>
                    <span style={{ fontSize:12.5, color:'var(--text-muted)', flexShrink:0 }}>{label}</span>
                    <span style={{ fontSize:13.5, fontWeight:600, color:'var(--text-primary)', textAlign:'right' }}>{me[k] || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Social media & power supply — directly vendor-editable */}
          <div style={{ background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:18, padding:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:18, fontWeight:400, color:'var(--text-primary)' }}>Social media &amp; power supply</div>
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
                  <button onClick={()=>setEditingSocial(false)} style={{ flex:1, background:'#F2EDE6', color:'var(--text-primary)', border:'none', fontSize:13.5, fontWeight:600, borderRadius:12, padding:12, cursor:'pointer' }}>Cancel</button>
                  <button onClick={saveSocial} style={{ flex:1, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:13.5, fontWeight:600, borderRadius:12, padding:12, cursor:'pointer' }}>Save</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop:14, display:'flex', flexDirection:'column' }}>
                {[['Instagram',me.ig],['Facebook',me.fb],['TikTok',me.tiktok],['Power supply needs',me.power]].map(([k,v],i,arr) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:14, padding:'11px 0', borderBottom:i<arr.length-1?'1px solid var(--glass-divider)':'none' }}>
                    <span style={{ fontSize:12.5, color:'var(--text-muted)', flexShrink:0 }}>{k}</span>
                    <span style={{ fontSize:13.5, fontWeight:600, color: k==='Power supply needs'?'var(--text-primary)':'#9A5B26', textAlign:'right' }}>{v || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* E-Invoice & bank details — locked, request-based, required (once approved) before applying to markets */}
          {me.status === 'approved' ? (
            <div style={{ background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:18, padding:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontFamily:"'Marcellus',serif", fontSize:18, fontWeight:400, color:'var(--text-primary)' }}>E-Invoice &amp; bank details</div>
                  <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:2 }}>Used for e-invoicing and deposit refunds</div>
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
                      {hint && <div style={{ fontSize:10.5, color:'var(--text-muted)', marginTop:4 }}>{hint}</div>}
                    </div>
                  ))}
                  <div style={{ display:'flex', gap:9, marginTop:2 }}>
                    <button onClick={()=>setEditingEI(false)} style={{ flex:1, background:'#F2EDE6', color:'var(--text-primary)', border:'none', fontSize:13.5, fontWeight:600, borderRadius:12, padding:12, cursor:'pointer' }}>Cancel</button>
                    <button onClick={saveEI} style={{ flex:1, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:13.5, fontWeight:600, borderRadius:12, padding:12, cursor:'pointer' }}>Send request</button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop:14, display:'flex', flexDirection:'column' }}>
                  {EINVOICE_FIELDS.map(([k,label],i,arr) => (
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:14, padding:'11px 0', borderBottom:i<arr.length-1?'1px solid var(--glass-divider)':'none' }}>
                      <span style={{ fontSize:12.5, color:'var(--text-muted)', flexShrink:0 }}>{label}</span>
                      <span style={{ fontSize:13.5, fontWeight:600, color:'var(--text-primary)', textAlign:'right' }}>{(me.einvoice&&me.einvoice[k]) || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display:'flex', gap:9, background:'#F2EDE6', border:'1px solid #e3d8ca', borderRadius:12, padding:'12px 13px', fontSize:12, color:'var(--text-secondary)', lineHeight:1.45 }}>
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
            const myApp = apps.find(a => a.vendorId === myId && a.eventId === ev.id);
            const open = !ev.lastApp || new Date(ev.lastApp) >= today;
            const applied = !!myApp;
            const st = myApp?.status;
            const vendorApproved = me.status === 'approved';
            return (
              <div key={ev.id} className="dc-row-hover" style={{ background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:18, overflow:'hidden', boxShadow:'0 3px 12px rgba(120,80,40,0.05)' }}>
                <div style={{ display:'flex', gap:13, padding:13 }}>
                  <div style={{ width:110, height:66, borderRadius:12, background:ev.img, flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'var(--text-primary)', lineHeight:1.15 }}>{ev.name}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text-secondary)', marginTop:5 }}>
                      <Icon name="calendar" size={13} color="#A09890"/>{ev.dateRange}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:9, fontSize:12, color:'var(--text-secondary)', marginTop:3 }}>
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
                    style={{ width:'100%', marginTop:11, border:'none', borderRadius:11, padding:11, fontSize:13, fontWeight:600, cursor: (applied||!open||!vendorApproved||!einvoiceOk)?'default':'pointer', background: applied?(st==='rejected'?'#FDEEEC':'#E8F5F0'):((!vendorApproved||!einvoiceOk)?'#F2EDE6':(open?'#9A5B26':'#F2EDE6')), color: applied?(st==='rejected'?'#B03A2E':'#2D6A4F'):((!vendorApproved||!einvoiceOk)?'var(--text-muted)':(open?'#FAF8F5':'var(--text-muted)')) }}
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
            const myApps = apps.filter(a => a.vendorId === myId);
            if (!myApps.length) return (
              <div style={{ textAlign:'center', padding:'60px 30px', color:'var(--text-muted)', display:'flex', flexDirection:'column', alignItems:'center' }}>
                <Icon name="folder" size={34} color="#bcae9c" />
                <div style={{ fontSize:14, fontWeight:600, color:'var(--text-secondary)', marginTop:13 }}>No applications yet</div>
                <div style={{ fontSize:12.5, marginTop:5, lineHeight:1.5 }}>Head to Available markets and apply to your first event.</div>
              </div>
            );
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
                {myApps.map(a => {
                  const ev = events.find(e => e.id === a.eventId) || {};
                  const partnerNames = (a.partners||[]).map(pid => (vendors.find(v=>v.id===pid)?.business||'Unknown'));
                  return (
                    <div key={a.id} className="dc-row-hover" style={{ background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:16, padding:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'var(--text-primary)' }}>{ev.name}</div>
                        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text-secondary)', marginTop:5 }}>
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
          <div style={{ background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:18, padding:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontFamily:"'Marcellus',serif", fontSize:18, fontWeight:400, color:'var(--text-primary)' }}>Product photos</div>
              <span style={{ fontSize:12, fontWeight:600, color:'#9A5B26', background:'#F3E4CC', borderRadius:999, padding:'4px 11px' }}>{(me.productPhotos||[]).length} of 8</span>
            </div>
            <div style={{ fontSize:12.5, color:'var(--text-secondary)', lineHeight:1.5, marginTop:7 }}>These photos represent your brand across every market you apply to. When you update them here, the Sulap team automatically sees your latest set.</div>
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
            const myApproved = apps.filter(a => a.vendorId === myId && a.status === 'approved');
            if (!myApproved.length) return (
              <div style={{ textAlign:'center', padding:'60px 30px', color:'var(--text-muted)', display:'flex', flexDirection:'column', alignItems:'center' }}>
                <Icon name="camera" size={34} color="#bcae9c"/>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--text-secondary)', marginTop:13 }}>No event pictures yet</div>
                <div style={{ fontSize:12.5, marginTop:5, lineHeight:1.5 }}>Once you're approved for a market, photos taken by the Sulap team will appear here.</div>
              </div>
            );
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
                {myApproved.map(a => {
                  const ev = events.find(e => e.id === a.eventId) || {};
                  const photos = eventPhotos[`${myId}-${ev.id}`] || [];
                  return (
                    <div key={a.id} className="dc-row-hover" style={{ background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:18, padding:16 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'var(--text-primary)' }}>{ev.name}</div>
                          <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>{ev.dateRange} · {photos.length} photo(s) from the Sulap team</div>
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
                        <div style={{ display:'flex', alignItems:'center', gap:8, background:'#FBF7F1', borderRadius:11, padding:'11px 13px', marginTop:12, fontSize:12.5, color:'var(--text-muted)' }}>
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
      {/* Real uploads (2026-07-19) — used to be hardcoded placeholder rows with
          dead "Replace"/"Upload" labels. Files live on the vendor record
          (`me.docs`: { ssm, halal, extra[] }) as data URLs, same mechanism as
          product photos; admin sees them via the vendor record too. */}
      {vTab === 'docs' && (() => {
        const docs = me.docs || { ssm:null, halal:null, extra:[] };
        const setDocs = (patch) => dispatch({ type:'MERGE_VENDORS', payload: vendors.map(v => v.id===myId ? { ...v, docs:{ ...docs, ...patch } } : v) });
        const MAX_DOC_MB = 10;
        const pickDoc = (label, onFile) => async (e) => {
          const f = e.target.files[0]; e.target.value = '';
          if (!f) return;
          if (f.size > MAX_DOC_MB * 1024 * 1024) { showToast(`File is over ${MAX_DOC_MB}MB — please upload a smaller copy`, 'info'); return; }
          const doc = await fileToPhoto(f);
          onFile(doc);
          logActivity(me.business, `uploaded a document — ${label}.`, { icon:'file', tint:'#E8F5F0', type:'vendor' });
          showToast(`${label} uploaded`, 'file');
        };
        const docRow = ({ key, icon, title, optional, file, onSet, onRemove }) => (
          <div key={key} className="dc-row-hover" style={{ background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:16, padding:15, display:'flex', alignItems:'center', gap:13, flexWrap:'wrap' }}>
            <div style={{ width:42, height:42, borderRadius:11, background: file ? '#E8F5F0' : '#FEF8EC', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Icon name={icon} size={20} color={file ? '#2D6A4F' : '#B7770D'}/>
            </div>
            <div style={{ flex:1, minWidth:140 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>{title}</div>
              <div style={{ fontSize:12, color: file ? '#2D6A4F' : '#B7770D', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:220 }}>
                {file ? `Uploaded · ${file.name}` : `${optional ? 'Optional' : 'Required'} · not uploaded`}
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
              {file && <span onClick={()=>downloadPhoto(file, file.name)} style={{ fontSize:13, color:'#9A5B26', fontWeight:600, cursor:'pointer' }}>Download</span>}
              <label style={{ fontSize:13, color:'#9A5B26', fontWeight:600, cursor:'pointer' }}>
                {file ? 'Replace' : 'Upload'}
                <input type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={pickDoc(title, onSet)}/>
              </label>
              {file && onRemove && <span onClick={onRemove} style={{ fontSize:13, color:'#B03A2E', fontWeight:600, cursor:'pointer' }}>Remove</span>}
            </div>
          </div>
        );
        return (
          <div style={{ padding:'12px 16px 20px', display:'flex', flexDirection:'column', gap:11 }}>
            {docRow({ key:'ssm', icon:'file', title:'SSM Registration', optional:false, file:docs.ssm, onSet:(doc)=>setDocs({ ssm:doc }) })}
            {docRow({ key:'halal', icon:'badge', title:'Halal / Food Cert', optional:true, file:docs.halal, onSet:(doc)=>setDocs({ halal:doc }), onRemove:()=>{ setDocs({ halal:null }); showToast('Document removed','x'); } })}
            {(docs.extra||[]).map((d,i) => docRow({
              key:d.id, icon:'folder', title:d.name || `Document ${i+1}`, optional:true, file:d,
              onSet:(doc)=>setDocs({ extra: docs.extra.map(x=>x.id===d.id?doc:x) }),
              onRemove:()=>{ setDocs({ extra: docs.extra.filter(x=>x.id!==d.id) }); showToast('Document removed','x'); },
            }))}
            <label style={{ border:'2px dashed #d8c6b2', borderRadius:16, background:'#FBF7F1', padding:24, textAlign:'center', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center' }}>
              <input type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={pickDoc('Additional document', (doc)=>setDocs({ extra:[...(docs.extra||[]), doc] }))}/>
              <Icon name="folder" size={26} color="#9A5B26"/>
              <div style={{ fontSize:13.5, fontWeight:600, color:'var(--text-primary)', marginTop:9 }}>Add another document</div>
              <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:3 }}>PDF, JPG or PNG up to 10MB</div>
            </label>
          </div>
        );
      })()}

      {/* ── Payments ── */}
      {vTab === 'payments' && (
        <div style={{ padding:'6px 16px 20px', display:'flex', flexDirection:'column', gap:13 }}>
          {/* Deposit card */}
          {(() => {
            const dep = depRec(myId);
            return (
              <div style={{ background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:16, padding:'14px 15px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <Icon name="receipt" size={16} color="#9A5B26"/>
                    <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>Security deposit</span>
                  </div>
                  <Badge status={dep.status} />
                </div>
                <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.45, marginTop:8 }}>A refundable RM100 deposit is required once per vendor. It will be returned after your first market.</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 16px', marginTop:9, fontSize:11.5, color:'var(--text-muted)' }}>
                  <span>Invoice <b style={{ color:'var(--text-secondary)' }}>{dep.inv||'—'}</b></span>
                  <span>Paid <b style={{ color:'var(--text-secondary)' }}>{dep.payDate||'—'}</b></span>
                  <span>Refunded <b style={{ color:'var(--text-secondary)' }}>{dep.refundDate||'—'}</b></span>
                </div>
              </div>
            );
          })()}
          {/* Event payments */}
          {apps.filter(a => a.vendorId === myId && a.status === 'approved').map(a => {
            const ev = events.find(e => e.id === a.eventId) || {};
            const dep = depRec(myId);
            const calc = payCalc(me, ev, dep.status, a.tier);
            const payKey = `${myId}-${ev.id}`;
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
              await scanAndRecord(doc, payKey, field, { payments, vendors, events, deposits, apps, dispatch, showToast, logActivity, who: me.business });
            };
            return (
              <div key={a.id} className="dc-row-hover" style={{ background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:18, overflow:'hidden', boxShadow:'0 3px 12px rgba(120,80,40,0.05)' }}>
                <div style={{ padding:'15px 16px', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'var(--text-primary)' }}>{ev.name}</div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>{ev.dateRange}</div>
                  </div>
                  <Badge status={rec.status} />
                </div>
                <div style={{ padding:'0 16px 14px' }}>
                  <div style={{ background:'#FBF7F1', borderRadius:12, padding:'11px 13px', marginBottom:11 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-secondary)' }}><span>{calc.tier} · RM {calc.rate}/day × {calc.days} days</span><span>RM {money(calc.base)}</span></div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-secondary)', marginTop:5 }}><span>SST (6%)</span><span>RM {money(calc.sst)}</span></div>
                    {calc.needsDeposit && <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-secondary)', marginTop:5 }}><span>Security deposit (one-time)</span><span>RM 100.00</span></div>}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:8, paddingTop:8, borderTop:'1px solid var(--glass-divider)' }}>
                      <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>Total due</span>
                      <span style={{ fontFamily:"'Marcellus',serif", fontSize:21, fontWeight:400, color:'var(--text-primary)' }}>RM {money(calc.total)}</span>
                    </div>
                    {isPartial && overpaidAmt <= 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:11.5, color:'#C76A0D', fontWeight:600, marginTop:5 }}><span>Paid RM {money(rec.paid)} · Outstanding</span><span>RM {money(calc.total-rec.paid)}</span></div>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:'var(--glass-input)', border:'1px solid var(--glass-chip-border)', borderRadius:10, padding:'9px 11px' }}>
                      <Icon name="file" size={15} color="#9A5B26"/><span style={{ fontSize:12, color:'var(--text-secondary)' }}>{rec.invoice ? rec.invoice.name : 'Invoice not issued yet'}</span>
                    </div>
                    <button onClick={()=>rec.invoice ? set({docPreview:{payKey, field:'invoice', editable:false}}) : showToast('Your invoice will appear here once the Sulap team issues it','info')} style={{ display:'flex', alignItems:'center', gap:6, background:rec.invoice?'#9A5B26':'#F2EDE6', color:rec.invoice?'#FAF8F5':'var(--text-muted)', border:'none', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'10px 13px', cursor:'pointer' }}>
                      <Icon name="eye" size={14} color={rec.invoice?'#FAF8F5':'var(--text-muted)'}/>Invoice
                    </button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:9 }}>
                    {rec.advice ? (
                      <button onClick={()=>set({docPreview:{payKey, field:'advice', editable:true}})} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#E8F5F0', border:'1px solid #cfe9df', color:'#2D6A4F', fontSize:12.5, fontWeight:600, borderRadius:10, padding:10, cursor:'pointer' }}>
                        <Icon name="eye" size={14} color="#2D6A4F"/>Payment advice uploaded — view
                      </button>
                    ) : (
                      <label style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#FAF8F5', border:'1px solid #e3d8ca', color:'var(--text-secondary)', fontSize:12.5, fontWeight:600, borderRadius:10, padding:10, cursor:'pointer', textAlign:'center' }}>
                        <input type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={e=>uploadAdvice('advice',e)}/>
                        <Icon name="upload" size={14} color="#6B6560"/>Upload payment advice (PDF or photo) — amount is read automatically
                      </label>
                    )}
                    {(isPartial || rec.advice2) && (rec.advice2 ? (
                      <button onClick={()=>set({docPreview:{payKey, field:'advice2', editable:true}})} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#E8F5F0', border:'1px solid #cfe9df', color:'#2D6A4F', fontSize:12.5, fontWeight:600, borderRadius:10, padding:10, cursor:'pointer' }}>
                        <Icon name="eye" size={14} color="#2D6A4F"/>Second payment advice uploaded — view
                      </button>
                    ) : (
                      <label style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#FAF8F5', border:'1px solid #e3d8ca', color:'var(--text-secondary)', fontSize:12.5, fontWeight:600, borderRadius:10, padding:10, cursor:'pointer', textAlign:'center' }}>
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
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:9 }}>Refund closed · Ref {ref.refCode} · {ref.date} {fmtTime(ref.time)}</div>
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
            const myParkApps = apps.filter(a => a.vendorId === myId && a.status === 'approved');
            if (!myParkApps.length) return (
              <div style={{ textAlign:'center', padding:'60px 30px', color:'var(--text-muted)', display:'flex', flexDirection:'column', alignItems:'center' }}>
                <Icon name="car" size={34} color="#bcae9c"/>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--text-secondary)', marginTop:13 }}>No parking assigned yet</div>
                <div style={{ fontSize:12.5, marginTop:5, lineHeight:1.5 }}>Parking serials appear here on market day, once the Sulap team allocates them at vendor check-in.</div>
              </div>
            );
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
                {myParkApps.map(a => {
                  const ev = events.find(e => e.id === a.eventId) || {};
                  const dayInfo = Array.from({length:ev.days||1},(_,i)=>{
                    const dayIndex = i+1;
                    const dDate = eventDayDate(ev.startDate, dayIndex);
                    const dayStatus = dDate.getTime() < today.getTime() ? 'expired' : dDate.getTime() > today.getTime() ? 'locked' : 'active';
                    return { dayIndex, dDate, dayStatus, serial: parking[`${myId}-${ev.id}-${dayIndex}`] || '' };
                  });
                  const hasTicket = dayInfo.some(d => d.serial);
                  // Today's pass leads the row; the rest keep their day order behind it.
                  const orderedDayInfo = [...dayInfo].sort((a,b) => (a.dayStatus==='active'?0:1) - (b.dayStatus==='active'?0:1));
                  return (
                    <div key={a.id} className="dc-row-hover" style={{ background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:18, padding:16 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'var(--text-primary)' }}>{ev.name}</div>
                          <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>{ev.location} · {ev.dateRange}</div>
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, borderRadius:999, padding:'5px 11px', background:hasTicket?'#E8F5F0':'#FEF8EC', color:hasTicket?'#2D6A4F':'#B7770D' }}>{hasTicket?'Assigned':'Pending'}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:12, background:'#F2EDE6', borderRadius:10, padding:'8px 12px', width:'fit-content' }}>
                        <Icon name="car" size={15} color="#9A5B26"/><span style={{ fontSize:12.5, fontWeight:600, color:'var(--text-primary)' }}>{me.plate}</span>
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:16, marginTop:14, justifyContent:'center' }}>
                        {orderedDayInfo.map(d => (
                          <div key={d.dayIndex} style={{ flex:'1 1 300px', maxWidth:360 }}>
                            <ParkingPassCard
                              vendorName={me.business}
                              plateNumber={me.plate}
                              marketName={ev.name}
                              dateFromLabel={monthDayLabel(parseDateOnly(ev.startDate))}
                              dateToLabel={monthDayLabel(parseDateOnly(ev.endDate))}
                              validDateLabel={monthDayLabel(d.dDate)}
                              validYear={String(d.dDate.getFullYear())}
                              dayNumber={d.dayIndex}
                              untilTimeLabel={fmtTime12(PARKING_EXIT_TIME)}
                              validUntilISO={isoLocal(d.dDate, PARKING_EXIT_TIME)}
                              serial={d.serial}
                              dayStatus={d.dayStatus}
                            />
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
        <div style={{ padding:'6px 16px 20px', display:'flex', flexDirection:'column', gap:16 }}>
          {(() => {
            const chain = apps.filter(a => a.vendorId === myId && a.status === 'approved')
              .map(a => ({ a, ev: events.find(e => e.id === a.eventId) }))
              .filter(x => x.ev)
              .sort((x,y) => new Date(x.ev.startDate) - new Date(y.ev.startDate));
            if (!chain.length) return (
              <div style={{ textAlign:'center', padding:'60px 30px', color:'var(--text-muted)', display:'flex', flexDirection:'column', alignItems:'center' }}>
                <Icon name="badge" size={34} color="#bcae9c"/>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--text-secondary)', marginTop:13 }}>No Vendor Pass to apply for yet</div>
                <div style={{ fontSize:12.5, marginTop:5, lineHeight:1.5 }}>Once you're approved for a market, you can apply for your Vendor Pass here.</div>
              </div>
            );
            const today = new Date(); today.setHours(0,0,0,0);
            let anyApproved = false;
            const cards = chain.map((item, idx) => {
              const { ev } = item;
              const passApp = passApps.find(p => p.vendorId === myId && p.eventId === ev.id);
              const prevEnded = idx === 0 || new Date(chain[idx-1].ev.endDate) < today;
              const canStart = !!passApp || prevEnded;
              const showInitialForm = !passApp && canStart;
              const maxSlots = PASS_SELF_SERVICE_MAX + (passApp?.extraApproved || 0);
              if (passApp?.people.some(p => p.status === 'approved')) anyApproved = true;

              return (
                <div key={ev.id} className="dc-row-hover" style={{ background:'var(--glass-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:'1px solid var(--glass-card-border)', borderRadius:18, padding:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"'Marcellus',serif", fontSize:16, fontWeight:400, color:'var(--text-primary)' }}>{ev.name}</div>
                      <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>{ev.dateRange}</div>
                    </div>
                  </div>

                  {!passApp && !canStart && (
                    <div style={{ display:'flex', gap:9, background:'#F2EDE6', borderRadius:12, padding:'12px 13px', fontSize:12.5, color:'var(--text-secondary)', lineHeight:1.5, marginTop:13 }}>
                      <Icon name="lock" size={15} color="#A09890" style={{ marginTop:1 }}/>
                      You can apply for a Vendor Pass here once {chain[idx-1].ev.name} ({chain[idx-1].ev.dateRange}) has passed.
                    </div>
                  )}

                  {showInitialForm && (
                    <div style={{ marginTop:14 }}>
                      <div style={{ fontSize:12.5, color:'var(--text-secondary)', lineHeight:1.5, marginBottom:12 }}>Apply for your Vendor Pass — add up to {PASS_SELF_SERVICE_MAX} people (name + photo each).</div>
                      <PassPhotoNotice/>
                      {getInitialForm(ev.id).map((p, i) => (
                        <div key={i} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:11 }}>
                          <PhotoPickerPair size={52} photo={p.photo} onPick={async e => {
                            const file = e.target.files?.[0]; e.target.value='';
                            if (!file) return;
                            const photo = await fileToPhoto(file);
                            updateInitialForm(ev.id, i, { photo });
                          }}/>
                          <input value={p.name} onChange={e=>updateInitialForm(ev.id, i, { name:e.target.value })} placeholder={`Person ${i+1} full name`} style={{ ...inp, flex:1 }}/>
                        </div>
                      ))}
                      {getInitialForm(ev.id).length < PASS_SELF_SERVICE_MAX && (
                        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12.5, fontWeight:600, color:'#9A5B26', cursor:'pointer', marginBottom:12 }} onClick={()=>addInitialFormRow(ev.id)}>
                          <Icon name="plus" size={13} color="#9A5B26"/>Add another pass holder
                        </div>
                      )}
                      <button onClick={()=>submitInitialApp(ev.id, ev)} className="cta" style={{ width:'100%', background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:14, fontWeight:600, borderRadius:12, padding:13, cursor:'pointer', marginTop:4 }}>Submit Vendor Pass application</button>
                    </div>
                  )}

                  {passApp && (
                    <>
                      <div style={{ display:'flex', flexDirection:'column', gap:11, marginTop:14 }}>
                        {passApp.people.map(p => {
                          const isEditing = editingPersonId === p.id;
                          if (isEditing) return (
                            <div key={p.id} style={{ background:'#F7F3EC', borderRadius:14, padding:14 }}>
                              <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text-primary)', marginBottom:9 }}>Edit pass holder</div>
                              <PassPhotoNotice/>
                              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:11 }}>
                                <PhotoPickerPair size={52} photo={personEditForm?.photo} onPick={async e => {
                                  const file = e.target.files?.[0]; e.target.value='';
                                  if (!file) return;
                                  const photo = await fileToPhoto(file);
                                  setPersonEditForm(f => ({ ...f, photo }));
                                }}/>
                                <input value={personEditForm?.name||''} onChange={e=>setPersonEditForm(f=>({ ...f, name:e.target.value }))} placeholder="Full name" style={{ ...inp, flex:1 }}/>
                              </div>
                              <div style={{ display:'flex', gap:9 }}>
                                <button onClick={cancelEditPerson} style={{ flex:1, background:'#F2EDE6', color:'var(--text-primary)', border:'none', fontSize:13, fontWeight:600, borderRadius:11, padding:11, cursor:'pointer' }}>Cancel</button>
                                <button onClick={()=>submitPersonEdit(passApp, p, ev)} className="cta" style={{ flex:2, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:13.5, fontWeight:600, borderRadius:11, padding:11, cursor:'pointer' }}>Save &amp; resubmit for review</button>
                              </div>
                            </div>
                          );
                          if (p.status === 'pending') return (
                            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:9, background:'#FEF8EC', border:'1px solid #f3e6c9', borderRadius:12, padding:'10px 12px' }}>
                              <PhotoTile photo={p.photo} size={40}/>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{p.name}</div>
                                <div style={{ fontSize:11.5, color:'#B7770D', marginTop:2 }}>Awaiting admin review</div>
                              </div>
                            </div>
                          );
                          if (p.status === 'rejected') return (
                            <div key={p.id} style={{ background:'#FDEEEC', border:'1px solid #f3d5d0', borderRadius:12, padding:'10px 12px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                                <PhotoTile photo={p.photo} size={40}/>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{p.name}</div>
                                  <div style={{ fontSize:11.5, color:'#B03A2E', marginTop:2 }}>Not approved{p.rejectReason ? ` — ${p.rejectReason}` : ''}</div>
                                </div>
                              </div>
                              <button onClick={()=>startEditPerson(p)} style={{ marginTop:9, width:'100%', background:'#fff', border:'1px solid #f3d5d0', color:'#B03A2E', fontSize:12.5, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>Update photo &amp; resubmit</button>
                            </div>
                          );
                          return (
                            <div key={p.id}>
                              <DigitalPassCard personName={p.name} vendorName={me.business} marketName={ev.name} validRange={ev.dateRange} photo={p.photo} boothNumber={passApp.boothNumber}/>
                              <div style={{ textAlign:'center', marginTop:8 }}>
                                <span onClick={()=>startEditPerson(p)} style={{ fontSize:11.5, fontWeight:600, color:'#9A5B26', cursor:'pointer', textDecoration:'underline', textUnderlineOffset:3 }}>Need to change this pass holder? Edit</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {passApp.people.length < maxSlots && (
                        <div style={{ marginTop:16, background:'#F7F3EC', borderRadius:14, padding:14 }}>
                          <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text-primary)', marginBottom:9 }}>Add pass holder {passApp.people.length+1} of {maxSlots}</div>
                          <PassPhotoNotice/>
                          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                            <PhotoPickerPair size={48} photo={extraForms[passApp.id]?.photo} onPick={async e => {
                              const file = e.target.files?.[0]; e.target.value='';
                              if (!file) return;
                              const photo = await fileToPhoto(file);
                              setExtraForms(f => ({ ...f, [passApp.id]: { ...(f[passApp.id]||{name:''}), photo } }));
                            }}/>
                            <input value={extraForms[passApp.id]?.name||''} onChange={e=>setExtraForms(f=>({ ...f, [passApp.id]: { ...(f[passApp.id]||{photo:null}), name:e.target.value } }))} placeholder="Full name" style={{ ...inp, flex:'1 1 140px' }}/>
                            <button onClick={()=>submitExtraSlot(passApp, ev)} style={{ background:'#9A5B26', color:'#fff', border:'none', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'11px 16px', cursor:'pointer', flexShrink:0 }}>Add</button>
                          </div>
                        </div>
                      )}

                      {passApp.people.length >= maxSlots && (
                        <div style={{ display:'flex', gap:9, background:'#F2EDE6', borderRadius:12, padding:'12px 13px', fontSize:12, color:'var(--text-secondary)', lineHeight:1.45, marginTop:16 }}>
                          <Icon name="info" size={15} color="#A09890" style={{ marginTop:1 }}/>
                          Need more than {maxSlots} passes? Contact the Sulap team — additional slots beyond this are granted by admin.
                        </div>
                      )}
                    </>
                  )}

                  {passApp && (
                    <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--glass-divider)', textAlign:'right' }}>
                      <span onClick={()=>resetMyPassForTesting(ev.id, ev)} style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', cursor:'pointer', textDecoration:'underline', textUnderlineOffset:3 }}>
                        Reset my Vendor Pass (testing)
                      </span>
                    </div>
                  )}
                </div>
              );
            });
            return (
              <>
                {cards}
                {anyApproved && (
                  <div style={{ display:'flex', gap:9, background:'#FEF8EC', border:'1px solid #f3e6c9', borderRadius:12, padding:'12px 13px', fontSize:12, color:'#B7770D', lineHeight:1.45 }}>
                    <Icon name="badge" size={15} color="#B7770D" style={{ marginTop:1 }}/>
                    Show a pass (tap to unfold) at the vendor check-in counter on market day for booth access.
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      </div>{/* /.tab-panel */}
      <PortalFooter/>
    </div>
  );
}

const lbl = { display:'block', fontSize:12.5, fontWeight:600, color:'var(--text-primary)', marginBottom:6 };
const inp = { width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:12, padding:'13px 14px', fontSize:14.5, outline:'none', display:'block' };
