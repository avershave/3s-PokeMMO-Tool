import { useEffect, useState } from 'react';
import { titleCase } from '../../lib/typeChart.js';
import { normalizeKey } from '../../lib/areas.js';
import DelayedTooltip from './DelayedTooltip.jsx';

const abilityCache = new Map();
function useAbilityDesc(name){
  const slug = normalizeKey(name);
  const [desc, setDesc] = useState(abilityCache.get(slug) || '');
  useEffect(() => {
    if (!slug || abilityCache.has(slug)) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`https://pokeapi.co/api/v2/ability/${slug}`);
        const json = await res.json();
        const entry = (json.effect_entries || []).find(e => e.language?.name === 'en');
        const d = entry?.short_effect || entry?.effect || '';
        abilityCache.set(slug, d);
        if (alive) setDesc(d);
      } catch (e) {
        if (alive) setDesc('');
      }
    })();
    return () => { alive = false; };
  }, [slug]);
  return desc;
}

function AbilityPill({ label, name, compact = false }){
  // The hook runs before the early return: hooks must run on every render, in the same order.
  const desc = useAbilityDesc(name);
  if (!name) return null;
  const trimmedDesc = desc?.trim() || '';
  const tooltipContent = trimmedDesc || titleCase(name);
  // Unified ability text size; overflow handled with ellipsis
  const fontPx = 13;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:6,
      padding: compact ? '2px 6px' : '4px 8px',
      borderRadius:8,
      background:'var(--surface)',
      border:'1px solid var(--divider)',
      minWidth: 0
    }}>
      <span className="label-muted" style={{ fontSize: compact ? 11 : 12 }}>{label}</span>
      <DelayedTooltip content={tooltipContent} delay={400}>
        <span
          style={{
            fontWeight:600,
            color:'var(--accent)',
            whiteSpace:'nowrap',
            overflow:'hidden',
            textOverflow:'ellipsis',
            display:'inline-block',
            minWidth: 0,
            maxWidth: '100%',
            fontSize: fontPx,
            cursor: tooltipContent ? 'help' : 'default'
          }}
          aria-label={tooltipContent}
        >{titleCase(name)}</span>
      </DelayedTooltip>
    </div>
  );
}

export { useAbilityDesc };
export default AbilityPill;
