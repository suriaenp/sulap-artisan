import { useState } from 'react';
import Icon from '../components/Icon';
import { useStore } from '../lib/store';
import { DEFAULT_ADMIN_PASSWORD } from '../data/mockData';

const inp = { width:'100%', border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:13, padding:'14px 15px', fontSize:15, color:'var(--text-primary)', outline:'none' };
const lbl = { fontSize:12.5, fontWeight:600, color:'var(--text-primary)', marginBottom:7 };

export default function AdminLogin() {
  const { state, set, dispatch, showToast } = useStore();
  const { aScreen, admins, currentAdminId } = state;
  const [adminId, setAdminId] = useState('admin');
  const [password, setPassword] = useState('sulap123');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  const login = () => {
    const a = admins.find(x => x.id.toLowerCase() === adminId.trim().toLowerCase());
    if (!a) { showToast('Admin ID not found', 'info'); return; }
    if (a.password !== password) { showToast('Incorrect password', 'lock'); return; }
    if (a.mustReset) {
      setNewPass(''); setConfirmPass('');
      set({ aScreen:'reset', currentAdminId: a.id });
      return;
    }
    set({ aScreen:'dashboard', currentAdminId: a.id, aTab:'overview', page:1 });
    showToast(`Welcome, ${a.name}`, 'settings');
  };

  const saveNewPassword = () => {
    if (newPass.length < 6) { showToast('Password must be at least 6 characters', 'info'); return; }
    if (newPass === DEFAULT_ADMIN_PASSWORD) { showToast('Please choose a password different from the default', 'info'); return; }
    if (newPass !== confirmPass) { showToast("Passwords don't match", 'info'); return; }
    dispatch({ type:'MERGE_ADMINS', payload: admins.map(a => a.id === currentAdminId ? { ...a, password:newPass, mustReset:false } : a) });
    set({ aScreen:'dashboard', aTab:'overview', page:1 });
    showToast('Password updated — welcome!', 'check');
  };

  // ── First sign-in / after a reset: set a new password ──
  if (aScreen === 'reset') {
    const a = admins.find(x => x.id === currentAdminId) || {};
    return (
      <div style={{ padding:'28px 22px', minHeight:740, display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <img src="/assets/sulap-mark.png" alt="Sulap" style={{ height:44, width:'auto' }} />
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#3A1622', color:'#FAF8F5', fontSize:11, fontWeight:600, letterSpacing:'0.04em', borderRadius:999, padding:'5px 11px' }}>
            <Icon name="lock" size={13} color="#FAF8F5"/>Set new password
          </div>
        </div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:27, fontWeight:600, color:'var(--text-primary)', marginTop:24 }}>Hi {a.name?.split(' ')[0] || 'there'}, set your password</div>
        <div style={{ fontSize:14, color:'var(--text-secondary)', marginTop:6, lineHeight:1.5 }}>You signed in with the default password. Choose your own before continuing — you'll use it from now on.</div>
        <div style={{ marginTop:26, display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <div style={lbl}>New password</div>
            <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="At least 6 characters" style={inp}/>
          </div>
          <div>
            <div style={lbl}>Confirm new password</div>
            <input type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveNewPassword()} placeholder="Type it again" style={inp}/>
          </div>
        </div>
        <button onClick={saveNewPassword} className="cta" style={{ marginTop:22, background:'#3A1622', color:'#FAF8F5', border:'none', fontSize:15, fontWeight:600, borderRadius:13, padding:15, cursor:'pointer', width:'100%' }}>Save & continue</button>
        <button onClick={()=>set({ aScreen:'login', currentAdminId:null })} style={{ marginTop:12, background:'none', border:'none', color:'var(--text-muted)', fontSize:13, fontWeight:600, cursor:'pointer', alignSelf:'flex-start' }}>‹ Back to sign in</button>
      </div>
    );
  }

  // ── Sign in ──
  return (
    <div style={{ padding:'28px 22px', minHeight:740, display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <img src="/assets/sulap-mark.png" alt="Sulap" style={{ height:44, width:'auto' }} />
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#3A1622', color:'#FAF8F5', fontSize:11, fontWeight:600, letterSpacing:'0.04em', borderRadius:999, padding:'5px 11px' }}>
          <Icon name="settings" size={13} color="#FAF8F5"/>Admin
        </div>
      </div>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:27, fontWeight:600, color:'var(--text-primary)', marginTop:24 }}>Admin Sign In</div>
      <div style={{ fontSize:14, color:'var(--text-secondary)', marginTop:6 }}>Sulap Artisan Vendor Registration</div>
      <div style={{ marginTop:26, display:'flex', flexDirection:'column', gap:16 }}>
        <div>
          <div style={lbl}>Admin ID</div>
          <input value={adminId} onChange={e=>setAdminId(e.target.value)} placeholder="e.g. admin" style={inp}/>
        </div>
        <div>
          <div style={lbl}>Password</div>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} placeholder="••••••••" style={inp}/>
        </div>
      </div>
      <button onClick={login} className="cta" style={{ marginTop:22, background:'#3A1622', color:'#FAF8F5', border:'none', fontSize:15, fontWeight:600, borderRadius:13, padding:15, cursor:'pointer', width:'100%' }}>Sign in</button>
      <div style={{ marginTop:18, background:'var(--bg-subtle-alt)', border:'1px solid var(--border-light)', borderRadius:12, padding:'11px 13px', fontSize:11.5, color:'var(--text-muted)', lineHeight:1.55, maxWidth:460 }}>
        Demo accounts — super admin: <b style={{ color:'var(--text-secondary)' }}>admin / sulap123</b> · staff (first sign-in flow): <b style={{ color:'var(--text-secondary)' }}>staff01 / 00000</b>. Forgot passwords are reset to the default by a super admin in Admin Roles.
      </div>
    </div>
  );
}
