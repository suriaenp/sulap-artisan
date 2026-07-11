import { StoreProvider, useStore } from './lib/store';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Toast from './components/Toast';
import { VendorDetailModal, AppDetailModal, EventDetailModal, ApplyModal, PassModal, DepositModal } from './components/Modals';
import PublicHome from './pages/PublicHome';
import VendorLogin from './pages/VendorLogin';
import VendorRegister from './pages/VendorRegister';
import VendorDashboard from './pages/VendorDashboard';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import './index.css';

function PayModal() {
  const { state, dispatch, set, showToast } = useStore();
  const { payModalKey, payf, payments, vendors, events } = state;
  if (!payModalKey) return null;
  const [vid, , eid] = payModalKey.split('-');
  const v = vendors.find(x => x.id === vid) || {};
  const close = () => set({ payModalKey: null });
  const save = () => {
    const amt = parseFloat(payf.amount) || 0;
    const p = { ...payments };
    p[payModalKey] = { ...(p[payModalKey] || {}), status: 'partial', paid: amt };
    dispatch({ type: 'MERGE_PAYMENTS', payload: p });
    set({ payModalKey: null });
    showToast('Marked partially paid', 'check');
  };
  return (
    <div onClick={close} style={{ position:'absolute', inset:0, zIndex:75, background:'rgba(28,26,23,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:380, background:'#FAF8F5', borderRadius:20, padding:22 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:600, color:'#1C1A17' }}>Record partial payment</div>
            <div style={{ fontSize:12.5, color:'#6B6560', marginTop:2 }}>{v.business}</div>
          </div>
          <button onClick={close} style={{ background:'#F2EDE6', border:'none', width:32, height:32, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:18, color:'#1C1A17' }}>×</button>
        </div>
        <div style={{ marginTop:14 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#1C1A17', marginBottom:6 }}>Amount received (RM)</div>
          <input inputMode="decimal" value={payf.amount || ''} onChange={e=>set({payf:{...payf,amount:e.target.value}})} placeholder="0.00" style={{ width:'100%', border:'1px solid #e3d8ca', background:'#fff', borderRadius:11, padding:'12px 13px', fontSize:15, outline:'none' }}/>
        </div>
        <button onClick={save} style={{ marginTop:16, width:'100%', background:'#C76A0D', color:'#fff', border:'none', fontSize:14, fontWeight:600, borderRadius:12, padding:13, cursor:'pointer' }}>Save partial payment</button>
      </div>
    </div>
  );
}

function AppShell() {
  const { state } = useStore();
  const { view, vScreen, aScreen } = state;
  const isPublicHome = view === 'public';
  const showNav = !(view === 'vendor' && (vScreen === 'login' || vScreen === 'register'));

  return (
    <div className={isPublicHome ? 'outer-wrap home-wrap' : 'outer-wrap'}>
      <div className={isPublicHome ? 'app-shell home-shell' : 'app-shell'}>
        <Sidebar />
        <div className="main-area">
          <div style={{ flexShrink:0, height:'env(safe-area-inset-top, 0px)' }}/>
          <div className="scrollarea" style={{ flex:1, overflowY:'auto', overflowX:'hidden', position:'relative' }}>
            {view === 'public' && <PublicHome />}
            {view === 'vendor' && vScreen === 'login'     && <VendorLogin />}
            {view === 'vendor' && vScreen === 'register'  && <VendorRegister />}
            {view === 'vendor' && vScreen === 'dashboard' && <VendorDashboard />}
            {view === 'admin'  && aScreen === 'login'     && <AdminLogin />}
            {view === 'admin'  && aScreen === 'dashboard' && <AdminDashboard />}
          </div>
          {showNav && <BottomNav />}
          <Toast />
          <VendorDetailModal />
          <AppDetailModal />
          <EventDetailModal />
          <ApplyModal />
          <PassModal />
          <PayModal />
          <DepositModal />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  );
}
