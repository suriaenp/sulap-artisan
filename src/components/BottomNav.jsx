import Icon from './Icon';
import { useStore } from '../lib/store';

export default function BottomNav() {
  const { state, set, closeModals } = useStore();
  const { view, vScreen, aScreen } = state;

  const isHome   = view === 'public';
  const isApply  = view === 'vendor' && vScreen === 'register';
  const isPortal = view === 'vendor' && vScreen === 'dashboard';
  const isAdmin  = view === 'admin'  && aScreen === 'dashboard';

  const navBtn = (active) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: "'Karla'", padding: '2px 14px',
    color: active ? '#9A5B26' : '#A09890',
    fontWeight: active ? 700 : 500,
  });

  return (
    <div className="bottom-nav" style={{
      flexShrink: 0, background: '#FAF8F5', borderTop: '1px solid #efe7dc',
      display: 'flex', justifyContent: 'space-around',
      padding: '9px 0 calc(env(safe-area-inset-bottom, 10px) + 10px)',
    }}>
      <button style={navBtn(isHome)} onClick={() => { closeModals(); set({ view:'public', pubScreen:'home' }); }}>
        <Icon name="home" size={21} /><div style={{ fontSize: 10, marginTop: 3 }}>Home</div>
      </button>
      <button style={navBtn(isApply)} onClick={() => { closeModals(); set({ view:'vendor', vScreen:'register', regStep:1, tcAccepted:false, tcScrolled:false }); }}>
        <Icon name="pen" size={21} /><div style={{ fontSize: 10, marginTop: 3 }}>Apply</div>
      </button>
      <button style={navBtn(isPortal)} onClick={() => { closeModals(); set({ view:'vendor' }); }}>
        <Icon name="bag" size={21} /><div style={{ fontSize: 10, marginTop: 3 }}>Portal</div>
      </button>
      <button style={navBtn(isAdmin)} onClick={() => { closeModals(); set({ view:'admin' }); }}>
        <Icon name="settings" size={21} /><div style={{ fontSize: 10, marginTop: 3 }}>Admin</div>
      </button>
    </div>
  );
}
