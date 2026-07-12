import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';

const whyJoin = [
  { title: 'Prime mall location', body: 'Trade in the heart of Kota Kinabalu with steady daily footfall.' },
  { title: 'Simple online application', body: 'Apply in minutes and track your application from the vendor portal.' },
  { title: 'Curated maker community', body: 'Stand alongside quality Sabahan crafts, food, and design.' },
  { title: 'Flexible booth rates', body: 'Daily rates for F&B and non-F&B booths — pay only for the days you trade.' },
];

const galleryTiles = [1, 2, 3, 4, 5, 6, 7, 8];

// Renders the hero title as plain text, gradient-highlighting "Sulap Artisan"
// wherever it appears so admin-edited copy still gets the brand accent.
function heroTitleParts(title = '') {
  const i = title.indexOf('Sulap Artisan');
  if (i === -1) return title;
  const before = title.slice(0, i);
  const after = title.slice(i + 'Sulap Artisan'.length);
  return (
    <>
      {before}
      <span style={{ background: 'linear-gradient(135deg, #B97434, #7A431A)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Sulap Artisan</span>
      {after}
    </>
  );
}

export default function PublicHome() {
  const { state, closeModals, set } = useStore();
  const { content } = state;
  const railRef = useRef(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 720);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 720);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const goRegister = () => { closeModals(); set({ view:'vendor', vScreen:'register', regStep:1, tcAccepted:false, tcScrolled:false }); };
  const goVendor   = () => { closeModals(); set({ view:'vendor' }); };
  const goAdmin    = () => { closeModals(); set({ view:'admin' }); };

  const scrollRail = (dir, wrap) => {
    const rail = railRef.current;
    if (!rail) return;
    const step = 344;
    if (wrap && rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 8) {
      rail.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }
    rail.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  const navLink = { fontSize: 15, fontWeight: 600, color: '#5C3A1E' };
  const outlineBtn = { padding: '15px 32px', borderRadius: 999, fontSize: 16, fontWeight: 700, color: '#9A5B26', border: '1.5px solid #9A5B26', cursor: 'pointer', background: 'transparent' };
  const solidBtn = { padding: '15px 32px', borderRadius: 999, fontSize: 16, fontWeight: 700, color: '#FFF8EE', background: 'linear-gradient(135deg, #B97434 0%, #7A431A 100%)', boxShadow: '0 6px 20px rgba(122,67,26,0.4)', border: 'none', cursor: 'pointer' };

  return (
    <div style={{ background: '#F7EFE3', fontFamily: "'Karla', sans-serif", color: '#3A2210' }}>
      {/* Header */}
      <section style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(247,239,227,0.92)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(154,91,38,0.15)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <a href="#hero" style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <img src="/assets/sulap-lockup.png" alt="Sulap Artisan by Suria Sabah Shopping Mall" style={{ height: 46, width: 'auto', display: 'block', maxWidth: '100%', objectFit: 'contain' }} />
          </a>
          <nav style={{ display: isMobile ? 'none' : 'flex', alignItems: 'center', gap: 28 }}>
            <a href="#coming-soon" style={navLink}>Coming Soon</a>
            <a href="#why-join" style={navLink}>Why Join</a>
            <a href="#contact" style={navLink}>Contact</a>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <button onClick={goVendor} style={{ display: isMobile ? 'none' : 'inline-block', padding: '10px 20px', border: '1.5px solid #9A5B26', borderRadius: 999, fontSize: 14, fontWeight: 700, color: '#9A5B26', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap' }}>Vendor Log In</button>
            <button onClick={goRegister} style={{ padding: '10px 22px', border: 'none', borderRadius: 999, fontSize: 14, fontWeight: 700, color: '#FFF8EE', background: 'linear-gradient(135deg, #B97434 0%, #7A431A 100%)', boxShadow: '0 4px 14px rgba(122,67,26,0.35)', cursor: 'pointer', whiteSpace: 'nowrap' }}>Apply as a Vendor</button>
          </div>
        </div>
      </section>

      {/* Hero */}
      <section id="hero" style={{ background: 'linear-gradient(180deg, #F7EFE3 0%, #F1E2CC 100%)', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px 80px', display: 'flex', alignItems: 'center', gap: 48, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 420px', minWidth: 300 }}>
            <h1 style={{ fontFamily: "'Marcellus', serif", fontSize: 'clamp(38px, 5.2vw, 60px)', lineHeight: 1.1, margin: '0 0 20px', color: '#3A2210', fontWeight: 400 }}>
              {heroTitleParts(content.heroTitle)}
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: '#6B4E33', margin: '0 0 32px', maxWidth: 480 }}>{content.heroSubtitle}</p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <button onClick={goRegister} style={solidBtn}>Apply as a Vendor</button>
              <button onClick={goVendor} style={outlineBtn}>Vendor Log In</button>
            </div>
          </div>
          <div style={{ flex: '1 1 360px', minWidth: 300, display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: 'min(400px, 88vw)', height: 'min(400px, 88vw)' }}>
              <div style={{ position: 'absolute', inset: -14, border: '2px dashed rgba(154,91,38,0.5)', borderRadius: '50%' }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden', background: content.heroImage ? '#E8D3B4' : 'linear-gradient(135deg, #E8D3B4, #D9BB8E)' }}>
                {content.heroImage && <img src={content.heroImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
              </div>
              <div style={{ position: 'absolute', top: '8%', right: '-4%', background: '#FFF8EE', borderRadius: 14, padding: '10px 16px', boxShadow: '0 8px 24px rgba(90,55,20,0.18)', fontSize: 14, fontWeight: 700, color: '#7A431A' }}>{content.heroTag1}</div>
              <div style={{ position: 'absolute', bottom: '10%', left: '-6%', background: '#FFF8EE', borderRadius: 14, padding: '10px 16px', boxShadow: '0 8px 24px rgba(90,55,20,0.18)', fontSize: 14, fontWeight: 700, color: '#7A431A' }}>{content.heroTag2}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Coming Soon */}
      <section id="coming-soon" style={{ position: 'relative', background: '#1D1006', overflow: 'hidden', padding: '72px 0 64px' }}>
        <div style={{ position: 'absolute', top: -60, left: -80, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #B97434, #4A2A0F)', opacity: 0.55, filter: 'blur(2px)' }} />
        <div style={{ position: 'absolute', bottom: -70, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #B97434, #4A2A0F)', opacity: 0.5, filter: 'blur(2px)' }} />
        <h2 style={{ position: 'relative', fontFamily: "'Marcellus', serif", fontWeight: 400, fontSize: 'clamp(30px, 4vw, 44px)', letterSpacing: '0.35em', textIndent: '0.35em', color: '#FFF3E2', textAlign: 'center', margin: '0 0 48px' }}>{content.comingSoonHeading}</h2>
        <div style={{ position: 'relative', maxWidth: 1240, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px' }}>
          <button onClick={() => scrollRail(-1)} aria-label="Previous" style={{ flex: '0 0 auto', width: 48, height: 48, border: 'none', background: 'transparent', color: '#FFF3E2', fontSize: 30, cursor: 'pointer', lineHeight: 1 }}>&#8249;</button>
          <div ref={railRef} style={{ flex: 1, display: 'flex', gap: 24, overflowX: 'auto', scrollSnapType: 'x mandatory', padding: '8px 4px 20px', scrollbarWidth: 'none' }}>
            {content.comingSoonEvents.map(ev => (
              <div key={ev.id} style={{ position: 'relative', flex: '0 0 320px', height: 440, borderRadius: 18, overflow: 'hidden', scrollSnapAlign: 'start', background: ev.image ? undefined : 'linear-gradient(180deg, #8A5322, #3A2210)', backgroundImage: ev.image ? `url(${ev.image})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(29,16,6,0) 45%, rgba(29,16,6,0.85) 100%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: 18, right: 20, textAlign: 'right', color: '#FFF8EE', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1 }}>{ev.day}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.12em' }}>{ev.month}</div>
                </div>
                <div style={{ position: 'absolute', left: 20, bottom: 40, color: '#FFF8EE', fontSize: 16, fontWeight: 700, letterSpacing: '0.05em', lineHeight: 1.5, textTransform: 'uppercase', pointerEvents: 'none' }}>
                  {ev.name.split(' ').map((w, i, arr) => i === arr.length - 1 ? w : <span key={i}>{w} </span>)}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => scrollRail(1, true)} aria-label="Next" style={{ flex: '0 0 auto', width: 48, height: 48, border: 'none', background: 'transparent', color: '#FFF3E2', fontSize: 30, cursor: 'pointer', lineHeight: 1 }}>&#8250;</button>
        </div>
      </section>

      {/* Why Join */}
      <section id="why-join" style={{ background: '#F7EFE3' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px', display: 'flex', alignItems: 'center', gap: 56, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 380px', minWidth: 300, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ height: 220, borderRadius: '28px 80px 28px 28px', background: '#E8D3B4' }} />
            <div style={{ height: 220, borderRadius: '80px 28px 28px 28px', background: '#DCC49C' }} />
            <div style={{ height: 220, borderRadius: '28px 28px 28px 80px', background: '#DCC49C' }} />
            <div style={{ height: 220, borderRadius: '28px 28px 80px 28px', background: '#E8D3B4' }} />
          </div>
          <div style={{ flex: '1 1 420px', minWidth: 300 }}>
            <h2 style={{ fontFamily: "'Marcellus', serif", fontWeight: 400, fontSize: 'clamp(30px, 3.6vw, 40px)', margin: '0 0 12px', color: '#3A2210' }}>
              <span style={{ background: 'linear-gradient(135deg, #B97434, #7A431A)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Why join</span> Sulap Artisan?
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: '#6B4E33', margin: '0 0 32px' }}>A market platform built for local makers, run by Suria Sabah Shopping Mall.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {whyJoin.map((item, i) => (
                <div key={item.title} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ flex: '0 0 48px', width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #B97434, #7A431A)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF8EE', fontFamily: "'Marcellus', serif", fontSize: 20 }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontSize: 15, lineHeight: 1.55, color: '#6B4E33' }}>{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Our Gallery */}
      <section id="gallery" style={{ background: '#1D1006', padding: '64px 0' }}>
        <h2 style={{ fontFamily: "'Marcellus', serif", fontWeight: 400, fontSize: 'clamp(28px, 3.6vw, 40px)', letterSpacing: '0.35em', textIndent: '0.35em', color: '#FFF3E2', textAlign: 'center', margin: '0 0 44px' }}>OUR GALLERY</h2>
        <div style={isMobile
          ? { display: 'flex', gap: 14, overflowX: 'auto', scrollSnapType: 'x mandatory', padding: '0 16px 12px', scrollbarWidth: 'none' }
          : { maxWidth: 1240, margin: '0 auto', padding: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: 280, gap: 14 }
        }>
          {galleryTiles.map(n => (
            <div key={n} style={{ borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(135deg, #4A2A0F, #2A1708)', scrollSnapAlign: 'start', minWidth: 0, flex: '0 0 78vw', maxWidth: 300, height: 280 }} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: '#F1E2CC', padding: '80px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', background: 'linear-gradient(135deg, #B97434 0%, #7A431A 100%)', borderRadius: 28, padding: 'clamp(40px, 6vw, 64px)', textAlign: 'center', boxShadow: '0 16px 40px rgba(122,67,26,0.35)' }}>
          <h2 style={{ fontFamily: "'Marcellus', serif", fontWeight: 400, fontSize: 'clamp(28px, 4vw, 42px)', color: '#FFF8EE', margin: '0 0 14px' }}>Ready to showcase your craft?</h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: 'rgba(255,248,238,0.85)', margin: '0 auto 32px', maxWidth: 520 }}>Applications for upcoming markets are open now. Join the Sulap Artisan vendor community today.</p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={goRegister} style={{ padding: '15px 32px', borderRadius: 999, fontSize: 16, fontWeight: 700, color: '#7A431A', background: '#FFF8EE', border: 'none', cursor: 'pointer' }}>Apply as a Vendor</button>
            <button onClick={goVendor} style={{ padding: '15px 32px', borderRadius: 999, fontSize: 16, fontWeight: 700, color: '#FFF8EE', border: '1.5px solid rgba(255,248,238,0.7)', background: 'transparent', cursor: 'pointer' }}>Vendor Log In</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <section id="contact" style={{ background: '#2A1708', color: '#E9D5B8', padding: '56px 24px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 48, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 300px', minWidth: 260 }}>
            <img src="/assets/sulap-lockup.png" alt="Sulap Artisan" style={{ height: 73, width: 'auto', display: 'block', marginBottom: 18 }} />
            <p style={{ fontSize: 14, lineHeight: 1.65, color: 'rgba(233,213,184,0.8)', margin: 0, maxWidth: 350 }}>Sulap Artisan is a curated artisan market series by Suria Sabah Shopping Mall, celebrating Sabahan craft, food, and culture.</p>
          </div>
          <div style={{ flex: '0 1 200px', minWidth: 160 }}>
            <div style={{ fontFamily: "'Marcellus', serif", fontSize: 17, color: '#FFF3E2', marginBottom: 16 }}>Vendors</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="#" onClick={e => { e.preventDefault(); goRegister(); }} style={{ fontSize: 14, color: 'rgba(233,213,184,0.85)', cursor: 'pointer' }}>Apply as a Vendor</a>
              <a href="#" onClick={e => { e.preventDefault(); goVendor(); }} style={{ fontSize: 14, color: 'rgba(233,213,184,0.85)', cursor: 'pointer' }}>Vendor Log In</a>
              <a href="#coming-soon" style={{ fontSize: 14, color: 'rgba(233,213,184,0.85)' }}>Coming Soon</a>
              <a href="#" onClick={e => { e.preventDefault(); goAdmin(); }} style={{ fontSize: 14, color: 'rgba(233,213,184,0.85)', cursor: 'pointer' }}>Admin</a>
            </div>
          </div>
          <div style={{ flex: '0 1 280px', minWidth: 220 }}>
            <div style={{ fontFamily: "'Marcellus', serif", fontSize: 17, color: '#FFF3E2', marginBottom: 16 }}>Visit Us</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(233,213,184,0.85)' }}>Suria Sabah Shopping Mall<br />1, Jalan Tun Fuad Stephens<br />88000 Kota Kinabalu, Sabah</div>
          </div>
        </div>
        <div style={{ maxWidth: 1200, margin: '40px auto 0', paddingTop: 20, borderTop: '1px solid rgba(233,213,184,0.2)', fontSize: 13, color: 'rgba(233,213,184,0.6)', textAlign: 'center' }}>© 2026 Sulap Artisan · Suria Sabah Shopping Mall. All rights reserved.</div>
      </section>
    </div>
  );
}
