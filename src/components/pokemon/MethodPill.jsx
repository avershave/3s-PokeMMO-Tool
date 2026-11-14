import React from 'react';
import { ColorContext } from '../../colorConfig.js';
import { cleanMethodLabel } from '../../lib/areas.js';

/* ---------- Method & Rarity palettes ---------- */
function methodKey(m=''){ return String(m).toLowerCase().trim(); }

function MethodPill({ method, compact=false, hordeSize }){
  const { methodColors, rarityColors } = React.useContext(ColorContext);
  if (!method) return null;
  let label = cleanMethodLabel(method);
  if (hordeSize && /^horde/i.test(label)) {
    label = `${label} (x${hordeSize})`;
  }
  const m = methodKey(label);
  const raw = m.replace(/[^a-z]+/g, ' ');
  const base = /\blure\b/.test(raw)
    ? 'lure'
    : /\bhorde\b/.test(raw)
    ? 'horde'
    : (methodColors[m] ? m : m.replace(/\s*\(.*\)$/,''));
  const bg = base === 'lure'
    ? (rarityColors[base] || '#7f8c8d')
    : (methodColors[base] || '#7f8c8d');
  return (
    <span style={{
      display:'inline-block', padding:'2px 8px', fontSize:compact?11:12, borderRadius:999,
      color:'#111', background:bg, fontWeight:800, border:'1px solid #00000022'
    }}>
      {label}
    </span>
  );
}

export default MethodPill;
