import { useRef } from 'react';
import Icon from '../components/Icon';
import { useStore } from '../lib/store';
import { fmtShort } from '../lib/helpers';

const CATS = [
  { id:'fnb',      icon:'utensils', name:'Food & Beverage',                desc:'Coffee, drinks, cakes, cookies, desserts, snacks, meals, packaged food' },
  { id:'craft',    icon:'palette',  name:'Handcraft / Art',                desc:'Paintings, prints, pottery, crochet, candles, resin art, handmade décor' },
  { id:'fashion',  icon:'shopbag',  name:'Fashion',                        desc:'Clothing, thrift wear, upcycled fashion, tote bags, scarves, batik' },
  { id:'jewel',    icon:'sparkles', name:'Jewellery',                      desc:'Earrings, bracelets, necklaces, rings, beaded & clay accessories' },
  { id:'beauty',   icon:'droplet',  name:'Beauty & Wellness',              desc:'Handmade soap, body scrub, balm, perfume, essential oils, bath' },
  { id:'home',     icon:'home',     name:'Home & Lifestyle',               desc:'Home décor, tableware, room fragrance, plants, dried flowers, gifts' },
  { id:'creative', icon:'pen',      name:'Creative Services / Experience', desc:'Portrait drawing, calligraphy, henna, workshops, live painting' },
  { id:'books',    icon:'file',     name:'Books / Stationery',             desc:'Zines, journals, notebooks, postcards, stickers, bookmarks, planners' },
  { id:'other',    icon:'folder',   name:'Others',                         desc:'Any product or service not listed above' },
];

const STEPS = ['', 'Business details', 'Contact & logistics', 'Product photos', 'Market terms'];
const PROGRESS = ['', '25%', '50%', '75%', '100%'];

export default function VendorRegister() {
  const { state, dispatch, set, showToast } = useStore();
  const { regStep, selectedCat, tcAccepted, tcScrolled, content, rf, vendors } = state;
  const termsRef = useRef(null);
  const upd = (k, val) => set({ rf: { ...rf, [k]: val } });

  const back = () => {
    if (regStep > 1) set({ regStep: regStep - 1 });
    else set({ vScreen: 'login' });
  };
  const next = () => {
    if (regStep === 1) {
      if (!rf.business.trim() || !rf.owner.trim() || !rf.email.trim() || !rf.phone.trim()) { showToast('Please fill in all business details', 'info'); return; }
      if (!selectedCat) { showToast('Please select a product category', 'info'); return; }
      if (!rf.password || rf.password.length < 8) { showToast('Password must be at least 8 characters', 'info'); return; }
    }
    if (regStep < 4) { set({ regStep: regStep + 1 }); return; }
    if (!tcAccepted) { showToast('Please accept the market terms first', 'info'); return; }

    const cat = CATS.find(c => c.id === selectedCat);
    const newVendor = {
      id: 'v' + Date.now(),
      business: rf.business.trim(),
      owner: rf.owner.trim(),
      category: cat ? cat.name : 'Others',
      email: rf.email.trim(),
      phone: rf.phone.trim(),
      ig: rf.ig.trim(), fb: rf.fb.trim(), tiktok: rf.tiktok.trim(),
      plate: rf.plate.trim(),
      regDate: fmtShort(new Date()),
      status: 'pending',
      power: rf.power.trim() || 'None',
      photos: rf.photos,
      desc: rf.desc.trim(),
    };
    dispatch({ type: 'MERGE_VENDORS', payload: [...vendors, newVendor] });
    set({ regStep: 5, selectedCat: null, tcAccepted: false, tcScrolled: false, rf: { business:'', owner:'', email:'', phone:'', desc:'', password:'', ig:'', fb:'', tiktok:'', plate:'', power:'', photos:0 } });
  };

  const handleTermsScroll = (e) => {
    const el = e.target;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10 && !tcScrolled) {
      set({ tcScrolled: true });
    }
  };

  const toggleTc = () => {
    if (!tcScrolled) { showToast('Scroll through the full terms first', 'info'); return; }
    set({ tcAccepted: !tcAccepted });
  };

  if (regStep === 5) {
    return (
      <div style={{ padding:'60px 26px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', minHeight:680, justifyContent:'center' }}>
        <div style={{ width:84, height:84, borderRadius:'50%', background:'#E8F5F0', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon name="check" size={42} color="#2D6A4F" />
        </div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:27, fontWeight:600, color:'#1C1A17', marginTop:24 }}>We've received your application</div>
        <div style={{ fontSize:14, color:'#6B6560', marginTop:10, lineHeight:1.55, maxWidth:290 }}>Thank you for applying to become a Sulap Artisan vendor. Our team will review your application — if you're selected, you'll receive a confirmation email with next steps.</div>
        <button onClick={() => set({ view:'public', pubScreen:'home', vScreen:'login' })} style={{ marginTop:30, background:'#A6364E', color:'#FAF8F5', border:'none', fontSize:15, fontWeight:600, borderRadius:13, padding:'15px 40px', cursor:'pointer', boxShadow:'0 4px 12px rgba(166,54,78,0.22)' }}>Back to home</button>
      </div>
    );
  }

  return (
    <div>
      {/* Progress header */}
      <div style={{ padding:'14px 20px 0', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={back} style={{ background:'#F2EDE6', border:'none', width:36, height:36, borderRadius:11, fontSize:17, color:'#1C1A17', cursor:'pointer', flexShrink:0 }}>‹</button>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
            <span style={{ fontSize:12, fontWeight:600, color:'#A6364E' }}>Step {regStep} of 4</span>
            <span style={{ fontSize:12, color:'#A09890' }}>{STEPS[regStep]}</span>
          </div>
          <div style={{ height:6, borderRadius:4, background:'#F2EDE6', marginTop:7, overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:4, background:'linear-gradient(90deg,#C75C84,#A6364E)', width:PROGRESS[regStep], transition:'width 0.35s ease' }}/>
          </div>
        </div>
      </div>

      {/* Step 1 — Business details */}
      {regStep === 1 && (
        <div style={{ padding:20 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:23, fontWeight:600, color:'#1C1A17' }}>Business details</div>
          <div style={{ fontSize:13, color:'#6B6560', marginTop:5 }}>Tell us about your craft business.</div>
          <div className="form-grid" style={{ marginTop:20 }}>
            <div><label style={lbl}>Business name</label><input value={rf.business} onChange={e=>upd('business',e.target.value)} placeholder="e.g. Nutmeg & Clay" style={inp} /></div>
            <div><label style={lbl}>Owner name</label><input value={rf.owner} onChange={e=>upd('owner',e.target.value)} placeholder="Full name" style={inp} /></div>
            <div><label style={lbl}>Email</label><input value={rf.email} onChange={e=>upd('email',e.target.value)} placeholder="you@email.com" style={inp} /></div>
            <div><label style={lbl}>Phone</label><input value={rf.phone} onChange={e=>upd('phone',e.target.value)} placeholder="01x-xxxxxxx" style={inp} /></div>
            <div className="span2">
              <div style={lbl}>Product category</div>
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                {CATS.map(c => {
                  const sel = selectedCat === c.id;
                  return (
                    <div key={c.id} onClick={() => set({ selectedCat: c.id })} style={{ display:'flex', alignItems:'center', gap:12, border:`1.5px solid ${sel?'#A6364E':'#e3d8ca'}`, background:sel?'#F8E9EE':'#fff', borderRadius:13, padding:'12px 13px', cursor:'pointer', maxWidth:460 }}>
                      <Icon name={c.icon} size={22} color="#A6364E" />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:600, color:'#1C1A17' }}>{c.name}</div>
                        <div style={{ fontSize:11.5, color:'#A09890', marginTop:1 }}>{c.desc}</div>
                      </div>
                      <div style={{ width:22, height:22, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#fff', background:sel?'#A6364E':'transparent', border:sel?'none':'1.5px solid #ddd2c4' }}>{sel?'✓':''}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="span2"><label style={lbl}>Product description</label><textarea value={rf.desc} onChange={e=>upd('desc',e.target.value)} placeholder="What do you make and sell?" style={{ ...inp, minHeight:74, resize:'none' }} /></div>
            <div className="span2">
              <label style={lbl}>Create a password</label>
              <input type="password" value={rf.password} onChange={e=>upd('password',e.target.value)} placeholder="Min. 8 characters" style={inp} />
              <div style={{ fontSize:11, color:'#A09890', marginTop:6 }}>You'll use this to sign in to your portal later.</div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — Contact & logistics */}
      {regStep === 2 && (
        <div style={{ padding:20 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:23, fontWeight:600, color:'#1C1A17' }}>Contact &amp; logistics</div>
          <div style={{ fontSize:13, color:'#6B6560', marginTop:5 }}>Help shoppers find you and help us plan the day.</div>
          <div className="reg-narrow" style={{ marginTop:20, display:'flex', flexDirection:'column', gap:15 }}>
            <div style={{ fontSize:12.5, fontWeight:600, color:'#1C1A17' }}>Social media</div>
            {[['instagram','ig','@instagram_handle'],['facebook','fb','Facebook page name or URL'],['camera','tiktok','@tiktok_handle']].map(([icon,key,ph]) => (
              <div key={icon} style={{ display:'flex', alignItems:'center', gap:11, border:'1px solid #e3d8ca', background:'#fff', borderRadius:12, padding:'0 14px' }}>
                <Icon name={icon} size={18} color="#A6364E" />
                <input value={rf[key]} onChange={e=>upd(key,e.target.value)} placeholder={ph} style={{ flex:1, border:'none', padding:'13px 0', fontSize:14.5, outline:'none', background:'transparent' }} />
              </div>
            ))}
            <div>
              <label style={lbl}>Car plate number</label>
              <input value={rf.plate} onChange={e=>upd('plate',e.target.value.toUpperCase())} placeholder="e.g. SAB 1234 B" style={{ ...inp, textTransform:'uppercase' }} />
              <div style={{ fontSize:11, color:'#A09890', marginTop:6 }}>Used to assign your parking serial on market day.</div>
            </div>
            <div>
              <label style={lbl}>Power supply needs</label>
              <textarea value={rf.power} onChange={e=>upd('power',e.target.value)} placeholder="List machines + voltage, e.g. 1× coffee machine (240V, 13A), 1× chest freezer" style={{ ...inp, minHeight:84, resize:'none' }} />
            </div>
          </div>
        </div>
      )}

      {/* Step 3 — Product photos */}
      {regStep === 3 && (
        <div style={{ padding:20 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:23, fontWeight:600, color:'#1C1A17' }}>Product photos</div>
          <div style={{ fontSize:13, color:'#6B6560', marginTop:5 }}>Show your best work — this appears on your vendor profile.</div>
          <div onClick={()=>{ if (rf.photos < 8) upd('photos', rf.photos + 1); else showToast('Up to 8 photos','info'); }} style={{ marginTop:20, border:'2px dashed #d8c6b2', borderRadius:18, background:'#FBF7F1', padding:'30px 20px', textAlign:'center', cursor:'pointer' }}>
            <Icon name="camera" size={32} color="#A6364E" />
            <div style={{ fontSize:14, fontWeight:600, color:'#1C1A17', marginTop:11 }}>Tap to upload photos</div>
            <div style={{ fontSize:12, color:'#A09890', marginTop:4 }}>JPG or PNG · up to 8 images</div>
          </div>
          {rf.photos > 0 && (
            <div style={{ display:'flex', gap:9, marginTop:16, flexWrap:'wrap' }}>
              {Array.from({length:rf.photos}).map((_,i) => (
                <div key={i} style={{ width:'calc(25% - 7px)', aspectRatio:'1', borderRadius:13, background:`linear-gradient(135deg,hsl(${i*35+340},50%,72%),hsl(${i*35+320},45%,52%))`, position:'relative' }}>
                  <span onClick={e=>{ e.stopPropagation(); upd('photos', rf.photos - 1); }} style={{ position:'absolute', top:5, right:6, background:'rgba(28,26,23,0.45)', color:'#fff', width:20, height:20, borderRadius:'50%', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>×</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ background:'#E8F5F0', border:'1px solid #cfe9df', borderRadius:12, padding:'13px 14px', marginTop:20, display:'flex', gap:10, alignItems:'flex-start' }}>
            <Icon name="check" size={17} color="#2D6A4F" style={{ marginTop:1 }} />
            <div style={{ fontSize:12.5, color:'#2D6A4F', lineHeight:1.45 }}>One more step — review the market terms, then submit your application for our team to review.</div>
          </div>
        </div>
      )}

      {/* Step 4 — Market terms */}
      {regStep === 4 && (
        <div style={{ padding:20 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:23, fontWeight:600, color:'#1C1A17' }}>Market terms</div>
          <div style={{ fontSize:13, color:'#6B6560', marginTop:5 }}>Please read all the way to the end, then accept before submitting your application.</div>
          <div style={{ position:'relative', marginTop:18 }}>
            <div ref={termsRef} className="scrollarea" onScroll={handleTermsScroll} style={{ border:'1px solid #efe7dc', background:'#FBF7F1', borderRadius:14, padding:16, maxHeight:300, overflowY:'auto', fontSize:12.5, color:'#4a443e', lineHeight:1.6, whiteSpace:'pre-wrap' }}>
              {content.terms}
            </div>
            {!tcScrolled && (
              <div style={{ position:'absolute', left:1, right:1, bottom:1, height:56, borderRadius:'0 0 13px 13px', background:'linear-gradient(rgba(251,247,241,0),#FBF7F1 78%)', pointerEvents:'none', display:'flex', alignItems:'flex-end', justifyContent:'center', paddingBottom:9 }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#A6364E', color:'#FAF8F5', fontSize:11, fontWeight:600, borderRadius:999, padding:'5px 12px', boxShadow:'0 2px 8px rgba(166,54,78,0.25)' }}>Scroll to read all ↓</span>
              </div>
            )}
          </div>
          {!tcScrolled && <div style={{ fontSize:12, color:'#B7770D', marginTop:9, display:'flex', alignItems:'center', gap:6 }}><Icon name="info" size={14} color="#B7770D" />Scroll through the full terms to unlock acceptance.</div>}
          <div onClick={toggleTc} style={{ display:'flex', alignItems:'flex-start', gap:12, marginTop:14, cursor:'pointer', opacity: tcScrolled ? 1 : 0.5 }}>
            <div style={{ width:22, height:22, borderRadius:6, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:tcAccepted?'#A6364E':'#fff', border:tcAccepted?'none':'1.5px solid #d8c6b2', marginTop:1 }}>
              {tcAccepted && <Icon name="check" size={14} color="#fff" />}
            </div>
            <div style={{ flex:1, fontSize:13, color:'#1C1A17', lineHeight:1.45 }}>I have read and agree to the Sulap Artisan market terms, vendor conduct &amp; cancellation policy.</div>
          </div>
        </div>
      )}

      {/* Footer CTA */}
      <div style={{ padding:'8px 20px 24px' }}>
        <button onClick={next} className="cta" style={{ width:'100%', background:'#A6364E', color:'#FAF8F5', border:'none', fontSize:15, fontWeight:600, borderRadius:13, padding:15, cursor:'pointer', boxShadow:'0 4px 12px rgba(166,54,78,0.22)' }}>
          {regStep < 4 ? 'Continue' : 'Submit application'}
        </button>
      </div>
    </div>
  );
}

const lbl = { display:'block', fontSize:12.5, fontWeight:600, color:'#1C1A17', marginBottom:6 };
const inp = { width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:12, padding:'13px 14px', fontSize:14.5, outline:'none', display:'block' };
