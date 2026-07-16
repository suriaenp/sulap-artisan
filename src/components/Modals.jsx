import { useState } from 'react';
import Icon from './Icon';
import Badge from './Badge';
import PhotoTile from './PhotoTile';
import VendorAvatar from './VendorAvatar';
import { useStore } from '../lib/store';
import { CURRENT_VENDOR_ID, EVENT_IMG_PALETTE, isEventPhoto, eventImgFromFile, EMPTY_EINVOICE } from '../data/mockData';
import { dayCount, fmtShort, money, EINVOICE_FIELDS, einvoiceComplete, DETAILS_FIELDS } from '../lib/helpers';
import { fileToPhoto, downloadPhoto, photoExt, safeName } from '../lib/photoFiles';
import { scanAndRecord } from '../lib/payScan';

// ── shared sheet wrapper ──────────────────────────────────────────────────────
// Always centered (all popups across admin + vendor are centered dialogs, not
// bottom sheets). The rounded outer div clips the inner scroll container so
// the scrollbar never overhangs the rounded corners. Background stays a fixed
// light cream (not var(--bg-card)) because this modal's internal content
// still uses hardcoded light-mode text colors throughout — following the
// admin dark-mode background here without also reworking every hex color
// inside would make the text unreadable.
function Sheet({ onClose, children, maxW = 560 }) {
  return (
    <div onClick={onClose} style={{ position:'absolute', inset:0, zIndex:70, background:'rgba(28,26,23,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:24, animation:'scrimIn 0.25s ease' }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:maxW, background:'#FAF8F5', borderRadius:20, maxHeight:'90%', overflow:'hidden', animation:'modalIn 0.3s var(--ease-spring)', display:'flex', flexDirection:'column' }}>
        <div className="themed-scroll-light" style={{ overflowY:'auto', padding:'22px 22px 30px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function SheetHeader({ title, sub, onClose, avatar }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
        {avatar}
        <div style={{ minWidth:0 }}>
          <div style={{ fontFamily:"'Marcellus',serif", fontSize:20, fontWeight:400, color:'#1C1A17' }}>{title}</div>
          {sub && <div style={{ fontSize:13, color:'#6B6560', marginTop:2 }}>{sub}</div>}
        </div>
      </div>
      <button onClick={onClose} style={{ background:'#F2EDE6', border:'none', width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', color:'#1C1A17', cursor:'pointer', flexShrink:0 }}>
        <Icon name="x" size={17} color="#1C1A17"/>
      </button>
    </div>
  );
}

// Small uppercase icon-chip header, mirrors AdminDashboard's SectionHead but
// with fixed light-mode colors (Sheet content doesn't follow admin night mode).
function ModalSectionHead({ icon, text }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9, margin:'4px 0 13px' }}>
      <div style={{ width:26, height:26, borderRadius:8, background:'#F3E4CC', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Icon name={icon} size={13} color="#9A5B26"/>
      </div>
      <div style={{ fontSize:12, fontWeight:700, letterSpacing:'0.06em', color:'#A09890', textTransform:'uppercase' }}>{text}</div>
    </div>
  );
}

// Locked-on-the-vendor-side fields — admin can edit any of these directly at any time.
const ADMIN_DETAIL_FIELDS = [
  ['business', 'Brand name'],
  ['owner',    'Contact person (same as NRIC)'],
  ['category', 'Category'],
  ['email',    'Email'],
  ['phone',    'Phone'],
  ['plate',    'Car plate number'],
];

// ── Vendor Application Detail ─────────────────────────────────────────────────
export function VendorDetailModal() {
  const { state, dispatch, set, showToast, logActivity } = useStore();
  const { vendorDetailId, vendorDetailReturnAppId, vendors, settings, cats, profileRequests } = state;
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState(null);
  const [editingSocials, setEditingSocials] = useState(false);
  const [socialForm, setSocialForm] = useState({ ig:'', fb:'', tiktok:'', power:'' });
  const [editingEI, setEditingEI] = useState(false);
  const [eiForm, setEiForm] = useState(null);
  if (!vendorDetailId) return null;
  const v = vendors.find(x=>x.id===vendorDetailId)||{};
  const close = () => { setEditingDetails(false); setEditingSocials(false); setEditingEI(false); vendorDetailReturnAppId
    ? set({vendorDetailId:null, vendorDetailReturnAppId:null, appDetailId:vendorDetailReturnAppId})
    : set({vendorDetailId:null}); };

  const startEditDetails = () => { setDetailsForm({ business:v.business||'', owner:v.owner||'', category:v.category||'', email:v.email||'', phone:v.phone||'', plate:v.plate||'', desc:v.desc||'' }); setEditingDetails(true); };
  const saveDetails = () => {
    dispatch({ type:'MERGE_VENDORS', payload: vendors.map(x=>x.id===vendorDetailId?{...x,...detailsForm}:x) });
    logActivity('Admin', `updated ${v.business}'s vendor details.`, {icon:'pencil', tint:'#F2EDE6'});
    showToast('Vendor details updated','check');
    setEditingDetails(false);
  };

  const startEditSocials = () => { setSocialForm({ ig:v.ig||'', fb:v.fb||'', tiktok:v.tiktok||'', power:v.power||'' }); setEditingSocials(true); };
  const saveSocials = () => {
    dispatch({ type:'MERGE_VENDORS', payload: vendors.map(x=>x.id===vendorDetailId?{...x,...socialForm}:x) });
    logActivity('Admin', `updated ${v.business}'s social media & power supply info.`, {icon:'pencil', tint:'#F2EDE6'});
    showToast('Updated','check');
    setEditingSocials(false);
  };

  const startEditEI = () => { setEiForm({ ...EMPTY_EINVOICE, ...(v.einvoice||{}) }); setEditingEI(true); };
  const saveEI = () => {
    dispatch({ type:'MERGE_VENDORS', payload: vendors.map(x=>x.id===vendorDetailId?{...x,einvoice:eiForm}:x) });
    logActivity('Admin', `updated ${v.business}'s E-Invoice & bank details.`, {icon:'pencil', tint:'#F2EDE6'});
    showToast('E-Invoice details updated','check');
    setEditingEI(false);
  };

  const pendingReqs = profileRequests.filter(r => r.vendorId===vendorDetailId && r.status==='pending');
  const decideRequest = (reqId, decision) => {
    const req = profileRequests.find(r=>r.id===reqId);
    if (decision === 'approved') {
      const patch = req.section === 'einvoice' ? { einvoice: req.changes } : req.changes;
      dispatch({ type:'MERGE_VENDORS', payload: vendors.map(x=>x.id===req.vendorId?{...x,...patch}:x) });
    }
    dispatch({ type:'MERGE_PROFILE_REQUESTS', payload: profileRequests.map(r=>r.id===reqId?{...r,status:decision}:r) });
    logActivity('Admin', `${decision==='approved'?'approved':'rejected'} ${v.business}'s ${req.section==='einvoice'?'E-Invoice':'profile'} change request.`, {icon: decision==='approved'?'check':'x', tint: decision==='approved'?'#F3E4CC':'#FDEEEC'});
    showToast(`Request ${decision}`, decision==='approved'?'check':'x');
  };

  const einvoiceOk = einvoiceComplete(v);
  return (
    <Sheet onClose={close}>
      <SheetHeader title={v.business} sub={`${v.owner} · ${v.category}`} onClose={close} avatar={<VendorAvatar v={v} size={46}/>}/>
      <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginTop:12 }}>
        <Badge status={v.status}/>
      </div>

      {pendingReqs.map(req => (
        <div key={req.id} style={{ background:'#FEF8EC', border:'1px solid #f3e6c9', borderRadius:14, padding:'13px 14px', marginTop:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12.5, fontWeight:700, color:'#B7770D' }}>
            <Icon name="clock" size={14} color="#B7770D"/>{req.section==='einvoice' ? 'E-Invoice & bank details' : 'Profile'} change request — {req.submittedAt}
          </div>
          <div style={{ marginTop:9, display:'flex', flexDirection:'column', gap:6 }}>
            {Object.entries(req.changes).map(([k,newVal]) => {
              const label = (req.section==='einvoice' ? EINVOICE_FIELDS : DETAILS_FIELDS).find(([fk])=>fk===k)?.[1] || k;
              const oldVal = req.section==='einvoice' ? (v.einvoice&&v.einvoice[k]) : v[k];
              if ((oldVal||'') === (newVal||'')) return null;
              return (
                <div key={k} style={{ fontSize:12, color:'#4a443e' }}>
                  <span style={{ fontWeight:600 }}>{label}:</span> <span style={{ color:'#A09890', textDecoration:'line-through' }}>{oldVal||'—'}</span> → <span style={{ color:'#1C1A17', fontWeight:600 }}>{newVal||'—'}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display:'flex', gap:9, marginTop:12 }}>
            <button onClick={()=>decideRequest(req.id,'approved')} style={{ flex:1, background:'#2D6A4F', color:'#fff', border:'none', fontSize:12.5, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>Approve</button>
            <button onClick={()=>decideRequest(req.id,'rejected')} style={{ flex:1, background:'#FDEEEC', color:'#B03A2E', border:'none', fontSize:12.5, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>Reject</button>
          </div>
        </div>
      ))}

      {/* Vendor details — admin can edit directly */}
      <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:14, padding:'13px 14px', marginTop:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:11, fontWeight:700, color:'#1C1A17' }}>Vendor details</span>
          {!editingDetails && (
            <span onClick={startEditDetails} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'#9A5B26', cursor:'pointer' }}>
              <Icon name="pencil" size={12} color="#9A5B26"/>Edit
            </span>
          )}
        </div>
        {editingDetails ? (
          <div style={{ display:'flex', flexDirection:'column', gap:9, marginTop:10 }}>
            {ADMIN_DETAIL_FIELDS.map(([k,label]) => (
              <div key={k}>
                <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#1C1A17', marginBottom:4 }}>{label}</label>
                {k === 'category' ? (
                  <select value={detailsForm.category} onChange={e=>setDetailsForm({...detailsForm,category:e.target.value})} style={{ width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:9, padding:'9px 10px', fontSize:12.5, outline:'none' }}>
                    {cats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                ) : (
                  <input value={detailsForm[k]} onChange={e=>setDetailsForm({...detailsForm,[k]:e.target.value})} style={{ width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:9, padding:'9px 10px', fontSize:12.5, outline:'none' }} />
                )}
              </div>
            ))}
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#1C1A17', marginBottom:4 }}>Product description</label>
              <textarea value={detailsForm.desc} onChange={e=>setDetailsForm({...detailsForm,desc:e.target.value})} style={{ width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:9, padding:'9px 10px', fontSize:12.5, outline:'none', minHeight:60, resize:'none' }} />
            </div>
            <div style={{ display:'flex', gap:8, marginTop:2 }}>
              <button onClick={()=>setEditingDetails(false)} style={{ flex:1, background:'#F2EDE6', color:'#1C1A17', border:'none', fontSize:12.5, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>Cancel</button>
              <button onClick={saveDetails} style={{ flex:1, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:12.5, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>Save</button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop:9, display:'flex', flexDirection:'column', gap:7 }}>
            {[['mail',v.email],['phone',v.phone]].map(([icon,val]) => (
              <div key={icon} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12.5, color:'#4a443e' }}>
                <Icon name={icon} size={14} color="#A09890"/>{val}
              </div>
            ))}
            <div style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12.5, color:'#4a443e' }}>
              <Icon name="car" size={14} color="#A09890" style={{ marginTop:2 }}/><span>Car plate: {v.plate || '—'}</span>
            </div>
            <div style={{ fontSize:12.5, color:'#4a443e', lineHeight:1.5 }}>{v.desc}</div>
          </div>
        )}
      </div>

      {/* Social media & power supply — admin can edit directly */}
      <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:14, padding:'13px 14px', marginTop:14, display:'flex', flexDirection:'column', gap:9 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:11, fontWeight:700, color:'#1C1A17' }}>Social media &amp; power supply</span>
          {!editingSocials && (
            <span onClick={startEditSocials} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'#9A5B26', cursor:'pointer' }}>
              <Icon name="pencil" size={12} color="#9A5B26"/>Edit
            </span>
          )}
        </div>
        {editingSocials ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[['instagram','ig','@instagram_handle'],['facebook','fb','Facebook page name or URL'],['tiktok','tiktok','@tiktok_handle']].map(([icon,key,ph]) => (
              <div key={key} style={{ display:'flex', alignItems:'center', gap:8, border:'1px solid #e3d8ca', background:'#fff', borderRadius:10, padding:'0 11px' }}>
                <Icon name={icon} size={14} color="#A09890"/>
                <input value={socialForm[key]} onChange={e=>setSocialForm({...socialForm,[key]:e.target.value})} placeholder={ph} style={{ flex:1, border:'none', padding:'9px 0', fontSize:12.5, outline:'none', background:'transparent' }}/>
              </div>
            ))}
            <textarea value={socialForm.power} onChange={e=>setSocialForm({...socialForm,power:e.target.value})} placeholder="Power supply needs" style={{ width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:10, padding:'9px 11px', fontSize:12.5, outline:'none', minHeight:56, resize:'none' }} />
            <div style={{ display:'flex', gap:8, marginTop:2 }}>
              <button onClick={()=>setEditingSocials(false)} style={{ flex:1, background:'#F2EDE6', color:'#1C1A17', border:'none', fontSize:12.5, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>Cancel</button>
              <button onClick={saveSocials} style={{ flex:1, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:12.5, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>Save</button>
            </div>
          </div>
        ) : (
          <>
            {[['instagram',v.ig],['facebook',v.fb],['tiktok',v.tiktok]].map(([icon,val]) => (
              <div key={icon} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12.5, color:'#4a443e' }}>
                <Icon name={icon} size={14} color="#A09890"/>{val || '—'}
              </div>
            ))}
            <div style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12.5, color:'#4a443e' }}>
              <Icon name="info" size={14} color="#A09890" style={{ marginTop:2 }}/><span>Power: {v.power}</span>
            </div>
          </>
        )}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:'#1C1A17', margin:'16px 2px 8px' }}>Product photos ({(v.productPhotos||[]).length})</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:9 }}>
        {(v.productPhotos||[]).map(ph=><PhotoTile key={ph.id} photo={ph} size={96}/>)}
        {!(v.productPhotos||[]).length && <div style={{ fontSize:12, color:'#A09890' }}>No photos uploaded yet.</div>}
      </div>
      {v.status === 'approved' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', margin:'16px 2px 8px' }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#1C1A17' }}>E-Invoice &amp; bank details</span>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:10.5, fontWeight:600, color: einvoiceOk?'#2D6A4F':'#B7770D', background: einvoiceOk?'#E8F5F0':'#FEF8EC', borderRadius:999, padding:'3px 9px' }}>{einvoiceOk ? 'Complete' : 'Incomplete'}</span>
              {!editingEI && (
                <span onClick={startEditEI} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'#9A5B26', cursor:'pointer' }}>
                  <Icon name="pencil" size={12} color="#9A5B26"/>Edit
                </span>
              )}
            </div>
          </div>
          <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:14, padding:'13px 14px', display:'flex', flexDirection:'column' }}>
            {editingEI ? (
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                {EINVOICE_FIELDS.map(([k,label,hint]) => (
                  <div key={k}>
                    <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#1C1A17', marginBottom:4 }}>{label}</label>
                    <input value={eiForm[k]} onChange={e=>setEiForm({...eiForm,[k]:e.target.value})} placeholder={hint} style={{ width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:9, padding:'9px 10px', fontSize:12.5, outline:'none' }} />
                  </div>
                ))}
                <div style={{ display:'flex', gap:8, marginTop:2 }}>
                  <button onClick={()=>setEditingEI(false)} style={{ flex:1, background:'#F2EDE6', color:'#1C1A17', border:'none', fontSize:12.5, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>Cancel</button>
                  <button onClick={saveEI} style={{ flex:1, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:12.5, fontWeight:600, borderRadius:10, padding:9, cursor:'pointer' }}>Save</button>
                </div>
              </div>
            ) : (
              EINVOICE_FIELDS.map(([k,label],i,arr) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:14, padding:'9px 0', borderBottom:i<arr.length-1?'1px solid #f1ece4':'none' }}>
                  <span style={{ fontSize:11.5, color:'#A09890', flexShrink:0 }}>{label}</span>
                  <span style={{ fontSize:12.5, fontWeight:600, color:'#1C1A17', textAlign:'right' }}>{(v.einvoice&&v.einvoice[k]) || '—'}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
      {v.status === 'pending' && (
        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button onClick={()=>{ dispatch({type:'MERGE_VENDORS',payload:vendors.map(x=>x.id===vendorDetailId?{...x,status:'approved'}:x)}); logActivity('Admin', `approved ${v.business} as a vendor.`, {icon:'check', tint:'#F3E4CC'}); showToast('Vendor approved'+(settings.emailAlerts?' · vendor emailed':''),'check'); close(); }} style={{ flex:1, background:'#2D6A4F', color:'#fff', border:'none', fontSize:14, fontWeight:600, borderRadius:12, padding:13, cursor:'pointer' }}>Approve vendor</button>
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
  const close = () => set({appDetailId:null});
  return (
    <Sheet onClose={close}>
      <SheetHeader title={v.business} sub={`${ev.name} · ${v.category}`} onClose={close} avatar={<VendorAvatar v={v} size={46}/>}/>
      <span style={{ display:'inline-block', marginTop:8, fontSize:12, fontWeight:600, color: a.status==='approved' ? '#8FB8A4' : a.status==='rejected' ? '#CB9A93' : '#B7770D' }}>
        {a.status==='approved' ? 'Approved' : a.status==='rejected' ? 'Rejected' : 'Awaiting review'}
      </span>
      <div onClick={()=>set({appDetailId:null, vendorDetailId:v.id, vendorDetailReturnAppId:appDetailId})} style={{ display:'flex', alignItems:'center', gap:10, background:'#F3E4CC', borderRadius:11, padding:'9px 11px', marginTop:13, cursor:'pointer' }}>
        <VendorAvatar v={v} size={30}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#1C1A17' }}>{v.business}</div>
          <div style={{ fontSize:11, color:'#A09890' }}>View full vendor profile</div>
        </div>
        <span style={{ fontSize:16, color:'#A09890' }}>›</span>
      </div>
      <div style={{ fontSize:13.5, color:'#4a443e', lineHeight:1.55, marginTop:13 }}>{v.desc}</div>
      <div style={{ fontSize:12, fontWeight:700, color:'#1C1A17', margin:'15px 2px 8px' }}>Product photos ({(v.productPhotos||[]).length})</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:9 }}>
        {(v.productPhotos||[]).map(ph=><PhotoTile key={ph.id} photo={ph} size={88}/>)}
        {!(v.productPhotos||[]).length && <div style={{ fontSize:12, color:'#A09890' }}>No photos uploaded yet.</div>}
      </div>
      <div style={{ background:'#fff', border:'1px solid #efe7dc', borderRadius:16, padding:15, marginTop:18 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Icon name="users" size={17} color="#9A5B26"/><div style={{ fontSize:14, fontWeight:700, color:'#1C1A17' }}>Booth sharing</div>
        </div>
        <div style={{ fontSize:11.5, color:'#A09890', marginTop:4, lineHeight:1.45 }}>Declared by the vendor when they applied.</div>
        {a.shared && partners.length > 0 ? (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:12 }}>
              {partners.map(p => (
                <div key={p.id} onClick={()=>set({appDetailId:null, vendorDetailId:p.id, vendorDetailReturnAppId:appDetailId})} style={{ display:'flex', alignItems:'center', gap:10, background:'#F3E4CC', borderRadius:11, padding:'9px 11px', cursor:'pointer' }}>
                  <VendorAvatar v={p} size={30}/>
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
    <Sheet onClose={close} maxW={560}>
      <SheetHeader title="Edit event" sub={ev.name} onClose={close}/>
      <div style={{ marginTop:18 }}>
        <ModalSectionHead icon="pencil" text="Basics"/>
        <div style={{ position:'relative', width:'100%', maxWidth:200, aspectRatio:'4 / 5', borderRadius:16, overflow:'hidden', margin:'0 auto 16px', background:eef.img||EVENT_IMG_PALETTE[0], boxShadow:'0 10px 26px rgba(90,55,20,0.22)' }}>
          {!isEventPhoto(eef.img) && <Icon name="image" size={44} color="rgba(255,255,255,0.35)" style={{ position:'absolute', top:'40%', left:'50%', transform:'translate(-50%,-50%)' }}/>}
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(29,16,6,0) 50%, rgba(29,16,6,0.62) 100%)' }}/>
          <div style={{ position:'absolute', left:14, right:14, bottom:12, fontFamily:"'Marcellus',serif", fontSize:15.5, color:'#FFF8EE', textShadow:'0 1px 4px rgba(0,0,0,0.3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{eef.name || 'Your event name'}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
          <div><div style={lbl}>Event name</div><input value={eef.name} onChange={e=>upd('name',e.target.value)} placeholder="e.g. Harvest Night Market" style={inp}/></div>
          <div><div style={lbl}>Location</div><input value={eef.location} onChange={e=>upd('location',e.target.value)} placeholder="e.g. Suria Sabah Mall" style={inp}/></div>
          <div>
            <div style={lbl}>Event photo</div>
            <div style={{ display:'flex', gap:9 }}>
              <label style={{ display:'inline-flex', alignItems:'center', gap:6, border:'1px solid #e3d8ca', background:'#fff', color:'#9A5B26', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'9px 14px', cursor:'pointer' }}>
                <Icon name="upload" size={13} color="#9A5B26"/>{isEventPhoto(eef.img) ? 'Change photo' : 'Upload photo'}
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{
                  const file = e.target.files?.[0]; if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => upd('img', eventImgFromFile(reader.result));
                  reader.readAsDataURL(file);
                  e.target.value='';
                }}/>
              </label>
              {isEventPhoto(eef.img) && (
                <button onClick={()=>upd('img',EVENT_IMG_PALETTE[0])} style={{ background:'#F3EDE3', border:'none', color:'#5C5348', fontSize:12.5, fontWeight:600, borderRadius:10, padding:'9px 12px', cursor:'pointer' }}>Remove</button>
              )}
            </div>
            <div style={{ fontSize:11, color:'#A09890', marginTop:9, lineHeight:1.4 }}>Shown wherever this event is listed.</div>
          </div>
        </div>

        <div style={{ height:1, background:'#EFE0C7', margin:'20px 0' }}/>

        <ModalSectionHead icon="calendar" text="Schedule"/>
        <div className="form-grid">
          <div><div style={lbl}>Start date</div><input type="date" value={eef.start} onChange={e=>upd('start',e.target.value)} style={inp}/></div>
          <div><div style={lbl}>End date</div><input type="date" value={eef.end} onChange={e=>upd('end',e.target.value)} style={inp}/></div>
          <div><div style={lbl}>Daily start time</div><input type="time" value={eef.startTime} onChange={e=>upd('startTime',e.target.value)} style={inp}/></div>
          <div><div style={lbl}>Daily end time</div><input type="time" value={eef.endTime} onChange={e=>upd('endTime',e.target.value)} style={inp}/></div>
          {eef.start && eef.end && (
            <div className="span2" style={{ display:'flex', alignItems:'center', gap:7, background:'#F3E4CC', borderRadius:10, padding:'9px 12px', fontSize:12.5, color:'#9A5B26', fontWeight:600 }}>
              <Icon name="calendar" size={15} color="#9A5B26"/>Duration: {d} day(s)
            </div>
          )}
          <div className="span2">
            <div style={lbl}>Last date to apply</div>
            <input type="date" value={eef.lastApp} onChange={e=>upd('lastApp',e.target.value)} style={inp}/>
            <div style={{ fontSize:11, color:'#A09890', marginTop:5 }}>Applications close automatically after this date.</div>
          </div>
        </div>

        <div style={{ height:1, background:'#EFE0C7', margin:'20px 0' }}/>

        <ModalSectionHead icon="wallet" text="Pricing"/>
        <div className="form-grid">
          <div><div style={{ ...lbl, minHeight:32 }}>F&amp;B / day (RM) + 6% SST</div><input inputMode="numeric" value={eef.fnb} onChange={e=>upd('fnb',e.target.value)} placeholder="300" style={inp}/></div>
          <div><div style={{ ...lbl, minHeight:32 }}>Non-F&amp;B / day (RM) + 6% SST</div><input inputMode="numeric" value={eef.nonfnb} onChange={e=>upd('nonfnb',e.target.value)} placeholder="250" style={inp}/></div>
        </div>
        <div style={{ marginTop:13, border:'1px solid #EFE0C7', borderRadius:14, padding:13, background:'#F7EFE3' }}>
          <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:'0.05em', color:'#A09890', textTransform:'uppercase', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}><Icon name="receipt" size={12} color="#A09890"/>Pricing preview · {d} day(s)</div>
          <div style={{ display:'flex', gap:9, flexWrap:'wrap' }}>
            <div style={{ flex:'1 1 140px', background:'#E8F5F0', borderRadius:10, padding:'10px 12px' }}><div style={{ fontSize:10.5, color:'#2D6A4F', fontWeight:600 }}>F&amp;B rental total</div><div style={{ fontSize:15, fontWeight:700, color:'#2D6A4F', marginTop:2 }}>RM {money(fnbTotal)}</div><div style={{ fontSize:9.5, color:'#6f9d8a', marginTop:1 }}>inclusive of 6% SST</div></div>
            <div style={{ flex:'1 1 140px', background:'#F3E4CC', borderRadius:10, padding:'10px 12px' }}><div style={{ fontSize:10.5, color:'#9A5B26', fontWeight:600 }}>Non-F&amp;B rental total</div><div style={{ fontSize:15, fontWeight:700, color:'#9A5B26', marginTop:2 }}>RM {money(nfTotal)}</div><div style={{ fontSize:9.5, color:'#A9834D', marginTop:1 }}>inclusive of 6% SST</div></div>
          </div>
        </div>

        <button onClick={save} className="cta" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:14.5, fontWeight:600, borderRadius:12, padding:14, cursor:'pointer', marginTop:20 }}>
          <Icon name="check" size={15} color="#FAF8F5"/>Save changes
        </button>
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
    logActivity(me.business, `applied for ${ev.name}.`, {icon:'clipboard', tint:'#F3E4CC', type:'vendor'});
    showToast('Application submitted','mail');
  };

  const btnSel = (active) => ({ flex:1, border:`1.5px solid ${active?'#9A5B26':'#e3d8ca'}`, background:active?'#F3E4CC':'#fff', color:active?'#9A5B26':'#6B6560', fontSize:13, fontWeight:600, borderRadius:12, padding:13, cursor:'pointer' });

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
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, background:'#F3E4CC', borderRadius:11, padding:'9px 11px' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#1C1A17' }}>{p.business}</div>
                    <div style={{ fontSize:11, color:'#A09890' }}>{p.category}</div>
                  </div>
                  <button onClick={()=>set({applyPartners:applyPartners.filter(x=>x!==p.id)})} style={{ background:'#fff', border:'1px solid #E3CBA0', width:30, height:30, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:'#B03A2E', cursor:'pointer', flexShrink:0 }}>
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
                      <span style={{ fontSize:12, fontWeight:700, color:'#9A5B26', flexShrink:0 }}>+ Add</span>
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
      <button onClick={submit} className="cta" style={{ marginTop:20, width:'100%', background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:14.5, fontWeight:600, borderRadius:12, padding:14, cursor:'pointer' }}>Submit application</button>
    </Sheet>
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
          <button key={s} onClick={()=>upd('status',s)} style={{ flex:1, border:`1.5px solid ${depf.status===s?'#9A5B26':'#e3d8ca'}`, background:depf.status===s?'#F3E4CC':'#fff', color:depf.status===s?'#9A5B26':'#6B6560', fontSize:13, fontWeight:600, borderRadius:12, padding:11, cursor:'pointer', textTransform:'capitalize' }}>{s}</button>
        ))}
      </div>
      <div style={{ marginTop:14 }}><div style={lbl}>Deposit invoice no.</div><input value={depf.inv||''} onChange={e=>upd('inv',e.target.value)} placeholder="DEP-0000" style={inp}/></div>
      <div style={{ marginTop:13 }}><div style={lbl}>Date paid</div><input type="date" value={depf.payDate||''} onChange={e=>upd('payDate',e.target.value)} style={inp}/></div>
      {depf.status === 'refunded' && <div style={{ marginTop:13 }}><div style={lbl}>Date refunded</div><input type="date" value={depf.refundDate||''} onChange={e=>upd('refundDate',e.target.value)} style={inp}/></div>}
      <button onClick={save} style={{ marginTop:18, width:'100%', background:'#9A5B26', color:'#fff', border:'none', fontSize:14, fontWeight:600, borderRadius:12, padding:13, cursor:'pointer' }}>Save deposit record</button>
    </Sheet>
  );
}

// ── Refund Modal (overpayment) ──────────────────────────────────────────────
export function RefundModal() {
  const { state, dispatch, set, showToast, logActivity } = useStore();
  const { refundModalKey, reff, vendors, events, payments } = state;
  if (!refundModalKey) return null;
  const [vid, eid] = refundModalKey.split('-');
  const v = vendors.find(x=>x.id===vid)||{};
  const ev = events.find(x=>x.id===eid)||{};
  const rec = payments[refundModalKey]||{paid:0};
  const close = () => set({refundModalKey:null});
  const upd = (k,val) => set({reff:{...reff,[k]:val}});
  const save = () => {
    if (!reff.refCode || !reff.date || !reff.time) { showToast('Fill in reference code, date, and time first','info'); return; }
    dispatch({type:'MERGE_REFUNDS',payload:{[refundModalKey]:{refCode:reff.refCode,date:reff.date,time:reff.time,status:'completed'}}});
    logActivity('Admin', `marked ${v.business}'s refund for ${ev.name} as complete.`, {icon:'wallet', tint:'#EEF1FB'});
    showToast('Refund marked complete','check');
    close();
  };
  const inp = { width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:11, padding:'11px 13px', fontSize:14, outline:'none' };
  return (
    <Sheet onClose={close} maxW={440}>
      <SheetHeader title="Arrange refund" sub={`${v.business} · ${ev.name}`} onClose={close}/>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#6B6560', background:'#FDEEEC', border:'1px solid #f3d5d0', borderRadius:11, padding:'11px 13px', marginTop:14 }}>
        <span>Amount paid</span><span style={{ fontWeight:700, color:'#B03A2E' }}>RM {money(rec.paid)}</span>
      </div>
      <div style={{ marginTop:14 }}><div style={lbl}>Reference code</div><input value={reff.refCode||''} onChange={e=>upd('refCode',e.target.value)} placeholder="REF-0000" style={inp}/></div>
      <div style={{ marginTop:13 }}><div style={lbl}>Date of refund</div><input type="date" value={reff.date||''} onChange={e=>upd('date',e.target.value)} style={inp}/></div>
      <div style={{ marginTop:13 }}><div style={lbl}>Time of refund</div><input type="time" value={reff.time||''} onChange={e=>upd('time',e.target.value)} style={inp}/></div>
      <button onClick={save} style={{ marginTop:18, width:'100%', background:'#9A5B26', color:'#fff', border:'none', fontSize:14, fontWeight:600, borderRadius:12, padding:13, cursor:'pointer' }}>Mark refund complete</button>
    </Sheet>
  );
}

// ── Payment Document Preview ──────────────────────────────────────────────────
// Opened via state.docPreview = { payKey, field, editable }.
// Preview any payment file (advice / invoice / receipt) with Download,
// and Replace / Remove when the viewer owns the document.
const DOC_LABELS = { advice:'Payment advice', advice2:'Second payment advice', invoice:'Invoice', receipt:'Receipt' };

export function DocPreviewModal() {
  const { state, dispatch, set, showToast, logActivity } = useStore();
  const { docPreview, payments, vendors, events, deposits } = state;
  if (!docPreview) return null;
  const { payKey, field, editable } = docPreview;
  const [vid, eid] = payKey.split('-');
  const v = vendors.find(x=>x.id===vid)||{};
  const ev = events.find(x=>x.id===eid)||{};
  const rec = payments[payKey]||{};
  const file = rec[field];
  const close = () => set({ docPreview:null });
  if (!file) return null;
  const label = DOC_LABELS[field]||'Document';
  const isPdf = (file.url||'').startsWith('data:application/pdf');
  const scan = field.startsWith('advice') ? rec.scans?.[field] : null;

  const onReplace = async (e) => {
    const f = e.target.files[0]; e.target.value='';
    if (!f) return;
    const doc = await fileToPhoto(f);
    if (field.startsWith('advice')) {
      showToast('Scanning for the paid amount…','search');
      await scanAndRecord(doc, payKey, field, { payments, vendors, events, deposits, dispatch, showToast, logActivity, who:v.business });
    } else {
      dispatch({ type:'MERGE_PAYMENTS', payload:{ [payKey]: { ...rec, [field]: doc } } });
      logActivity('Admin', `replaced the ${label.toLowerCase()} for ${v.business} — ${ev.name}.`, { icon:'file', tint:'#E8F5F0' });
      showToast(`${label} replaced`,'file');
    }
  };

  const onRemove = () => {
    if (!window.confirm(`Remove this ${label.toLowerCase()}?`)) return;
    const scans = { ...(rec.scans||{}) }; delete scans[field];
    dispatch({ type:'MERGE_PAYMENTS', payload:{ [payKey]: { ...rec, [field]: null, scans } } });
    showToast(`${label} removed`,'x');
    close();
  };

  return (
    <Sheet onClose={close} maxW={620}>
      <SheetHeader title={label} sub={`${v.business} · ${ev.name}`} onClose={close}/>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:10, fontSize:12, color:'#6B6560' }}>
        <Icon name="file" size={14} color="#A09890"/><span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.name}</span>
      </div>
      <div style={{ marginTop:12, borderRadius:14, overflow:'hidden', border:'1px solid #efe7dc', background:'#fff', height:360 }}>
        {isPdf ? (
          <iframe title={file.name} src={file.url} style={{ width:'100%', height:'100%', border:'none' }}/>
        ) : file.url ? (
          <img src={file.url} alt={file.name} style={{ width:'100%', height:'100%', objectFit:'contain', display:'block', background:'#FBF7F1' }}/>
        ) : (
          <div style={{ width:'100%', height:'100%', background:`linear-gradient(135deg,${file.grad?.[0]||'#F0D8DD'},${file.grad?.[1]||'#B97434'})`, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.85)', fontSize:13, fontWeight:600 }}>
            Sample document (demo)
          </div>
        )}
      </div>
      {scan && (
        <div style={{ fontSize:11.5, color:'#8A837B', marginTop:9 }}>
          {scan.amount != null ? `Auto-scan read RM ${money(scan.amount)} · ${scan.at}` : `Auto-scan couldn't read an amount · ${scan.at}`}
        </div>
      )}
      <div style={{ display:'flex', gap:9, marginTop:14 }}>
        <button onClick={()=>downloadPhoto(file, `${safeName(v.business)} - ${label} - ${safeName(ev.name)}.${photoExt(file)}`)} style={{ flex:1, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:13, fontWeight:600, borderRadius:11, padding:12, cursor:'pointer' }}>
          <Icon name="download" size={14} color="#FAF8F5"/>Download
        </button>
        {editable && (
          <>
            <label style={{ flex:1, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, background:'#FAF8F5', border:'1px solid #e3d8ca', color:'#9A5B26', fontSize:13, fontWeight:600, borderRadius:11, padding:12, cursor:'pointer' }}>
              <input type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={onReplace}/>
              <Icon name="upload" size={14} color="#9A5B26"/>Replace
            </label>
            <button onClick={onRemove} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, background:'#FDEEEC', border:'none', color:'#B03A2E', fontSize:13, fontWeight:600, borderRadius:11, padding:'12px 16px', cursor:'pointer' }}>
              <Icon name="trash" size={14} color="#B03A2E"/>Remove
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

// ── Pass Holder Photo Preview ─────────────────────────────────────────────────
// Opened via state.passPhotoPreview = { name, photo }. Lets admin (and vendor)
// see the uploaded pass-holder photo full-size before AND after approving a
// Vendor Pass application — the inline thumbnails are only 30-34px.
export function PassPhotoPreviewModal() {
  const { state, set } = useStore();
  const { passPhotoPreview } = state;
  if (!passPhotoPreview) return null;
  const { name, photo } = passPhotoPreview;
  const close = () => set({ passPhotoPreview:null });
  const grad = `linear-gradient(135deg,${photo?.grad?.[0]||'#F0D8DD'},${photo?.grad?.[1]||'#B97434'})`;
  return (
    <Sheet onClose={close} maxW={420}>
      <SheetHeader title={name||'Pass holder'} sub="Uploaded photo" onClose={close}/>
      <div style={{ marginTop:14, borderRadius:14, overflow:'hidden', border:'1px solid #efe7dc', background: photo?.url ? '#fff' : grad, minHeight:320, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {photo?.url
          ? <img src={photo.url} alt={name} style={{ width:'100%', maxHeight:440, objectFit:'contain', display:'block' }}/>
          : <span style={{ color:'rgba(255,255,255,0.85)', fontSize:13, fontWeight:600 }}>Sample photo (demo)</span>}
      </div>
      {photo?.url && (
        <button onClick={()=>downloadPhoto(photo, `${safeName(name||'pass-holder')}.${photoExt(photo)}`)} style={{ marginTop:14, width:'100%', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:13, fontWeight:600, borderRadius:11, padding:12, cursor:'pointer' }}>
          <Icon name="download" size={14} color="#FAF8F5"/>Download
        </button>
      )}
    </Sheet>
  );
}

const lbl = { display:'block', fontSize:12, fontWeight:600, color:'#1C1A17', marginBottom:6 };
