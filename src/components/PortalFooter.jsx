import { useStore } from '../lib/store';

// Shared footer for both portals — sits under every tab's content, matching
// the copyright/links/social-icon footer from the 2026-07 design refresh.
// Reuses the public site's footer copyright copy (content.footerCopyright)
// so the wording stays consistent in one place.
export default function PortalFooter() {
  const { state } = useStore();
  const year = new Date().getFullYear();
  const copyright = state.content?.footerCopyright || `© ${year} Sulap Artisan`;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      marginTop: 32, padding: '18px 20px', borderTop: '1px solid var(--glass-divider)',
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{copyright}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 12 }}>
        <a href="#" style={{ color: '#9A5B26' }}>Privacy Policy</a>
        <a href="#" style={{ color: '#9A5B26' }}>Terms and Conditions</a>
        <a href="#" style={{ color: '#9A5B26' }}>Contact</a>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="#8A6A4A"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z"/></svg>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="#8A6A4A"><path d="M18.9 2H22l-7.2 8.2L23 22h-6.6l-5.2-6.8L5 22H2l7.7-8.8L2 2h6.7l4.7 6.2L18.9 2z"/></svg>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="#8A6A4A"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4.5" fill="var(--bg-page)"/><circle cx="17.5" cy="6.5" r="1.2" fill="var(--bg-page)"/></svg>
      </div>
    </div>
  );
}
