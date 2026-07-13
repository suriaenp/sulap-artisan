import { useState } from 'react';

// Digital Vendor Pass — bi-fold flip card recreated from the Claude Design
// handoff (`Vendor Pass.dc.html`). Tap to unfold: the top flap rotates on
// its top edge to reveal the pass holder's photo, becoming the top half of
// the card; the bottom half (name, vendor, market, valid dates) stays in
// place throughout. Always rendered in the design's own fixed dark/amber
// gradient — like the old physical-pass card before it, this represents a
// physical badge and isn't meant to follow the admin day/night toggle.
export default function DigitalPassCard({ personName, vendorName, marketName, validRange, photo, boothNumber }) {
  const [open, setOpen] = useState(false);
  const photoUrl = photo?.url || null;
  const photoGrad = photo?.grad
    ? `linear-gradient(135deg,${photo.grad[0]},${photo.grad[1]})`
    : 'linear-gradient(135deg,#6B4E33,#3A2210)';

  return (
    <div style={{ position:'relative', width:'100%', maxWidth:340, margin:'0 auto' }}>
      <div onClick={() => setOpen(o => !o)} style={{ position:'relative', cursor:'pointer', paddingTop: open ? 226 : 0, transition:'padding-top 0.7s cubic-bezier(0.45,0,0.2,1)' }}>
        <div style={{ position:'relative', width:'100%', height:226, perspective:1400 }}>

          {/* bottom half — details, always in place */}
          <div style={{
            position:'absolute', inset:0,
            borderRadius: open ? '0 0 20px 20px' : 20,
            overflow:'hidden',
            background:'linear-gradient(175deg,#B97434 0%,#6B3A14 45%,#2A1708 85%,#1D1006 100%)',
            border:'1px solid rgba(255,248,238,0.22)',
            boxShadow:'0 8px 20px rgba(42,23,8,0.22)',
            transition:'border-radius 0.7s cubic-bezier(0.45,0,0.2,1)',
          }}>
            <div style={{ position:'relative', padding:'15px 18px 16px', display:'flex', flexDirection:'column', height:'100%', boxSizing:'border-box' }}>
              <div title={personName} style={{ fontFamily:"'Marcellus',serif", fontSize: (personName||'').length > 16 ? 15 : 19, letterSpacing:'0.03em', color:'#FFF3E2', textTransform:'uppercase', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', lineHeight:1.2 }}>{personName || 'Unnamed pass holder'}</div>
              <div style={{ width:40, height:2, background:'linear-gradient(90deg,#E8A05C,#B97434)', margin:'7px 0 11px' }}/>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flex:1 }}>
                <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', gap:10, minWidth:0 }}>
                  <div>
                    <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'0.16em', color:'#E8A05C', marginBottom:2 }}>VENDOR</div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#FFF8EE' }}>{vendorName}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'0.16em', color:'#E8A05C', marginBottom:2 }}>MARKET</div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#FFF8EE' }}>{marketName}</div>
                  </div>
                  {boothNumber && (
                    <div>
                      <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'0.16em', color:'#E8A05C', marginBottom:2 }}>BOOTH</div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#FFF8EE' }}>No. {boothNumber}</div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'0.16em', color:'#E8A05C', marginBottom:2 }}>VALID</div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#FFF8EE' }}>{validRange}</div>
                  </div>
                </div>
                <img src="/assets/sulap-mark.png" alt="Sulap Artisan" style={{ flex:'0 0 auto', width:76, height:90, objectFit:'contain', filter:'brightness(0) invert(0.94) sepia(0.25)' }}/>
              </div>
            </div>
          </div>

          {/* top flap — folds at the middle */}
          <div style={{ position:'absolute', inset:0, transformOrigin:'top center', transformStyle:'preserve-3d', transition:'transform 0.7s cubic-bezier(0.45,0,0.2,1)', transform: open ? 'rotateX(-180deg)' : 'rotateX(0deg)', zIndex:2 }}>
            {/* front face — cover (visible when folded) */}
            <div style={{ position:'absolute', inset:0, backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden', borderRadius:20, overflow:'hidden', background:'rgba(255,248,238,0.13)', backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)', border:'1px solid rgba(255,248,238,0.32)', boxShadow:'0 8px 20px rgba(0,0,0,0.25)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'16px 18px', boxSizing:'border-box' }}>
              <img src="/assets/sulap-mark.png" alt="Sulap Artisan" style={{ width:36, height:'auto', marginBottom:8, filter:'brightness(0) invert(0.94) sepia(0.25)' }}/>
              <div style={{ fontSize:8.5, fontWeight:700, letterSpacing:'0.2em', color:'rgba(255,243,226,0.75)', marginBottom:8 }}>SULAP ARTISAN · VENDOR PASS</div>
              <div title={personName} style={{ fontFamily:"'Marcellus',serif", fontSize: (personName||'').length > 16 ? 15 : 18, lineHeight:1.2, color:'#FFF3E2', textTransform:'uppercase', letterSpacing:'0.03em', marginBottom:9, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{personName || 'Unnamed pass holder'}</div>
              <div style={{ fontSize:11, color:'#E8A05C', fontWeight:600, marginBottom:8 }}>{marketName}</div>
              {boothNumber && <div style={{ fontSize:13.5, fontWeight:700, color:'#FFF8EE', marginBottom:8 }}>No. {boothNumber}</div>}
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.2em', color:'#E8A05C', marginBottom:3 }}>VALID</div>
              <div style={{ fontSize:12.5, fontWeight:700, color:'#FFF8EE' }}>{validRange}</div>
            </div>
            {/* back face — pass holder's photo (visible when unfolded) */}
            <div style={{ position:'absolute', inset:0, backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden', transform:'rotateX(180deg)', borderRadius:'20px 20px 0 0', overflow:'hidden', background: photoUrl ? '#2A1708' : photoGrad, border:'1px solid rgba(255,248,238,0.28)', borderBottom:'none' }}>
              {photoUrl && <img src={photoUrl} alt={personName} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>}
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(29,16,6,0) 55%, rgba(42,23,8,0.9) 100%)', pointerEvents:'none' }}/>
            </div>
          </div>

        </div>
      </div>
      <div style={{ position:'relative', textAlign:'center', marginTop:9, fontSize:11, letterSpacing:'0.1em', color:'#8A6A4A', textTransform:'uppercase' }}>{open ? 'Tap to fold' : 'Tap to unfold'}</div>
    </div>
  );
}
