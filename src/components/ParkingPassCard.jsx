import { useState, useEffect } from 'react';

// Digital Parking Pass — bi-fold flip card recreated from the Claude Design
// handoff (`Parking Pass.dc.html`). One card per event day. Tap to unfold:
// the top flap rotates on its top edge to reveal market/vehicle/vendor
// details, becoming the top half of the card; the bottom half (validity,
// live "time left to exit" countdown, barcode + serial) stays in place
// throughout. Always rendered in the design's own fixed dark/amber and
// cream gradient — like DigitalPassCard, this represents a physical pass
// and isn't meant to follow any day/night toggle. No decorative corner glow
// (see DigitalPassCard's fix note — it used to bleed outside the card into
// the surrounding grid/tab header).
export default function ParkingPassCard({ vendorName, plateNumber, marketName, dateFromLabel, dateToLabel, validDateLabel, validYear, dayNumber, untilTimeLabel, validUntilISO, serial }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const bars = [];
  for (let i = 0; i < (serial || '').length; i++) {
    const c = serial.charCodeAt(i);
    bars.push({ w: 1 + (c % 3) }, { w: 1 + ((c >> 2) % 4) }, { w: 1 + ((c >> 4) % 2) });
  }
  const stripText = (`${(marketName || '').toUpperCase()} · `).repeat(6);
  const until = new Date(validUntilISO).getTime();
  const diff = Math.max(0, until - now);
  const hh = Math.floor(diff / 3600000), mm = Math.floor(diff / 60000) % 60, ss = Math.floor(diff / 1000) % 60;
  const pad = n => String(n).padStart(2, '0');
  const timeLeft = diff === 0 ? 'EXPIRED' : (hh > 0 ? pad(hh) + ':' : '') + pad(mm) + ':' + pad(ss);
  const vendorNameSize = (vendorName || '').length > 16 ? 17 : 22;
  const plateSize = (plateNumber || '').length > 11 ? 32 : 40;

  const labelStyle = { fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(255,243,226,0.75)', marginBottom: 2 };
  const valueStyle = { fontFamily: "'Marcellus',serif", fontSize: 24, color: '#FFF3E2', lineHeight: 1.1 };
  const pBadge = (size = 26) => ({ width: size, height: size, border: '2px solid #FFF3E2', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size - 9, fontWeight: 700, color: '#FFF3E2', boxSizing: 'border-box', flexShrink: 0 });
  const stripStyle = { background: 'linear-gradient(90deg, #7A431A 0%, #C98A4A 45%, rgba(255,243,226,0.85) 100%)', padding: '8px 0', textAlign: 'center' };
  const stripTextStyle = { fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', color: '#FFF3E2', whiteSpace: 'nowrap', overflow: 'hidden', textShadow: '0 1px 2px rgba(58,34,16,0.45)' };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 360, margin: '0 auto' }}>
      <div onClick={() => setOpen(o => !o)} style={{ position: 'relative', cursor: 'pointer', paddingTop: open ? 360 : 0, transition: 'padding-top 1.1s cubic-bezier(0.34,1.1,0.3,1)' }}>
        <div style={{ position: 'relative', width: '100%', height: 360, perspective: 1700 }}>

          {/* ============ BOTTOM HALF: VALIDITY + BARCODE ============ */}
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: open ? '0 0 24px 24px' : 24,
            overflow: 'hidden',
            background: '#EDE1D3',
            border: '1px solid rgba(255,248,238,0.45)',
            borderTop: 'none',
            boxShadow: '0 10px 26px rgba(42,23,8,0.22)',
            transition: 'border-radius 1.1s cubic-bezier(0.34,1.1,0.3,1)',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div style={{ padding: '16px 22px 0', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{ flex: 1, maxWidth: 160, background: 'rgba(185,116,52,0.1)', border: '1px solid rgba(185,116,52,0.3)', borderRadius: 12, padding: '10px 8px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: '#9A5B26', marginBottom: 3 }}>VALID DATE</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#3A2210' }}>{validDateLabel} {validYear}</div>
                </div>
                <div style={{ flex: 1, maxWidth: 150, background: 'rgba(185,116,52,0.1)', border: '1px solid rgba(185,116,52,0.3)', borderRadius: 12, padding: '10px 8px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: '#9A5B26', marginBottom: 3 }}>UNTIL</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#3A2210' }}>{untilTimeLabel}</div>
                </div>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1D1006', borderRadius: 999, padding: '8px 20px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E8A05C', animation: 'pulseTimer 1.6s ease-in-out infinite' }}/>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(255,243,226,0.7)' }}>TIME LEFT TO EXIT</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#FFF3E2', fontVariantNumeric: 'tabular-nums', minWidth: 76, textAlign: 'left' }}>{timeLeft}</div>
              </div>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', margin: '12px 0 0' }}>
              <div style={{ width: 14, height: 28, background: '#2A1708', borderRadius: '0 14px 14px 0', opacity: 0.16 }}/>
              <div style={{ flex: 1, borderTop: '2px dashed rgba(122,67,26,0.35)' }}/>
              <div style={{ width: 14, height: 28, background: '#2A1708', borderRadius: '14px 0 0 14px', opacity: 0.16 }}/>
            </div>
            <div style={{ padding: '8px 22px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: '#9A5B26', marginBottom: 8 }}>VALID FOR ONE ENTRY PER DAY ONLY</div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 2, height: 46, marginBottom: 6 }}>
                {bars.map((bar, i) => <div key={i} style={{ width: bar.w, height: 46, background: '#2A1708' }}/>)}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.4em', color: '#3A2210', marginBottom: 12 }}>{serial}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#9A5B26', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#FFF3E2' }}>P</span>
                </div>
                <div style={{ width: 1, height: 26, background: 'rgba(122,67,26,0.25)' }}/>
                <img src="/assets/suria-sabah-logo.png" alt="Suria Sabah" style={{ height: 30, width: 'auto', objectFit: 'contain' }}/>
              </div>
            </div>
          </div>

          {/* ============ TOP FLAP ============ */}
          <div style={{ position: 'absolute', inset: 0, transformOrigin: 'top center', transformStyle: 'preserve-3d', transition: 'transform 1.1s cubic-bezier(0.34,1.1,0.3,1)', transform: open ? 'rotateX(-180deg)' : 'rotateX(0deg)', zIndex: 2 }}>

            {/* front face: fold cover */}
            <div style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
              borderRadius: 24, overflow: 'hidden',
              background: 'linear-gradient(135deg, #E8A05C 0%, #B97434 40%, #7A431A 100%)',
              border: '1px solid rgba(255,248,238,0.4)',
              boxShadow: '0 10px 26px rgba(42,23,8,0.22)',
              display: 'flex', flexDirection: 'column',
              visibility: open ? 'hidden' : 'visible',
              transition: 'visibility 0s 0.28s',
            }}>
              <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 }}>
                <div style={{ position: 'absolute', top: 16, left: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={pBadge()}>P</div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', color: '#FFF3E2' }}>PARKING PASS</div>
                </div>
                <img src="/assets/sulap-lockup.png" alt="Sulap Artisan" style={{ position: 'relative', width: '78%', height: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}/>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 28 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={labelStyle}>FOR THE DATE</div>
                    <div style={valueStyle}>{validDateLabel}</div>
                  </div>
                  <div style={{ width: 1, height: 34, background: 'rgba(255,243,226,0.35)' }}/>
                  <div style={{ textAlign: 'center' }}>
                    <div style={labelStyle}>DAY</div>
                    <div style={valueStyle}>{dayNumber}</div>
                  </div>
                </div>
              </div>
              <div style={stripStyle}><div style={stripTextStyle}>{stripText}</div></div>
            </div>

            {/* back face: pass top */}
            <div style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateX(180deg)',
              borderRadius: open ? '24px 24px 0 0' : 24,
              overflow: 'hidden',
              background: 'rgba(255,248,238,0.88)',
              border: '1px solid rgba(255,248,238,0.45)',
              borderBottom: 'none',
              display: 'flex', flexDirection: 'column',
              visibility: open ? 'visible' : 'hidden',
              transition: 'visibility 0s 0.28s, border-radius 1.1s cubic-bezier(0.34,1.1,0.3,1)',
            }}>
              <div style={{ position: 'relative', height: 170, background: 'linear-gradient(135deg, #E8A05C 0%, #B97434 40%, #7A431A 100%)', overflow: 'hidden', flex: '0 0 auto' }}>
                <div style={{ position: 'absolute', top: -29, left: -6, fontFamily: "'Marcellus',serif", fontSize: 96, letterSpacing: '0.02em', color: 'rgba(255,243,226,0.2)', lineHeight: 1, whiteSpace: 'nowrap' }}>SULAP</div>
                <img src="/assets/sulap-lockup.png" alt="Sulap Artisan" style={{ position: 'absolute', bottom: 14, right: 8, width: '62%', height: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.32 }}/>
                <div style={{ position: 'absolute', top: 14, left: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={pBadge()}>P</div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', color: '#FFF3E2' }}>PARKING PASS</div>
                </div>
                <div style={{ position: 'absolute', top: 42, right: 20, textAlign: 'right' }}>
                  <div style={labelStyle}>MARKET STARTS</div>
                  <div style={valueStyle}>{dateFromLabel}</div>
                </div>
                <div style={{ position: 'absolute', bottom: 16, left: 20 }}>
                  <div style={labelStyle}>MARKET ENDS</div>
                  <div style={valueStyle}>{dateToLabel}</div>
                </div>
              </div>
              <div style={{ ...stripStyle, padding: '7px 0', flex: '0 0 auto' }}><div style={stripTextStyle}>{stripText}</div></div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px 22px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.26em', color: '#9A5B26', marginBottom: 4 }}>VEHICLE NUMBER</div>
                <div style={{ fontFamily: "'Marcellus',serif", fontSize: plateSize, letterSpacing: '0.12em', lineHeight: 1, background: 'linear-gradient(135deg, #B97434, #7A431A)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', marginBottom: 14, whiteSpace: 'nowrap' }}>{plateNumber}</div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', color: '#9A5B26', marginBottom: 4 }}>VENDOR</div>
                <div title={vendorName} style={{ fontFamily: "'Marcellus',serif", fontSize: vendorNameSize, letterSpacing: '0.06em', color: '#3A2210', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{vendorName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, width: '70%' }}>
                  <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, transparent, #B97434)' }}/>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#B97434' }}/>
                  <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, #B97434, transparent)' }}/>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
      <div style={{ position: 'relative', textAlign: 'center', marginTop: 9, fontSize: 11, letterSpacing: '0.1em', color: '#8A6A4A', textTransform: 'uppercase' }}>{open ? 'Tap to fold' : 'Tap to unfold'}</div>
    </div>
  );
}
