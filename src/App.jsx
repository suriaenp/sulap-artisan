import { StoreProvider, useStore } from './lib/store';
import Sidebar from './components/Sidebar';
import AuthLayout from './components/AuthLayout';
import Toast from './components/Toast';
import { VendorDetailModal, AppDetailModal, EventDetailModal, ApplyModal, DepositModal, RefundModal, DocPreviewModal, PassPhotoPreviewModal } from './components/Modals';
import { payCalc, money } from './lib/helpers';
import PublicHome from './pages/PublicHome';
import VendorLogin from './pages/VendorLogin';
import VendorRegister from './pages/VendorRegister';
import VendorDashboard from './pages/VendorDashboard';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import './index.css';

function PayModal() {
  const { state, dispatch, set, showToast, logActivity } = useStore();
  const { payModalKey, payf, payments, vendors, events, deposits, apps } = state;
  if (!payModalKey) return null;
  const [vid, eid] = payModalKey.split('-');
  const v = vendors.find(x => x.id === vid) || {};
  const ev = events.find(x => x.id === eid) || {};
  const app = apps.find(a => a.vendorId === vid && a.eventId === eid);
  const dep = deposits[vid] || { status: 'unpaid' };
  const calc = payCalc(v, ev, dep.status, app?.tier);
  const close = () => set({ payModalKey: null });
  const save = () => {
    const amt = parseFloat(payf.amount) || 0;
    const status = amt <= 0 ? 'unpaid' : amt < calc.total ? 'partial' : 'paid';
    const p = { ...payments };
    p[payModalKey] = { ...(p[payModalKey] || {}), status, paid: amt };
    dispatch({ type: 'MERGE_PAYMENTS', payload: p });
    // A fully-paid total that included the one-time RM100 deposit settles the
    // deposit too — keep the Deposit Record tab in sync so the next event's
    // total doesn't charge the deposit a second time.
    if (status === 'paid' && calc.needsDeposit) {
      dispatch({ type: 'MERGE_DEPOSITS', payload: { [vid]: { ...dep, status: 'paid', payDate: new Date().toISOString().slice(0, 10) } } });
      logActivity('Admin', `marked ${v.business}'s RM100 security deposit as paid — settled within their ${ev.name} payment.`, { icon:'wallet', tint:'var(--tint-blue-bg)' });
    }
    set({ payModalKey: null });
    logActivity('Admin', `recorded a payment of RM ${money(amt)} for ${v.business}'s ${ev.name} application.`, { icon:'receipt', tint:'var(--tint-green-bg)' });
    showToast(amt > calc.total ? 'Payment recorded — overpaid, refund flagged' : `Marked ${status}`, 'check');
  };
  return (
    <div onClick={close} style={{ position:'absolute', inset:0, zIndex:75, background:'rgba(28,26,23,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:24, animation:'scrimIn 0.25s ease' }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:380, background:'var(--bg-card)', borderRadius:20, padding:22, animation:'modalIn 0.3s var(--ease-spring)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontFamily:"'Marcellus',serif", fontSize:19, fontWeight:400, color:'var(--text-primary)' }}>Record payment</div>
            <div style={{ fontSize:12.5, color:'var(--text-secondary)', marginTop:2 }}>{v.business} · {ev.name}</div>
          </div>
          <button onClick={close} style={{ background:'var(--bg-subtle)', border:'none', width:32, height:32, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:18, color:'var(--text-primary)' }}>×</button>
        </div>
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:12, padding:'11px 13px', marginTop:14, display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--text-secondary)' }}>
          <span>Total due</span><span style={{ fontWeight:700, color:'var(--text-primary)' }}>RM {money(calc.total)}</span>
        </div>
        <div style={{ marginTop:14 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', marginBottom:6 }}>Amount received (RM)</div>
          <input inputMode="decimal" value={payf.amount || ''} onChange={e=>set({payf:{...payf,amount:e.target.value}})} placeholder="0.00" style={{ width:'100%', border:'1px solid var(--border-medium)', background:'var(--bg-card)', borderRadius:11, padding:'12px 13px', fontSize:15, outline:'none' }}/>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6, lineHeight:1.4 }}>Matches the total due → marked Paid. Less → Partial. More → Paid, and flagged for a refund.</div>
        </div>
        <button onClick={save} style={{ marginTop:16, width:'100%', background:'#9A5B26', color:'#fff', border:'none', fontSize:14, fontWeight:600, borderRadius:12, padding:13, cursor:'pointer' }}>Save payment</button>
      </div>
    </div>
  );
}

function AppShell() {
  const { state } = useStore();
  const { view, vScreen, aScreen, darkMode } = state;
  const isSignIn = (view === 'vendor' && vScreen === 'login') || (view === 'admin' && (aScreen === 'login' || aScreen === 'reset'));
  const isRegister = view === 'vendor' && vScreen === 'register';

  if (view === 'public') {
    return (
      <>
        <PublicHome />
        <Toast />
      </>
    );
  }

  // Sign-in screens and the registration form get their own centered card — no Sidebar,
  // since there's no portal context to navigate yet, and a "Back to home" button covers
  // wayfinding. The register card is wider to fit the multi-step form's 2-column grid.
  if (isSignIn || isRegister) {
    return (
      <div data-theme={view === 'admin' && darkMode ? 'dark' : 'light'} className="outer-wrap">
        <AuthLayout dark={view === 'admin' && darkMode} maxWidth={isRegister ? 780 : 420}>
          {view === 'vendor' && vScreen === 'login' && <VendorLogin />}
          {isRegister && <VendorRegister />}
          {view === 'admin' && <AdminLogin />}
        </AuthLayout>
        <Toast />
      </div>
    );
  }

  return (
    <div className="outer-wrap" data-theme={view === 'admin' && darkMode ? 'dark' : 'light'}>
      <div className="app-shell">
        <div className="ambient-blobs"><span/><span/><span/></div>
        <Sidebar />
        <div className="main-area">
          <div style={{ flexShrink:0, height:'env(safe-area-inset-top, 0px)' }}/>
          <div className="scrollarea" style={{ flex:1, overflowY:'auto', overflowX:'hidden', position:'relative' }}>
            {view === 'vendor' && vScreen === 'dashboard' && <VendorDashboard />}
            {view === 'admin'  && aScreen === 'dashboard' && <AdminDashboard />}
          </div>
          <Toast />
          <VendorDetailModal />
          <AppDetailModal />
          <EventDetailModal />
          <ApplyModal />
          <PayModal />
          <DepositModal />
          <RefundModal />
          <DocPreviewModal />
          <PassPhotoPreviewModal />
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
