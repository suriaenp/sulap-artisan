// Round vendor profile picture/logo — real photo (`v.logo`, collected at
// sign-up, see VendorRegister.jsx Step 1) when the vendor has uploaded one,
// falling back to a round color-by-id initials placeholder when they haven't.
const AVATAR_COLORS = ['#9A5B26','#2D6A4F','#5B7FA6','#A6364E','#7A4A38','#6B4F8C'];
function vendorInitials(name) {
  return (name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}
function avatarColor(id) {
  const sum = [...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}
export default function VendorAvatar({ v, size = 44 }) {
  if (v.logo) {
    return (
      <div style={{ width:size, height:size, borderRadius:'50%', flexShrink:0, overflow:'hidden', background:v.logo.url ? '#F2EDE6' : `linear-gradient(135deg,${v.logo.grad?.[0]||'#F0D8DD'},${v.logo.grad?.[1]||'#B97434'})` }}>
        {v.logo.url && <img src={v.logo.url} alt={`${v.business} logo`} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>}
      </div>
    );
  }
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:avatarColor(v.id), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <span style={{ color:'#fff', fontSize:size*0.32, fontWeight:700 }}>{vendorInitials(v.business)}</span>
    </div>
  );
}
