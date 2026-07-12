import { useStore } from '../lib/store';
import Icon from './Icon';

// Shared centered card shell for the vendor + admin sign-in screens and the vendor
// registration form (no Sidebar — it only makes sense once you're actually inside a
// portal). Always offers a way back to the public home page, since signing out lands
// here with no other nav visible. `maxWidth` widens the card for the multi-step
// registration form (default 420 suits the compact sign-in forms).
export default function AuthLayout({ children, dark, maxWidth = 420 }) {
  const { closeModals, set } = useStore();
  const goHome = () => { closeModals(); set({ view:'public', pubScreen:'home' }); };

  return (
    <div style={{
      position:'relative', minHeight:'100dvh', width:'100%',
      display:'flex', justifyContent:'center', padding:'80px 20px 40px',
      background: dark
        ? 'radial-gradient(circle at 24% 18%, #3A2210 0%, #1D1006 65%)'
        : 'radial-gradient(circle at 24% 18%, #FBF1DE 0%, #F2EDE6 65%)',
    }}>
      <button onClick={goHome} style={{
        position:'absolute', top:22, left:22, display:'inline-flex', alignItems:'center', gap:7,
        background: dark ? 'rgba(250,248,245,0.08)' : '#fff',
        border: dark ? '1px solid rgba(250,248,245,0.15)' : '1px solid #e7ddd0',
        color: dark ? '#FAF8F5' : '#6B6560', fontSize:13, fontWeight:600,
        borderRadius:999, padding:'9px 16px 9px 12px', cursor:'pointer',
      }}>
        <Icon name="arrowLeft" size={15} color={dark ? '#FAF8F5' : '#6B6560'} />Back to home
      </button>
      <div style={{
        width:'100%', maxWidth,
        // auto vertical margins center the card when it fits the viewport, and fall back
        // to top-anchored (scrollable) when it's taller — plain center-alignment would
        // clip the top of the long registration form instead.
        margin:'auto 0',
        background: dark ? '#2A1708' : '#fff',
        border: dark ? '1px solid #4A2A0F' : '1px solid #f1e7d8',
        borderRadius:24, boxShadow:'0 24px 60px rgba(60,40,20,0.14)',
        padding:'36px 32px 32px',
      }}>
        {children}
      </div>
    </div>
  );
}
