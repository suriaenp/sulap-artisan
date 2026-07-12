import Icon from '../components/Icon';
import { useStore } from '../lib/store';
import { CURRENT_VENDOR_ID } from '../data/mockData';

export default function VendorLogin() {
  const { state, set, showToast } = useStore();

  const login = () => {
    const me = state.vendors.find(v => v.id === CURRENT_VENDOR_ID);
    if (!me || me.status === 'pending') {
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
    set({ vScreen:'dashboard', vTab:'events' });
    showToast('Signed in to your portal', 'bag');
  };

  return (
    <div style={{ padding:'28px 22px', minHeight:740, display:'flex', flexDirection:'column' }}>
      <img src="/assets/sulap-lockup.png" alt="Sulap Artisan" style={{ width:208, height:'auto', display:'block', marginBottom:6 }} />
      <div style={{ fontFamily:"'Marcellus',serif", fontSize:27, fontWeight:400, color:'#1C1A17', marginTop:26 }}>Welcome Back!</div>
      <div style={{ fontSize:14, color:'#6B6560', marginTop:6, lineHeight:1.5 }}>Sign in with your email address and password to reach your vendor portal.</div>
      <div style={{ marginTop:26, display:'flex', flexDirection:'column', gap:16 }}>
        <div>
          <div style={{ fontSize:12.5, fontWeight:600, color:'#1C1A17', marginBottom:7 }}>Email address</div>
          <input type="email" placeholder="you@email.com" style={{ width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:13, padding:'14px 15px', fontSize:15, color:'#1C1A17', outline:'none' }} />
        </div>
        <div>
          <div style={{ fontSize:12.5, fontWeight:600, color:'#1C1A17', marginBottom:7 }}>Password</div>
          <input type="password" placeholder="••••••••" style={{ width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:13, padding:'14px 15px', fontSize:15, color:'#1C1A17', outline:'none' }} />
        </div>
        <div style={{ display:'flex', gap:9, alignItems:'flex-start', background:'#FEF8EC', border:'1px solid #f3e6c9', borderRadius:11, padding:'11px 13px', fontSize:12, color:'#B7770D', lineHeight:1.4 }}>
          <Icon name="info" size={15} color="#B7770D" style={{ marginTop:1, flexShrink:0 }} />
          Use the email and password you registered with.
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
