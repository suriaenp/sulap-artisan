import { badge } from '../lib/helpers';

export default function Badge({ status, style, label }) {
  const b = badge(status);
  return (
    <span style={{
      background: b.bg, color: b.color,
      fontSize: 11, fontWeight: 700, borderRadius: 999,
      padding: '5px 11px', flexShrink: 0, whiteSpace: 'nowrap',
      ...style,
    }}>
      {label || b.label}
    </span>
  );
}
