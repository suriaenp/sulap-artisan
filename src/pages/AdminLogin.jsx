import Icon from '../components/Icon';
import { useStore } from '../lib/store';

export default function AdminLogin() {
  const { set, showToast } = useStore();
  const login = () => { set({ aScreen:'dashboard', aTab:'overview' }); showToast('Welcome, Admin','settings'); };

  return (
    <div style={{ padding:'28px 22px', minHeight:740, display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <img src="/assets/sulap-mark.png" alt="Sulap" style={{ height:44, width:'auto' }} />
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#3A1622', color:'#FAF8F5', fontSize:11, fontWeight:600, letterSpacing:'0.04em', borderRadius:999, padding:'5px 11px' }}>
          <Icon name="settings" size={13} color="#FAF8F5"/>Admin
        </div>
      </div>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:27, fontWeight:600, color:'#1C1A17', marginTop:24 }}>Admin Sign In</div>
      <div style={{ fontSize:14, color:'#6B6560', marginTop:6 }}>Sulap Artisan Vendor Registration</div>
      <div style={{ marginTop:26, display:'flex', flexDirection:'column', gap:16 }}>
        <div>
          <div style={{ fontSize:12.5, fontWeight:600, color:'#1C1A17', marginBottom:7 }}>Email address</div>
          <input type="email" placeholder="admin@sulapartisan.com" style={{ width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:13, padding:'14px 15px', fontSize:15, color:'#1C1A17', outline:'none' }} />
        </div>
        <div>
          <div style={{ fontSize:12.5, fontWeight:600, color:'#1C1A17', marginBottom:7 }}>Password</div>
          <input type="password" placeholder="••••••••" style={{ width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:13, padding:'14px 15px', fontSize:15, color:'#1C1A17', outline:'none' }} />
        </div>
      </div>
      <button onClick={login} className="cta" style={{ marginTop:22, background:'#3A1622', color:'#FAF8F5', border:'none', fontSize:15, fontWeight:600, borderRadius:13, padding:15, cursor:'pointer', width:'100%' }}>Sign in</button>
    </div>
  );
}
