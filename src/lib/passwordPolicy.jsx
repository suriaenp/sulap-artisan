import Icon from '../components/Icon';

// Matches the live Supabase Auth project's actual password policy (confirmed
// by testing against the real API, not assumed — see PROJECT_NOTES). Shared
// between vendor registration and admin account settings so both enforce the
// exact same rule instead of drifting.
export const PASSWORD_HINT = 'At least 8 characters, with uppercase, lowercase, a number, and a symbol';
export const isStrongPassword = (pw) => pw.length >= 8 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);

// Live checklist that turns each requirement green as it's satisfied while
// typing — a toast that flashes for 2.4s and vanishes is not enough feedback
// for a multi-part requirement like this (confirmed by a real user missing it).
export function PasswordChecklist({ password }) {
  const checks = [
    ['8+ characters', password.length >= 8],
    ['Uppercase letter', /[A-Z]/.test(password)],
    ['Lowercase letter', /[a-z]/.test(password)],
    ['Number', /[0-9]/.test(password)],
    ['Symbol', /[^A-Za-z0-9]/.test(password)],
  ];
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:'5px 13px', marginTop:8 }}>
      {checks.map(([label, ok]) => (
        <span key={label} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color: ok ? '#2D6A4F' : '#A09890' }}>
          <Icon name={ok ? 'check' : 'x'} size={11} color={ok ? '#2D6A4F' : '#c9bfb0'} />
          {label}
        </span>
      ))}
    </div>
  );
}

// Maps a raw Supabase Auth error into plain, actionable copy — used anywhere
// a signUp/updateUser call can fail on these specific, known error shapes.
export function friendlyAuthError(error) {
  if (/rate limit/i.test(error.message)) return "We're sending a lot of emails right now — please try again in about an hour";
  if (/registered/i.test(error.message)) return 'An account with this email already exists — try signing in instead';
  if (/password/i.test(error.message)) return PASSWORD_HINT;
  if (/invalid/i.test(error.message) && /email/i.test(error.message)) return 'Please enter a real, deliverable email address';
  return error.message;
}
