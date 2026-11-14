import { useEffect, useMemo, useState } from 'react';
import DelayedTooltip from './DelayedTooltip.jsx';
import TypePill from './TypePill.jsx';

/* ---------- Move data & tables ---------- */

const CATEGORY_COLORS = {
  physical:'#C92112',
  special:'#1976D2',
  status:'#A0A0A0'
};
function CategoryPill({ cat }){
  const key = String(cat || '').toLowerCase();
  if(!key) return null;
  const bg = CATEGORY_COLORS[key] || '#555';
  return (
    <span style={{display:'inline-block', padding:'2px 8px', fontSize:12, borderRadius:999,
      fontWeight:800, color:'#fff', background:bg, textTransform:'capitalize'}}>{key}</span>
  );
}

const MOVE_CACHE = new Map();
const MOVE_SLUG_EXCEPTIONS = new Map([
  ['smokescreen', 'smokescreen']
]);
function moveSlug(name=''){
  const trimmed = String(name || '').trim();
  if(!trimmed) return '';
  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]+/g,'');
  const exception = MOVE_SLUG_EXCEPTIONS.get(normalized);
  if(exception) return exception;
  const withDelimiters = trimmed
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2');
  return withDelimiters.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}

function mapMoveResponse(json) {
  if (!json || typeof json !== 'object') return null;
  const entries = Array.isArray(json.effect_entries) ? json.effect_entries : [];
  const english = entries.find(entry => entry?.language?.name === 'en') || entries[0];
  let shortEffect = english?.short_effect || english?.effect || null;
  if (shortEffect && typeof json.effect_chance === 'number') {
    shortEffect = shortEffect.replace(/\$effect_chance/g, String(json.effect_chance));
  }
  if (shortEffect) {
    shortEffect = shortEffect.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return {
    type: json?.type?.name,
    category: json?.damage_class?.name,
    power: json?.power,
    accuracy: json?.accuracy,
    shortEffect: shortEffect || null,
  };
}
function useMoveData(name){
  const slug = moveSlug(name);
  const [data,setData] = useState(() => MOVE_CACHE.get(slug));
  useEffect(() => {
    let alive = true;
    if(!slug) return;
    const cached = MOVE_CACHE.get(slug);
    if(cached){
      setData(cached);
      return;
    }
    (async () => {
      try{
        const res = await fetch(`https://pokeapi.co/api/v2/move/${slug}`);
        const json = await res.json();
        const info = mapMoveResponse(json);
        MOVE_CACHE.set(slug, info);
        if(alive) setData(info);
      }catch(e){
        MOVE_CACHE.set(slug, null);
        if(alive) setData(null);
      }
    })();
    return () => { alive = false; };
  }, [slug]);
  return data || null;
}

const moveCell = { padding:'5px 6px', borderBottom:'1px solid var(--divider)' };

function formatMoveLabel(name=''){
  if (!name) return '';
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .trim();
}

function MoveRow({ mv, showLevel=false }){
  const name = typeof mv === 'string' ? mv : mv.move;
  const level = typeof mv === 'string' ? null : mv.level;
  const slug = moveSlug(name);
  const data = useMoveData(name);
  const shortEffect = data?.shortEffect;
  const hasSlug = Boolean(slug);
  const tooltipContent = shortEffect || (hasSlug ? (MOVE_CACHE.has(slug) ? 'No short effect available.' : 'Loading move info...') : null);
  const displayName = formatMoveLabel(name);
  const cursorStyle = hasSlug ? 'help' : 'default';
  return (
    <tr>
      {showLevel && (
        <td style={{ ...moveCell, textAlign:'center' }}>{level ?? '-'}</td>
      )}
      <td style={{ ...moveCell, textAlign:'left' }}>
        <DelayedTooltip delay={500} content={tooltipContent}>
          <span
            style={{ cursor: cursorStyle, display:'inline-flex', alignItems:'center' }}
            aria-label={tooltipContent || undefined}
          >
            {displayName}
          </span>
        </DelayedTooltip>
      </td>
      <td style={{ ...moveCell, textAlign:'center' }}>
        {data?.type ? <TypePill t={data.type} compact /> : '\u2014'}
      </td>
      <td style={{ ...moveCell, textAlign:'center' }}>
        {data?.category ? <CategoryPill cat={data.category} /> : '\u2014'}
      </td>
      <td style={{ ...moveCell, textAlign:'center' }}>{data?.power ?? '\u2014'}</td>
      <td style={{ ...moveCell, textAlign:'center' }}>{data?.accuracy ?? '\u2014'}</td>
    </tr>
  );
}

function MovesTable({ title, moves = [], showLevel = false }) {
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [refresh, setRefresh] = useState(0);

  // Reset sort when the move list changes
  useEffect(() => {
    setSort({ key: null, dir: 1 });
  }, [moves]);

  // Preload move data so sorting by type/power/etc. works immediately
  useEffect(() => {
    let alive = true;
    const names = Array.from(new Set(moves.map(m => (typeof m === 'string' ? m : m.move))));
    (async () => {
      for (const name of names) {
        const slug = moveSlug(name);
        if (!slug || MOVE_CACHE.has(slug)) continue;
        try {
          const res = await fetch(`https://pokeapi.co/api/v2/move/${slug}`);
          const json = await res.json();
          const info = mapMoveResponse(json);
          MOVE_CACHE.set(slug, info);
        } catch (e) {}
      }
      if (alive) setRefresh(r => r + 1);
    })();
    return () => {
      alive = false;
    };
  }, [moves]);

  const sorted = useMemo(() => {
    const arr = [...moves];
    if (!sort.key) return arr;
    const dir = sort.dir;
    const getName = mv => (typeof mv === 'string' ? mv : mv.move);
    const getLevel = mv => (typeof mv === 'string' ? null : mv.level);
    const getData = mv => MOVE_CACHE.get(moveSlug(getName(mv))) || {};
    return arr.sort((a, b) => {
      const nameA = getName(a);
      const nameB = getName(b);
      const dataA = getData(a);
      const dataB = getData(b);
      switch (sort.key) {
        case 'name':
          return nameA.localeCompare(nameB) * dir;
        case 'type': {
          const t = (dataA.type || '').localeCompare(dataB.type || '');
          return t ? t * dir : nameA.localeCompare(nameB);
        }
        case 'cat': {
          const c = (dataA.category || '').localeCompare(dataB.category || '');
          return c ? c * dir : nameA.localeCompare(nameB);
        }
        case 'power': {
          const pa = dataA.power;
          const pb = dataB.power;
          const psa = pa ?? (dir === -1 ? -Infinity : Infinity);
          const psb = pb ?? (dir === -1 ? -Infinity : Infinity);
          const diff = psa - psb;
          return diff ? diff * dir : nameA.localeCompare(nameB);
        }
        case 'acc': {
          const aa = dataA.accuracy;
          const ab = dataB.accuracy;
          const asa = aa ?? (dir === -1 ? -Infinity : Infinity);
          const asb = ab ?? (dir === -1 ? -Infinity : Infinity);
          const diff = asa - asb;
          return diff ? diff * dir : nameA.localeCompare(nameB);
        }
        case 'lv': {
          const la = getLevel(a) ?? (dir === 1 ? Infinity : -Infinity);
          const lb = getLevel(b) ?? (dir === 1 ? Infinity : -Infinity);
          const diff = la - lb;
          return diff ? diff * dir : nameA.localeCompare(nameB);
        }
        default:
          return 0;
      }
    });
  }, [moves, sort, refresh]);

  const handleSort = key => {
    setSort(prev => {
      if (prev.key === key) {
        return { key, dir: -prev.dir };
      }
      const dir = key === 'power' || key === 'acc' ? -1 : 1;
      return { key, dir };
    });
  };

  // Use proper Unicode arrows for sort indicators (up/down)
  const sortArrow = key => (sort.key === key ? (sort.dir === 1 ? '\u25B2' : '\u25BC') : '');

  return (
    <div className="moves-table">
      <div className="moves-table-title">{title}</div>
      {sorted.length ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <colgroup>
            {showLevel && <col style={{ width: '40px' }} />}
            <col />
            <col style={{ width: '80px' }} />
            <col style={{ width: '80px' }} />
            <col style={{ width: '50px' }} />
            <col style={{ width: '50px' }} />
          </colgroup>
          <thead>
            <tr>
              {showLevel && (
                <th
                  style={{ ...moveCell, textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => handleSort('lv')}
                >
                  Lv {sortArrow('lv')}
                </th>
              )}
              <th
                style={{ ...moveCell, textAlign: 'left', cursor: 'pointer' }}
                onClick={() => handleSort('name')}
              >
                Move {sortArrow('name')}
              </th>
              <th
                style={{ ...moveCell, textAlign: 'center', cursor: 'pointer' }}
                onClick={() => handleSort('type')}
              >
                Type {sortArrow('type')}
              </th>
              <th
                style={{ ...moveCell, textAlign: 'center', cursor: 'pointer' }}
                onClick={() => handleSort('cat')}
              >
                Cat {sortArrow('cat')}
              </th>
              <th
                style={{ ...moveCell, textAlign: 'center', cursor: 'pointer' }}
                onClick={() => handleSort('power')}
              >
                Pwr {sortArrow('power')}
              </th>
              <th
                style={{ ...moveCell, textAlign: 'center', cursor: 'pointer' }}
                onClick={() => handleSort('acc')}
              >
                Acc {sortArrow('acc')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((mv) => {
              const baseKey = typeof mv === 'string'
                ? moveSlug(mv)
                : `${moveSlug(mv.move)}-${mv.level ?? ''}`;
              const key = `${baseKey}-${moves.indexOf(mv)}`;
              return <MoveRow key={key} mv={mv} showLevel={showLevel} />;
            })}
          </tbody>
        </table>
      ) : (
        <div className="label-muted">None</div>
      )}
    </div>
  );
}

export default MovesTable;
