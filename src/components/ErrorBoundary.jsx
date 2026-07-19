import { Component } from 'react';

// Top-level error boundary. Without one, a single render-time throw anywhere in
// the tree unmounts the whole app to a blank white screen with no way back. This
// catches it and shows a branded recover screen instead. Class component because
// error boundaries have no hooks equivalent (getDerivedStateFromError /
// componentDidCatch are class-only).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Phase 2: forward to a real error-reporting service (Sentry/Logflare).
    // For now, keep it in the console so a crash is at least diagnosable.
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'#F1E2CC', fontFamily:"'Karla', sans-serif" }}>
        <div style={{ maxWidth:420, width:'100%', background:'#FFF8EE', border:'1px solid #EFE0C7', borderRadius:20, padding:'32px 28px', textAlign:'center', boxShadow:'0 18px 60px rgba(60,40,20,0.12)' }}>
          <div style={{ width:56, height:56, borderRadius:'50%', background:'#FDEEEC', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px', fontSize:26 }}>⚠️</div>
          <div style={{ fontFamily:"'Marcellus', serif", fontSize:22, fontWeight:400, color:'#3A2210' }}>Something went wrong</div>
          <div style={{ fontSize:14, lineHeight:1.55, color:'#6B4E33', marginTop:10 }}>
            The page hit an unexpected error. Reloading usually fixes it — your data is safe.
          </div>
          <button onClick={() => window.location.reload()} style={{ marginTop:22, background:'#9A5B26', color:'#FAF8F5', border:'none', fontSize:15, fontWeight:600, borderRadius:13, padding:'14px 32px', cursor:'pointer' }}>
            Reload the page
          </button>
        </div>
      </div>
    );
  }
}
