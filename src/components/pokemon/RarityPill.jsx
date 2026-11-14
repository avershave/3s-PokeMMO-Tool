import React from 'react';
import { ColorContext } from '../../colorConfig.js';
import { rarityKey } from '../../lib/areas.js';

function RarityPill({ rarity, compact=false, hordeSize }){
  const { rarityColors } = React.useContext(ColorContext);
  if (!rarity) return null;
  const k = rarityKey(rarity);
  const isPercent = /^\d+%$/.test(k);
  const bg = isPercent ? '#13B5A6' : (rarityColors[k] || '#BDC3C7');
  const color = '#111';
  let label = rarity;
  if (hordeSize && /^horde/i.test(rarity)) {
    label = `Horde (x${hordeSize})`;
  }
  return (
    <span style={{
      display:'inline-block', padding:'2px 8px', fontSize:compact?11:12, borderRadius:999,
      color, background:bg, fontWeight:800, border:'1px solid #00000022'
    }}>
      {label}
    </span>
  );
}

export default RarityPill;
