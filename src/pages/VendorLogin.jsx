import { useState } from 'react';
import Icon from '../components/Icon';
import PasswordInput from '../components/PasswordInput';
import { useStore } from '../lib/store';
import { DEMO_VENDOR_PASSWORD } from '../data/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const inp = { width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:13, padding:'14px 15px', fontSize:15, color:'#1C1A17', outline:'none' };
const lbl = { fontSize:12.5, fontWeight:600, color:'#1C1A17', marginBottom:7 };

export default function VendorLogin() {
  const { state, set, showToast } = useStore();
  const [mode, setMode] = useState('login'); // 'login' | 'forgot' | 'sent'
  const [resetEmail, setResetEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Wrong email and wrong password always share one generic message — no
  // account enumeration. Status-specific messages only appear after
  // credentials actually match.
  const login = async () => {
    if (isSupabaseConfigured) {
      if (!email.trim() || !password) { showToast('Enter your email and password', 'info'); return; }
      showToast('Signing you in…', 'clock');
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) showToast("Email or password doesn't match our records", 'lock');
      // On success the store's global session listener (store.jsx) takes over:
      // it fetches this vendor's row, applies the status gate below, and
      // routes to the dashboard — so that logic lives in exactly one place.
      return;
    }
    // Mock mode (no Supabase configured) — unchanged Phase 1 behavior.
    const me = state.vendors.find(v => (v.email || '').toLowerCase() === email.trim().toLowerCase());
    if (!me || (me.password || DEMO_VENDOR_PASSWORD) !== password) {
      showToast("Email or password doesn't match our records", 'lock');
      return;
    }
    if (me.status === 'pending') {
      showToast("Your application is still under review — we'll email you once you're approved", 'lock');
      return;
    }
    if (me.status === 'rejected') {
      showToast('Your vendor application was not approved. Contact Sulap Artisan for details.', 'lock');
      return;
    }
    if (me.status === 'suspended') {
      showToast('Your vendor account is suspended. Contact Sulap Artisan for details.', 'lock');
      return;
    }
    set({ vScreen:'dashboard', vTab:'events', currentVendorId: me.id });
    showToast('Signed in to your portal', 'bag');
  };

  const sendReset = () => {
    if (!resetEmail.trim() || !resetEmail.includes('@')) { showToast('Enter a valid email address', 'info'); return; }
    setMode('sent');
  };

  const backToLogin = () => { setMode('login'); setResetEmail(''); };

  if (mode === 'forgot') {
    return (
      <div>
        <img src="/assets/sulap-lockup.png" alt="Sulap Artisan" style={{ width:180, height:'auto', display:'block', marginBottom:22 }} />
        <div style={{ fontFamily:"'Marcellus',serif", fontSize:24, fontWeight:400, color:'#1C1A17' }}>Reset your password</div>
        <div style={{ fontSize:13.5, color:'#6B6560', marginTop:6, lineHeight:1.5 }}>Enter the email you registered with. We'll send a reset link — this is a demo flow, no email actually goes out.</div>
        <div style={{ marginTop:22 }}>
          <div style={lbl}>Email address</div>
          <input type="email" value={resetEmail} onChange={e=>setResetEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendReset()} placeholder="you@email.com" style={inp} autoFocus />
        </div>
        <button onClick={sendReset} className="cta" style={{ marginTop:20, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:15, fontWeight:600, borderRadius:13, padding:15, cursor:'pointer', width:'100%' }}>Send reset link</button>
        <button onClick={backToLogin} style={{ marginTop:14, background:'none', border:'none', color:'#6B6560', fontSize:13, fontWeight:600, cursor:'pointer' }}>‹ Back to sign in</button>
      </div>
    );
  }

  if (mode === 'sent') {
    return (
      <div style={{ textAlign:'center' }}>
        <div style={{ width:56, height:56, borderRadius:'50%', background:'#EAF4EE', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px' }}>
          <Icon name="mail" size={26} color="#2D6A4F" />
        </div>
        <div style={{ fontFamily:"'Marcellus',serif", fontSize:22, fontWeight:400, color:'#1C1A17' }}>Check your email</div>
        <div style={{ fontSize:13.5, color:'#6B6560', marginTop:8, lineHeight:1.55 }}>If an account exists for <b style={{ color:'#1C1A17' }}>{resetEmail}</b>, reset instructions are on the way (demo — nothing was actually sent).</div>
        <button onClick={backToLogin} className="cta" style={{ marginTop:22, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:15, fontWeight:600, borderRadius:13, padding:15, cursor:'pointer', width:'100%' }}>‹ Back to sign in</button>
      </div>
    );
  }

  return (
    <div>
      <img src="/assets/sulap-lockup.png" alt="Sulap Artisan" style={{ width:180, height:'auto', display:'block', marginBottom:22 }} />
      <div style={{ fontFamily:"'Marcellus',serif", fontSize:24, fontWeight:400, color:'#1C1A17' }}>Welcome Back!</div>
      <div style={{ fontSize:13.5, color:'#6B6560', marginTop:6, lineHeight:1.5 }}>Sign in with your email address and password to reach your vendor portal.</div>
      <div style={{ marginTop:22, display:'flex', flexDirection:'column', gap:16 }}>
        <div>
          <div style={lbl}>Email address</div>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" style={inp} />
        </div>
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
            <div style={{ ...lbl, marginBottom:0 }}>Password</div>
            <span onClick={()=>setMode('forgot')} style={{ fontSize:12, fontWeight:600, color:'#9A5B26', cursor:'pointer' }}>Forgot password?</span>
          </div>
          <PasswordInput value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} placeholder="••••••••" style={inp} />
        </div>
        <div style={{ display:'flex', gap:9, alignItems:'flex-start', background:'#FEF8EC', border:'1px solid #f3e6c9', borderRadius:11, padding:'11px 13px', fontSize:12, color:'#B7770D', lineHeight:1.4 }}>
          <Icon name="info" size={15} color="#B7770D" style={{ marginTop:1, flexShrink:0 }} />
          {/* The demo-credential hint only makes sense in pure mock mode — once
              Supabase is connected there's no seeded 'aisyah@...' auth user. */}
          <span>Use the email and password you registered with.{!isSupabaseConfigured && <> Demo vendor: <b>aisyah@nutmegclay.my</b> / <b>{DEMO_VENDOR_PASSWORD}</b></>}</span>
        </div>
      </div>
      <button onClick={login} className="cta" style={{ marginTop:22, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:15, fontWeight:600, borderRadius:13, padding:15, cursor:'pointer', boxShadow:'0 4px 12px rgba(154,91,38,0.22)', width:'100%' }}>Sign in</button>
      <div style={{ textAlign:'center', fontSize:13, color:'#6B6560', marginTop:20 }}>
        New here?{' '}
        <span onClick={() => set({ vScreen:'register', regStep:1, tcAccepted:false, tcScrolled:false })} style={{ color:'#9A5B26', fontWeight:600, cursor:'pointer' }}>Register as a vendor</span>
      </div>
    </div>
  );
}
