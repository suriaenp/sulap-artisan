import Icon from './Icon';
import { useStore } from '../lib/store';

export default function Toast() {
  const { state } = useStore();
  if (!state.toast) return null;
  return (
    <div style={{
      position: 'absolute', bottom: 96, left: '50%',
      transform: 'translateX(-50%)',
      background: '#1C1A17', color: '#FAF8F5',
      fontSize: 13, fontWeight: 500,
      padding: '12px 18px', borderRadius: 13,
      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      whiteSpace: 'nowrap', zIndex: 60,
      animation: 'toastIn 0.25s ease',
      display: 'flex', alignItems: 'center', gap: 9,
    }}>
      <Icon name={state.toastIcon} size={15} color="#FAF8F5" />
      {state.toast}
    </div>
  );
}
