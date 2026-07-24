import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { eventStatus } from '../lib/helpers';
import Icon from '../components/Icon';

// "Coming Soon" carousel card sizing — the centered/focused card is bigger
// than the rest, and both scale down on narrow viewports (as a fraction of
// window width, not a fixed px) so neighboring cards stay visibly "peeking"
// on mobile instead of the focus card alone overflowing the screen. Derived
// from window width rather than measured off the DOM, because the card
// widths themselves animate via CSS transition when focus changes — reading
// mid-transition layout geometry to compute the centering offset would give
// stale sizes, so both the render and the offset math use this same
// function as their single source of truth. `focusH` (the same aspect ratio
// the cards render at, applied to the widest/focus card) is used to give the
// track a fixed height — without it, the track/viewport auto-sizes to
// whichever card is currently tallest, so the whole section's height (and
// everything below it) visibly shifts every time the focus card changes.
const CS_ASPECT = 4.15 / 3;
function csSizes(vw) {
  const cardW = Math.round(Math.min(300, Math.max(148, vw * 0.62)));
  const focusW = Math.round(Math.min(348, Math.max(184, vw * 0.74)));
  const focusH = Math.round(focusW * CS_ASPECT);
  const gap = vw < 480 ? 14 : 24;
  return { cardW, focusW, focusH, gap };
}

// Position-specific corner radius + fallback color for the "Why Join" 2x2
// photo grid, kept as static layout constants since they're about shape/
// position, not editable content.
const whyJoinTileStyle = [
  { radius: '28px 80px 28px 28px', fallback: '#E8D3B4' },
  { radius: '80px 28px 28px 28px', fallback: '#DCC49C' },
  { radius: '28px 28px 28px 80px', fallback: '#DCC49C' },
  { radius: '28px 28px 80px 28px', fallback: '#E8D3B4' },
];

// "Our Gallery" marquee — the admin can upload any number of photos (see
// AdminDashboard's Content tab), so tile count isn't fixed and a plain "loop
// the list twice, animate -50%" isn't safe: if a short tile list is narrower
// than the viewport, the doubled track is still narrower than the screen and
// the marquee visibly runs out of tiles into empty space before looping.
// Instead we repeat each row's list enough times that at least one full
// screen-width of content always remains once one list-width has scrolled
// off (`repeatCount`), and animate by exactly one list-width in px (via the
// `--gallery-shift` custom property, read inside the shared keyframe in
// index.css) rather than a fixed -50%, since the loop distance is always one
// list's width regardless of how many times it's repeated for coverage.
const GALLERY_TILE_W = 240;
const GALLERY_TILE_H = 280;
const GALLERY_GAP = 16;
const GALLERY_PX_PER_SEC = 34;

function GalleryRow({ tiles, reverse, windowWidth }) {
  if (!tiles.length) return null;
  const listWidth = tiles.length * (GALLERY_TILE_W + GALLERY_GAP);
  const repeatCount = Math.max(2, Math.ceil(windowWidth / listWidth) + 2);
  const loop = Array.from({ length: repeatCount }, () => tiles).flat();
  const duration = Math.max(8, listWidth / GALLERY_PX_PER_SEC);
  return (
    <div className="gallery-viewport" style={{ overflow: 'hidden' }}>
      <div className={`gallery-track${reverse ? ' gallery-track--reverse' : ''}`} style={{ gap: GALLERY_GAP, animationDuration: `${duration}s`, '--gallery-shift': `-${listWidth}px` }}>
        {loop.map((tile, i) => (
          <div key={`${tile.id}-${i}`} style={{ flex: `0 0 ${GALLERY_TILE_W}px`, height: GALLERY_TILE_H, borderRadius: 12, overflow: 'hidden', backgroundImage: tile.image ? `url(${tile.image})` : 'linear-gradient(135deg, #4A2A0F, #2A1708)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
        ))}
      </div>
    </div>
  );
}

// Renders a heading as plain text, gradient-highlighting the given phrase
// wherever it appears, so admin-edited copy still gets the brand accent.
function highlightPhrase(text = '', phrase) {
  const i = text.indexOf(phrase);
  if (i === -1) return text;
  const before = text.slice(0, i);
  const after = text.slice(i + phrase.length);
  return (
    <>
      {before}
      <span style={{ background: 'linear-gradient(135deg, #B97434, #7A431A)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{phrase}</span>
      {after}
    </>
  );
}

// Hero photo positioning — admin-editable via Content tab sliders (focal
// point X/Y as a percentage, plus zoom) so the admin can choose which part
// of an uploaded photo shows and how tightly cropped it is, since a plain
// `object-fit: cover` always centers and never lets you pick a side. Shared
// with the admin editor's own live preview so the two stay pixel-identical.
export function heroImgStyle(content) {
  const x = content.heroImagePosX ?? 50;
  const y = content.heroImagePosY ?? 50;
  const zoom = content.heroImageZoom ?? 1;
  return {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    objectFit: 'cover', objectPosition: `${x}% ${y}%`,
    transform: zoom !== 1 ? `scale(${zoom})` : undefined,
    transformOrigin: `${x}% ${y}%`,
    WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 65%)',
    maskImage: 'linear-gradient(90deg, transparent 0%, #000 65%)',
  };
}

// "12"/"JUL" for the carousel's date badge — falls back to a TBC placeholder
// for the rare event with no dates set yet.
function dayMonth(dateStr) {
  if (!dateStr) return { day: '--', month: 'TBC' };
  const d = new Date(dateStr);
  return { day: String(d.getDate()), month: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase() };
}

export default function PublicHome() {
  const { state, closeModals, set } = useStore();
  const { content, events, settings } = state;
  const comingSoonViewportRef = useRef(null);
  const [comingSoonOffset, setComingSoonOffset] = useState(0);
  const [windowWidth, setWindowWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1280);
  const isMobile = windowWidth < 720;
  // Below 720px the inline nav + "Vendor Log In" button both disappear with
  // nothing replacing them (Phase 4 mobile audit finding) — this hamburger +
  // slide-down panel is that replacement. Reset on any resize past the
  // breakpoint so rotating a device or resizing a window never leaves it
  // stuck open behind the (now-visible again) inline nav.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => { if (!isMobile) setMobileMenuOpen(false); }, [isMobile]);
  const { cardW: CS_CARD_W, focusW: CS_FOCUS_W, focusH: CS_FOCUS_H, gap: CS_GAP } = csSizes(windowWidth);

  // Oldest-first so past events sit left (greyed) and future events sit right
  // of whichever card is centered. Default center = nearest ongoing, else
  // nearest upcoming, else (everything already concluded) the most recent
  // past event — after that, prev/next or clicking a card moves it, and
  // whichever card is centered is always the highlighted one (see below).
  const comingSoonEvents = [...events]
    .sort((a, b) => (a.startDate ? new Date(a.startDate).getTime() : Infinity) - (b.startDate ? new Date(b.startDate).getTime() : Infinity))
    .map(ev => ({ ...ev, _status: eventStatus(ev) }));
  const comingSoonDefaultIdx = (() => {
    if (!comingSoonEvents.length) return -1;
    const ongoing = comingSoonEvents.findIndex(e => e._status.key === 'ongoing');
    if (ongoing !== -1) return ongoing;
    const upcoming = comingSoonEvents.findIndex(e => e._status.key === 'upcoming');
    if (upcoming !== -1) return upcoming;
    return comingSoonEvents.length - 1;
  })();
  const [comingSoonCenter, setComingSoonCenter] = useState(-1);
  const centerIdx = comingSoonCenter === -1 ? comingSoonDefaultIdx : Math.min(comingSoonCenter, comingSoonEvents.length - 1);
  const showComingSoon = settings.publicEvents !== false && comingSoonEvents.length > 0;

  const comingSoonGo = (dir) => setComingSoonCenter(Math.max(0, Math.min(comingSoonEvents.length - 1, centerIdx + dir)));

  // Slide the track (a transform, not native scrolling) so whichever card is
  // centerIdx sits exactly in the middle of the viewport — smooth and exact
  // regardless of how many cards there are. Card position is computed
  // analytically (every card left of centerIdx is always CS_CARD_W wide,
  // since only one card is ever focused at a time) rather than measured off
  // the DOM, because the cards' own widths are mid-CSS-transition right when
  // centerIdx changes — measuring then would read stale, pre-transition sizes.
  // Re-runs on window resize via the windowWidth state below (which changes
  // CS_CARD_W/CS_FOCUS_W/CS_GAP), so no separate resize listener is needed here.
  useLayoutEffect(() => {
    const viewport = comingSoonViewportRef.current;
    if (!viewport || centerIdx < 0) return;
    const cardLeft = centerIdx * (CS_CARD_W + CS_GAP);
    const cardCenter = cardLeft + CS_FOCUS_W / 2;
    setComingSoonOffset(viewport.clientWidth / 2 - cardCenter);
  }, [centerIdx, comingSoonEvents.length, CS_CARD_W, CS_FOCUS_W, CS_GAP]);

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const goRegister = () => { closeModals(); set({ view:'vendor', vScreen:'register', regStep:1, tcAccepted:false, tcScrolled:false }); };
  const goVendor   = () => { closeModals(); set({ view:'vendor' }); };
  const goAdmin    = () => { closeModals(); set({ view:'admin' }); };

  const navLink = { fontSize: 15, fontWeight: 600, color: '#5C3A1E', textDecoration: 'none' };
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
            {showComingSoon && <a href="#coming-soon" style={navLink}>Coming Soon</a>}
            <a href="#why-join" style={navLink}>Why Join</a>
            <a href="#contact" style={navLink}>Contact</a>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <button onClick={goVendor} style={{ display: isMobile ? 'none' : 'inline-block', padding: '10px 20px', border: '1.5px solid #9A5B26', borderRadius: 999, fontSize: 14, fontWeight: 700, color: '#9A5B26', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap' }}>Vendor Log In</button>
            <button onClick={goRegister} style={{ padding: '10px 22px', border: 'none', borderRadius: 999, fontSize: 14, fontWeight: 700, color: '#FFF8EE', background: 'linear-gradient(135deg, #B97434 0%, #7A431A 100%)', boxShadow: '0 4px 14px rgba(122,67,26,0.35)', cursor: 'pointer', whiteSpace: 'nowrap' }}>Apply as a Vendor</button>
            {isMobile && (
              <button onClick={() => setMobileMenuOpen(o => !o)} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid rgba(154,91,38,0.25)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <Icon name={mobileMenuOpen ? 'x' : 'menu'} size={18} color="#5C3A1E" />
              </button>
            )}
          </div>
        </div>
        {isMobile && mobileMenuOpen && (
          <div style={{ borderTop: '1px solid rgba(154,91,38,0.15)', padding: '10px 24px 20px', display: 'flex', flexDirection: 'column', gap: 2, animation: 'tabIn 0.2s var(--ease-spring)' }}>
            {showComingSoon && <a href="#coming-soon" onClick={() => setMobileMenuOpen(false)} style={{ ...navLink, padding: '12px 4px' }}>Coming Soon</a>}
            <a href="#why-join" onClick={() => setMobileMenuOpen(false)} style={{ ...navLink, padding: '12px 4px' }}>Why Join</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)} style={{ ...navLink, padding: '12px 4px' }}>Contact</a>
            <button onClick={() => { setMobileMenuOpen(false); goVendor(); }} style={{ marginTop: 10, padding: '13px 20px', border: '1.5px solid #9A5B26', borderRadius: 999, fontSize: 14.5, fontWeight: 700, color: '#9A5B26', background: 'transparent', cursor: 'pointer', width: '100%' }}>Vendor Log In</button>
          </div>
        )}
      </section>

      {/* Hero — the photo (when set) is a full-bleed background across the
          whole section, feathered out on the left (mask-image) so it blends
          into the page's own cream background rather than being boxed or
          cropped to a shape; a matching color-gradient overlay sits on top
          of that for text contrast, since the mask alone only controls the
          photo's own transparency, not what's legible over it. No photo set
          falls back to the plain gradient background, same as before. */}
      <section id="hero" style={{ position: 'relative', background: 'linear-gradient(180deg, #F7EFE3 0%, #F1E2CC 100%)', overflow: 'hidden', minHeight: content.heroImage ? 'clamp(440px, 56vw, 600px)' : undefined }}>
        {content.heroImage && (
          <>
            <img src={content.heroImage} alt="" style={heroImgStyle(content)} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #F7EFE3 0%, #F1E2CC 40%, rgba(241,226,204,0) 65%)' }} />
          </>
        )}
        <div style={{ position: 'relative', maxWidth: 1200, margin: '0 auto', padding: '64px 24px 80px' }}>
          <div style={{ maxWidth: 560 }}>
            <h1 style={{ fontFamily: "'Marcellus', serif", fontSize: 'clamp(38px, 5.2vw, 60px)', lineHeight: 1.1, margin: '0 0 20px', color: '#3A2210', fontWeight: 400 }}>
              {highlightPhrase(content.heroTitle, 'Sulap Artisan')}
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: '#6B4E33', margin: '0 0 32px', maxWidth: 480 }}>{content.heroSubtitle}</p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <button onClick={goRegister} style={solidBtn}>Apply as a Vendor</button>
              <button onClick={goVendor} style={outlineBtn}>Vendor Log In</button>
            </div>
          </div>
        </div>
      </section>

      {/* Coming Soon — cards are live events, oldest to newest. The nearest
          upcoming/ongoing one is centered and sized up; past events sit to
          its left, desaturated toward the site's own dark palette (not a
          flat grey) instead of scrubbed to neutral grayscale. */}
      {showComingSoon && (
      <section id="coming-soon" style={{ position: 'relative', background: '#1D1006', overflow: 'hidden', padding: '72px 0 64px' }}>
        <div style={{ position: 'absolute', top: -60, left: -80, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #B97434, #4A2A0F)', opacity: 0.55, filter: 'blur(2px)' }} />
        <div style={{ position: 'absolute', bottom: -70, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #B97434, #4A2A0F)', opacity: 0.5, filter: 'blur(2px)' }} />
        <h2 style={{ position: 'relative', fontFamily: "'Marcellus', serif", fontWeight: 400, fontSize: 'clamp(30px, 4vw, 44px)', letterSpacing: '0.35em', textIndent: '0.35em', color: '#FFF3E2', textAlign: 'center', margin: '0 0 48px' }}>{content.comingSoonHeading}</h2>
        <div style={{ position: 'relative', maxWidth: 1240, margin: '0 auto', padding: '0 6px' }}>
          <div ref={comingSoonViewportRef} className="coming-soon-viewport" style={{ position: 'relative', overflow: 'hidden', padding: '36px 4px 78px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: CS_GAP, height: CS_FOCUS_H, transform: `translateX(${comingSoonOffset}px)`, transition: 'transform 0.5s var(--ease-spring, cubic-bezier(0.2,0.9,0.3,1))', width: 'max-content' }}>
              {comingSoonEvents.map((ev, i) => {
                const isFocus = i === centerIdx;
                const isPast = ev._status.key === 'concluded';
                const isLive = ev._status.key === 'ongoing';
                const { day, month } = dayMonth(ev.startDate);
                return (
                  <div key={ev.id}
                    className={`coming-soon-card${isFocus ? ' coming-soon-card--focus' : ''}`}
                    onClick={() => setComingSoonCenter(i)}
                    style={{
                      position: 'relative', flexBasis: isFocus ? CS_FOCUS_W : CS_CARD_W, flexGrow: 0, flexShrink: 0, aspectRatio: '3 / 4.15',
                      borderRadius: 18, overflow: 'hidden', cursor: isFocus ? 'default' : 'pointer',
                      background: ev.img || 'linear-gradient(180deg, #8A5322, #3A2210)', backgroundSize: 'cover', backgroundPosition: 'center',
                      boxShadow: isFocus ? '0 18px 46px rgba(184,116,52,0.5), 0 0 0 2px #E8A05C' : '0 12px 32px rgba(0,0,0,0.5)',
                      filter: isPast ? 'saturate(0.55) brightness(0.68)' : 'none',
                      opacity: isPast ? 0.85 : 1,
                      zIndex: isFocus ? 2 : 1,
                    }}>
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: isPast
                      ? 'linear-gradient(180deg, rgba(29,16,6,0.35) 25%, rgba(20,11,4,0.94) 100%)'
                      : 'linear-gradient(180deg, rgba(29,16,6,0) 45%, rgba(29,16,6,0.85) 100%)' }} />
                    <div style={{ position: 'absolute', top: isMobile ? 12 : 18, right: isMobile ? 12 : 20, textAlign: 'right', color: '#FFF8EE', pointerEvents: 'none' }}>
                      <div style={{ fontSize: isMobile ? (isFocus ? 30 : 26) : (isFocus ? 44 : 40), fontWeight: 700, lineHeight: 1 }}>{day}</div>
                      <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 700, letterSpacing: '0.12em' }}>{month}</div>
                    </div>
                    <div style={{ position: 'absolute', left: isMobile ? 12 : 20, right: isMobile ? 12 : 20, bottom: isPast ? (isMobile ? 40 : 56) : (isMobile ? 26 : 40), display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: isMobile ? 6 : 10, pointerEvents: 'none' }}>
                      {isLive && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(184,58,46,0.92)', borderRadius: 999, padding: isMobile ? '4px 9px' : '6px 12px', boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#FFF3E2', animation: 'pulseTimer 1.4s ease-in-out infinite' }} />
                          <div style={{ fontSize: isMobile ? 9.5 : 11, fontWeight: 700, letterSpacing: '0.1em', color: '#FFF3E2' }}>LIVE NOW</div>
                        </div>
                      )}
                      <div style={{ color: '#FFF8EE', fontSize: isMobile ? (isFocus ? 14 : 12.5) : (isFocus ? 18 : 16), fontWeight: 700, letterSpacing: '0.05em', lineHeight: 1.4, textTransform: 'uppercase' }}>{ev.name}</div>
                    </div>
                    {isPast && (
                      <div style={{ position: 'absolute', left: isMobile ? 12 : 20, bottom: isMobile ? 10 : 18, fontSize: isMobile ? 9 : 10.5, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,248,238,0.6)', textTransform: 'uppercase', pointerEvents: 'none' }}>Concluded</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <button onClick={() => comingSoonGo(-1)} disabled={centerIdx <= 0} aria-label="Previous" style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', zIndex: 5, width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'rgba(29,16,6,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF3E2', fontSize: 26, cursor: centerIdx <= 0 ? 'default' : 'pointer', opacity: centerIdx <= 0 ? 0.35 : 1, lineHeight: 1, transition: 'opacity 0.25s ease' }}>&#8249;</button>
          <button onClick={() => comingSoonGo(1)} disabled={centerIdx >= comingSoonEvents.length - 1} aria-label="Next" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', zIndex: 5, width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'rgba(29,16,6,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF3E2', fontSize: 26, cursor: centerIdx >= comingSoonEvents.length - 1 ? 'default' : 'pointer', opacity: centerIdx >= comingSoonEvents.length - 1 ? 0.35 : 1, lineHeight: 1, transition: 'opacity 0.25s ease' }}>&#8250;</button>
        </div>
      </section>
      )}

      {/* Why Join */}
      <section id="why-join" style={{ background: '#F7EFE3' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px', display: 'flex', alignItems: 'center', gap: 56, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 380px', minWidth: 300, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {content.whyJoinImages.map((tile, i) => (
              <div key={tile.id} style={{ height: 220, borderRadius: whyJoinTileStyle[i].radius, overflow: 'hidden', backgroundImage: tile.image ? `url(${tile.image})` : 'none', backgroundColor: whyJoinTileStyle[i].fallback, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            ))}
          </div>
          <div style={{ flex: '1 1 420px', minWidth: 300 }}>
            <h2 style={{ fontFamily: "'Marcellus', serif", fontWeight: 400, fontSize: 'clamp(30px, 3.6vw, 40px)', margin: '0 0 12px', color: '#3A2210' }}>
              {highlightPhrase(content.whyJoinTitle, 'Why join')}
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: '#6B4E33', margin: '0 0 32px' }}>{content.whyJoinSubtitle}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {content.whyJoinItems.map((item, i) => (
                <div key={item.id} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
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

      {/* Our Gallery — continuously auto-scrolling, top row right-to-left,
          bottom row left-to-right (see GalleryRow above + .gallery-track in
          index.css). Not a manual scroller, so there's nothing to swipe. */}
      {content.galleryImages.length > 0 && (
      <section id="gallery" style={{ position: 'relative', background: '#1D1006', padding: '64px 0', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -60, left: -80, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #B97434, #4A2A0F)', opacity: 0.55, filter: 'blur(2px)' }} />
        <div style={{ position: 'absolute', bottom: -70, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #B97434, #4A2A0F)', opacity: 0.5, filter: 'blur(2px)' }} />
        <h2 style={{ position: 'relative', fontFamily: "'Marcellus', serif", fontWeight: 400, fontSize: 'clamp(28px, 3.6vw, 40px)', letterSpacing: '0.35em', textIndent: '0.35em', color: '#FFF3E2', textAlign: 'center', margin: '0 0 44px' }}>{content.galleryHeading}</h2>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <GalleryRow tiles={content.galleryImages.filter((_, i) => i % 2 === 0)} windowWidth={windowWidth} />
          <GalleryRow tiles={content.galleryImages.filter((_, i) => i % 2 === 1)} reverse windowWidth={windowWidth} />
        </div>
      </section>
      )}

      {/* CTA */}
      <section style={{ background: '#F1E2CC', padding: '80px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', background: 'linear-gradient(135deg, #B97434 0%, #7A431A 100%)', borderRadius: 28, padding: 'clamp(40px, 6vw, 64px)', textAlign: 'center', boxShadow: '0 16px 40px rgba(122,67,26,0.35)' }}>
          <h2 style={{ fontFamily: "'Marcellus', serif", fontWeight: 400, fontSize: 'clamp(28px, 4vw, 42px)', color: '#FFF8EE', margin: '0 0 14px' }}>{content.ctaTitle}</h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: 'rgba(255,248,238,0.85)', margin: '0 auto 32px', maxWidth: 520 }}>{content.ctaSubtitle}</p>
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
            <p style={{ fontSize: 14, lineHeight: 1.65, color: 'rgba(233,213,184,0.8)', margin: 0, maxWidth: 350 }}>{content.footerDescription}</p>
          </div>
          <div style={{ flex: '0 1 200px', minWidth: 160 }}>
            <div style={{ fontFamily: "'Marcellus', serif", fontSize: 17, color: '#FFF3E2', marginBottom: 16 }}>Vendors</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="#" onClick={e => { e.preventDefault(); goRegister(); }} style={{ fontSize: 14, color: 'rgba(233,213,184,0.85)', cursor: 'pointer', textDecoration: 'none' }}>Apply as a Vendor</a>
              <a href="#" onClick={e => { e.preventDefault(); goVendor(); }} style={{ fontSize: 14, color: 'rgba(233,213,184,0.85)', cursor: 'pointer', textDecoration: 'none' }}>Vendor Log In</a>
              {showComingSoon && <a href="#coming-soon" style={{ fontSize: 14, color: 'rgba(233,213,184,0.85)', textDecoration: 'none' }}>Coming Soon</a>}
              <a href="#" onClick={e => { e.preventDefault(); goAdmin(); }} style={{ fontSize: 14, color: 'rgba(233,213,184,0.85)', cursor: 'pointer', textDecoration: 'none' }}>Admin</a>
            </div>
          </div>
          <div style={{ flex: '0 1 280px', minWidth: 220 }}>
            <div style={{ fontFamily: "'Marcellus', serif", fontSize: 17, color: '#FFF3E2', marginBottom: 16 }}>Visit Us</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(233,213,184,0.85)' }}>
              {content.footerAddress.split('\n').map((line, i, arr) => (
                <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 1200, margin: '40px auto 0', paddingTop: 20, borderTop: '1px solid rgba(233,213,184,0.2)', fontSize: 13, color: 'rgba(233,213,184,0.6)', textAlign: 'center' }}>{content.footerCopyright}</div>
      </section>
    </div>
  );
}
