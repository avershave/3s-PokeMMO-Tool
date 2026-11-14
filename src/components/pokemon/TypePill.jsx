import { TYPE_COLORS } from '../../lib/typeColors.js';
import { titleCase, normalizeType } from '../../lib/typeChart.js';

function TypePill({ t, compact=false, large=false, onClick }){
  const key = normalizeType(t);
  if (!key) return null;
  const bg = TYPE_COLORS[key] || '#555';
  const pad = compact ? '2px 8px' : large ? '6px 12px' : '4px 10px';
  const fontSize = compact ? 12 : large ? 15 : 13;
  return (
    <span
      onClick={onClick}
      title={onClick ? 'Filter by Type' : titleCase(key)}
      style={{
        display:'inline-block', padding:pad, fontSize, lineHeight:1,
        borderRadius:999, fontWeight:800, color:'#111', background:bg, border:'1px solid #00000022', textShadow:'0 1px 0 #ffffff55',
        cursor: onClick ? 'pointer' : 'default', userSelect: 'none'
      }}
    >{titleCase(key)}</span>
  );
}

export default TypePill;
