import Icon from './Icon';

// Renders a photo thumbnail — real uploaded image (data URL) or gradient placeholder.
export default function PhotoTile({ photo, size = 74, onRemove, onDownload }) {
  const grad = `linear-gradient(135deg,${photo.grad?.[0] || '#F0D8DD'},${photo.grad?.[1] || '#C75C84'})`;
  return (
    <div title={photo.name} style={{ width:size, height:size, borderRadius:10, background:photo.url ? '#F2EDE6' : grad, position:'relative', overflow:'hidden', flexShrink:0 }}>
      {photo.url && <img src={photo.url} alt={photo.name} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>}
      {onRemove && (
        <button onClick={onRemove} title="Remove" style={{ position:'absolute', top:4, right:4, width:20, height:20, borderRadius:'50%', border:'none', background:'rgba(28,26,23,0.55)', color:'#fff', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0 }}>×</button>
      )}
      {onDownload && (
        <button onClick={onDownload} title="Download photo" style={{ position:'absolute', bottom:4, right:4, width:22, height:22, borderRadius:7, border:'none', background:'rgba(28,26,23,0.55)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0 }}>
          <Icon name="download" size={12} color="#fff"/>
        </button>
      )}
    </div>
  );
}
