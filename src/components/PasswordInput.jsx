import { useState } from 'react';
import Icon from './Icon';

// Password fields with no way to check what you actually typed are a real
// problem once the policy requires mixed case + a digit + a symbol — a typo
// is easy and the generic "doesn't match" error on login can't tell you
// which field was wrong. One eye-toggle button, reused everywhere a password
// is entered (login, registration, account settings).
export default function PasswordInput({ value, onChange, placeholder, style, onKeyDown, autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{ ...style, paddingRight: 42, boxSizing: 'border-box' }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        tabIndex={-1}
        style={{ position: 'absolute', right: 4, top: 0, bottom: 0, width: 36, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A09890' }}
      >
        <Icon name={show ? 'eyeOff' : 'eye'} size={16} color="currentColor" />
      </button>
    </div>
  );
}
