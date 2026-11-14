import React, { useEffect, useMemo, useState, useRef, useContext } from 'react';
import './index.css';
import dexRaw from '../UpdatedDex.json';
import catchRates from '../data/catch-rates.json';
import { openPatchNotes } from './components/PatchNotesButton.jsx';
import ColorPickerButton from './components/ColorPickerButton.jsx';
import CaughtListButton from './components/CaughtListButton.jsx';
import AlphaDexButton from './components/AlphaDexButton.jsx';
import EventDexButton from './components/EventDexButton.jsx';
import ShinyDexButton from './components/ShinyDexButton.jsx';
import SearchFilter from './components/SearchFilter.jsx';
import AppShell from './components/shell/AppShell.jsx';
import { DEFAULT_MODE, openDex } from './lib/nav.js';
import CatchNotification from './components/CatchNotification.jsx';
import { ColorContext, DEFAULT_METHOD_COLORS, DEFAULT_RARITY_COLORS } from './colorConfig.js';
import { CaughtContext } from './caughtContext.js';
import { AlphaCaughtContext } from './alphaCaughtContext.js';
import { ShinyCaughtContext } from './shinyCaughtContext.js';
import alphaData from '../data/alpha_pokemon.json';
import BreedingSimulator from './components/BreedingSimulator.jsx';
import TeamBuilder from './components/TeamBuilder.jsx';
import DaycareManager from './components/DaycareManager.jsx';
import HordeSearch from './components/HordeSearch.jsx';
import ResourcesOverlay from './components/ResourcesOverlay.jsx';
import PokemonProfile from './pages/PokemonProfile.jsx';
import hordeRegions from '../horderegiondata.json';
import typeChartImg from '../data/Pokemon_Type_Chart.png';
import { isOcrEnabled, liveRouteClient, liveBattleClient } from './lib/liveClients.js';
import { TYPE_CHART, titleCase, normalizeType, computeWeakness } from './lib/typeChart.js';
import {
  buildHordeSizeMap, getHordeSize, normalizeAreaName, stripSeason, normalizeKey, normalizeRegion,
  normalizeTimeTag, cleanMethodLabel, rarityKey, RARITY_ORDER, selectRarest,
  buildLocationsIndex, buildAreasIndex, cleanAreaMethod, groupEntriesByMon, normalizeMapForGrouping,
  extractTimeTag, stripTimeTag, mapNameMatches, lookupRarity, LIVE_ALIASES, simplifyName, tokenizeName,
  aliasKey, scoreNames, findBestMapName, findBestMapInText, listRegionCandidates, buildGroupedEntries,
} from './lib/areas.js';
import { PLACEHOLDER_POKEMON, localSpriteCandidates } from './lib/sprites.js';
import { ITEM_ICON_BASE, ITEM_PLACEHOLDER, ITEM_LIST, ITEM_INDEX } from './lib/items.js';
import { calcCatchChance, STATUS_MULTIPLIERS, BALL_OPTIONS } from './lib/catch.js';
import { DEX_LIST, DEX_BY_NAME, getMon, getMonByDex } from './lib/dexData.js';
import { useNatures } from './lib/natures.js';
import {
  getBaseStatsFrom, getDisplayStatsFrom, computeFinalStats, mkInitialBuild, isDirty, coerceBuild, underlineFrom,
} from './lib/stats.js';
import { groupMoves } from './lib/moves.js';
import Sprite from './components/pokemon/Sprite.jsx';
import TypePill from './components/pokemon/TypePill.jsx';
import AbilityPill, { useAbilityDesc } from './components/pokemon/AbilityPill.jsx';
import StatsRow from './components/pokemon/StatsRow.jsx';
import NatureSelect from './components/pokemon/NatureSelect.jsx';
import MethodPill from './components/pokemon/MethodPill.jsx';
import RarityPill from './components/pokemon/RarityPill.jsx';
import DelayedTooltip from './components/pokemon/DelayedTooltip.jsx';
import PokeballIcon from './components/pokemon/PokeballIcon.jsx';

const TM_URL        = `${import.meta.env.BASE_URL}data/tm_locations.json`;
const APP_TITLE = "3's PokeMMO Tool";

const DEBUG_LIVE = true; // set false to silence console logs

// Precompute horde sizes by region and area for quick lookup
const HORDE_SIZE_MAP = buildHordeSizeMap(hordeRegions);

// Alpha species membership set by Dex ID (defined after DEX indices)

// Optional override in .env: VITE_SHOW_CONFIDENCE=1 (set to 0 to hide confidence)
const SHOW_CONFIDENCE = (import.meta?.env?.VITE_SHOW_CONFIDENCE ?? '1') === '1';
function formatConfidence(c){
  if (c == null || isNaN(c)) return null;
  const num = Number(c);
  const pct = num <= 1 ? Math.round(num * 100) : Math.round(num);
  // Bound 0..100
  return Math.max(0, Math.min(100, pct));
}

  const ENCOUNTER_TYPES = (() => {
    const set = new Set();
    for (const mon of dexRaw) {
      for (const loc of mon.locations || []) {
        if (loc.type) set.add(cleanMethodLabel(loc.type));
        if (loc.rarity && /lure/i.test(loc.rarity)) set.add('Lure');
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  })();

/* ---------- small style helpers ---------- */
const styles = {
  card: { padding:16, borderRadius:12, border:'1px solid var(--divider)', background:'var(--surface)' },
  areaCard: { padding:12, borderRadius:12, border:'1px solid var(--divider)', background:'var(--surface)' },
  gridCols: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:10 },
  monCard: { position:'relative', display:'flex', flexDirection:'column', alignItems:'center', gap:8, border:'1px solid var(--divider)', borderRadius:10, padding:'10px', background:'var(--surface)', textAlign:'center' },
  encWrap: {
    display:'flex',
    gap:8,
    marginTop:8,
    width:'100%',
    overflowX:'auto',
    scrollBehavior:'smooth'
  },
  encCol: { display:'flex', flexDirection:'column', alignItems:'center', gap:4 },
  chip: {
    padding:'4px 8px',
    borderRadius:6,
    background:'var(--primary)',
    color:'var(--onprimary)',
    fontSize:14,
    border:'1px solid var(--accent)',
    boxShadow:'0 0 0 2px var(--accent)',
    display:'inline-flex',
    alignItems:'center',
    gap:6
  },
  chipX: {
    marginLeft:4,
    display:'inline-flex',
    alignItems:'center',
    justifyContent:'center',
    width:16,
    height:16,
    borderRadius:999,
    border:'1px solid #ffffff55',
    background:'transparent',
    color:'var(--onprimary)',
    fontWeight:900,
    lineHeight:1,
    cursor:'pointer',
    opacity:.9
  }
};

/* ---------- utils ---------- */
const keyName = (s = "") => s.trim().toLowerCase().replace(/\s+/g, " ");

// Alpha species membership set by Dex ID (use DEX index resolution for robustness)
const ALPHA_ID_SET = (() => {
  const ids = new Set();
  try {
    const lookup = (name) => {
      try { return getMon(name); } catch { return null; }
    };
    for (const group of (alphaData?.normal_alpha || [])) {
      for (const n of group || []) { const m = lookup(n); if (m?.id != null) ids.add(m.id); }
    }
    for (const groups of Object.values(alphaData?.event_alpha || {})) {
      for (const g of groups || []) for (const n of g || []) { const m = lookup(n); if (m?.id != null) ids.add(m.id); }
    }
  } catch {}
  return ids;
})();

// Precompile regular expressions that can locate Pokemon names inside a block
// of text.  One regex matches names with spaces/hyphens preserved, while the
// other works against a "compacted" string with all non-alphanumeric
// characters removed.  Sorting by length ensures longer names are tested first
// which prevents partial matches (e.g. "Mr Mime" before "Mr").
const buildNameRegex = (transform) => {
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const names = Array.from(DEX_BY_NAME.keys())
    .map(transform)
    .sort((a, b) => b.length - a.length)
    .map(escape)
    // Allow hyphens in Pokemon names to optionally appear as spaces in OCR text
    .map(n => n.replace(/\\-/g, "[\\s-]?"));
  return new RegExp(`(${names.join("|")})`, "gi");
};
const POKE_NAME_REGEX = buildNameRegex((k) => k);
const POKE_NAME_COMPACT_REGEX = buildNameRegex((k) => k.replace(/[^a-z0-9]+/g, ""));

function normalizeEggGroup(g=''){
  return String(g).toLowerCase().replace('warer','water').replace('hmanoid','humanoid').trim();
}

const EGG_GROUP_COLORS = {
  monster:'#A8A77A', plant:'#7AC74C', dragon:'#6F35FC', bug:'#A6B91A',
  flying:'#A98FF3', field:'#E2BF65', fairy:'#F95587', 'water a':'#6390F0',
  'water b':'#4C7CF0', 'water c':'#1D7BF4', chaos:'#705746', humanoid:'#C22E28',
  hmanoid:'#C22E28', ditto:'#F7D02C', mineral:'#B7B7CE', 'cannot breed':'#616161',
  genderless:'#616161'
};
function EggGroupPill({ group, onClick }){
  const key = normalizeEggGroup(group);
  if (!key) return null;
  const bg = EGG_GROUP_COLORS[key] || '#555';
  return (
    <span
      onClick={onClick}
      title={onClick ? 'Filter by Egg Group' : undefined}
      style={{
        display:'inline-block', padding:'4px 10px', fontSize:13, lineHeight:1,
        borderRadius:999, fontWeight:800, color:'#111', background:bg,
        border:'1px solid #00000022', cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none'
      }}
    >{titleCase(key)}</span>
  );
}

function LabeledPillBox({ label, value, title }){
  if (value == null || value === '') return null;
  return (
    <div
      title={title || ''}
      style={{
        display:'flex', alignItems:'center', gap:6,
        padding:'4px 8px',
        borderRadius:8,
        background:'var(--surface)',
        border:'1px solid var(--divider)'
      }}
    >
      <span className="label-muted" style={{ fontSize:12 }}>{label}</span>
      <span style={{ fontWeight:700 }}>{value}</span>
    </div>
  );
}

function InfoPill({ label, value, large=false }){
  if (value == null || value === '') return null;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:4,
      padding: large ? '4px 10px' : '2px 8px',
      borderRadius:8,
      background:'var(--surface)',
      border:'1px solid var(--divider)',
      fontSize: large ? 14 : undefined
    }}>
      <span className="label-muted" style={{ fontSize:large ? 13 : 12 }}>{label}:</span>
      <span style={{ fontWeight:600 }}>{value}</span>
    </div>
  );
}

/* ---------- Compare View ---------- */

function AbilityInline({ idx, name }){
  const desc = useAbilityDesc(name);
  const label = idx === 2 ? 'H.' : `${idx + 1}.`;
  const tooltipContent = desc?.trim() ? desc.trim() : null;
  return (
    <DelayedTooltip content={tooltipContent} delay={400}>
      <span
        style={{ marginRight:10, display:'inline-flex', alignItems:'center', gap:4, cursor: tooltipContent ? 'help' : 'default' }}
        aria-label={tooltipContent || undefined}
      >
        <span className="label-muted" style={{ fontWeight:700 }}>{label}</span>
        <span style={{ fontWeight:700 }}>{titleCase(name)}</span>
      </span>
    </DelayedTooltip>
  );
}

function WeakResLine({ types, kind='weak' }){
  const w = computeWeakness(types);
  const entries = [];
  if (kind==='weak') {
    for (const t of w.x4) entries.push({ t, pct: '400%' });
    for (const t of w.x2) entries.push({ t, pct: '200%' });
  } else {
    for (const t of w.x0_5) entries.push({ t, pct: '50%' });
    for (const t of w.x0_25) entries.push({ t, pct: '25%' });
    for (const t of w.x0) entries.push({ t, pct: '0%' });
  }
  return (
    <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
      {entries.length === 0 && <span className="label-muted">None</span>}
      {entries.map(({t,pct}) => (
        <span key={`${kind}-${t}`} style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
          <TypePill t={t} compact />
          <span className="label-muted" style={{ fontSize:12 }}>{pct}</span>
        </span>
      ))}
    </div>
  );
}

function CompareBlock({ mon, other, onClear, onReplace, onReplaceFromTeam, build, onSetIV, onSetEV, onSetLevel, natureEl, override=null, otherOverride=null, underlineKeys=new Set() }){
  const hasMon = !!mon;
  const types = (mon?.types || []).map(normalizeType);
  const abilities = (mon?.abilities || []).map(a => a?.name).filter(Boolean);
  // If any ability names are long, use a more compact presentation.
  const useCompactAbilities = abilities.some(a => (a || '').length > 12) || abilities.join('').length > 28;

  const teamSelect = (() => {
    let teamNames = [];
    try {
      const saved = JSON.parse(sessionStorage.getItem('teamBuilderCurrent') || '[]');
      if (Array.isArray(saved)) teamNames = saved;
      else if (saved && typeof saved === 'object' && Array.isArray(saved.mons)) teamNames = saved.mons;
    } catch {}
    const options = (teamNames || []).map(s => String(s || '').trim()).filter(Boolean);
    const hasAny = options.length > 0;
    const handleSelect = (e) => {
      const name = e.target.value;
      if (!name) return;
      try {
        const picked = getMon(name);
        if (picked && onReplaceFromTeam) onReplaceFromTeam(picked);
      } catch {}
      e.target.selectedIndex = 0;
    };
    return (
      <select
        title="Replace From Active Team"
        onChange={handleSelect}
        className="input"
        style={{ position:'absolute', top:44, left:8, height:28, borderRadius:8, width:'auto', maxWidth:220 }}
      >
        <option value="">Replace From Active Team</option>
        {hasAny ? (
          options.map((n, i) => <option key={`${n}-${i}`} value={n}>{titleCase(n)}</option>)
        ) : (
          <option value="" disabled>No Active Pokemon</option>
        )}
      </select>
    );
  })();

  if (!hasMon) {
    return (
      <div className="faint-grid" style={{ padding:12, position:'relative', minHeight:360, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <button
          type="button"
          className="region-btn"
          title="Replace From Live Battle"
          onClick={() => onReplace && onReplace()}
          style={{ position:'absolute', top:8, left:8 }}
        >
          Replace From Live Battle
        </button>
        {teamSelect}
        <div className="label-muted" style={{ fontWeight:700 }}>No Pokemon Selected</div>
      </div>
    );
  }

  // Helpers for two-row chip layout
  const twoRowSplit = (arr = []) => {
    const a = [...arr];
    const mid = Math.ceil(a.length / 2);
    return [a.slice(0, mid), a.slice(mid)];
  };
  const w = computeWeakness(types);
  const weaknessEntries = [
    ...w.x4.map(t => ({ t, pct: '400%' })),
    ...w.x2.map(t => ({ t, pct: '200%' })),
  ];
  const resistEntries = [
    ...w.x0_5.map(t => ({ t, pct: '50%' })),
    ...w.x0_25.map(t => ({ t, pct: '25%' })),
    ...w.x0.map(t => ({ t, pct: '0%' })),
  ];
  const [weakRow1, weakRow2] = twoRowSplit(weaknessEntries);
  const [resRow1, resRow2] = twoRowSplit(resistEntries);

  // Stat diffs vs other (when present)
  const statKeys = [
    ['HP','hp'], ['Att','attack'], ['Def','defense'],
    ['Sp. Atk','special_attack'], ['Sp. Def','special_defense'], ['Spd','speed']
  ];
  // Use display stats to correctly resolve special stats
  const sA = getDisplayStatsFrom(mon || {});
  const sB = other ? getDisplayStatsFrom(other) : {};
  const statDiffs = statKeys.map(([lab, key]) => {
    const a = Number(sA[key]) || 0;
    const b = Number(sB[key]) || 0;
    const diff = a - b;
    return { lab, diff };
  });
  const totalA = statKeys.reduce((sum, [,k]) => sum + (Number(sA[k]) || 0), 0);
  const totalB = statKeys.reduce((sum, [,k]) => sum + (Number(sB[k]) || 0), 0);
  const totalDiff = totalA - totalB;

  const rowWrapStyle = { borderTop:'1px solid var(--divider)', paddingTop:8, marginTop:8 };

  return (
    <div className="faint-grid" style={{ padding:12, position:'relative' }}>
      <button
        type="button"
        className="region-btn"
        title="Replace From Live Battle"
        onClick={() => onReplace && onReplace()}
        style={{ position:'absolute', top:8, left:8 }}
      >
        Replace From Live Battle
      </button>
      {teamSelect}
      <button
        type="button"
        className="region-btn"
        title="Swap"
        onClick={onClear}
        style={{ position:'absolute', top:8, right:8 }}
      >
        Swap
      </button>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
        <Sprite mon={mon} size={120} alt={mon.name} />
        <div style={{ fontSize:20, fontWeight:900 }}>{titleCase(mon.name)}</div>
        {mon.id != null && (
          <div className="label-muted">Dex #{mon.id}</div>
        )}
      </div>
      <div style={{ marginTop:10, display:'grid', gap:8 }}>
        {abilities.length > 0 && (
          <div style={rowWrapStyle}>
            <div style={{ display:'grid', gridTemplateColumns:'110px 1fr', gap:8, alignItems:'center' }}>
              <div className="label-muted" style={{ fontWeight:700 }}>Abilities</div>
              <div
                style={{
                  display:'grid',
                  gridTemplateColumns: `repeat(${abilities.length}, minmax(0, 1fr))`,
                  gap:8,
                  alignItems:'center',
                  // Consistent one-line row across both compare blocks
                  minHeight: 36
                }}
              >
                {abilities.map((a,i) => (
                  <AbilityPill
                    key={`${a}-${i}`}
                    label={i===2? 'Hidden' : `${i+1}`}
                    name={a}
                    compact={useCompactAbilities}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={rowWrapStyle}>
          <div style={{ display:'grid', gridTemplateColumns:'110px 1fr', gap:8, alignItems:'center' }}>
            <div className="label-muted" style={{ fontWeight:700 }}>Type</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {(types || []).map(tp => <TypePill key={tp} t={tp} />)}
            </div>
          </div>
        </div>

        <div style={rowWrapStyle}>
          <div style={{ display:'grid', gridTemplateColumns:'110px 1fr', gap:8 }}>
            <div className="label-muted" style={{ fontWeight:700, alignSelf:'center' }}>Weakness</div>
            <div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', minHeight:28 }}>
                {weakRow1.length ? weakRow1.map(({t,pct},i) => (
                  <span key={`w1-${t}-${i}`} style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                    <TypePill t={t} />
                    <span className="label-muted" style={{ fontSize:12 }}>{pct}</span>
                  </span>
                )) : <span className="label-muted">None</span>}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginTop:6, minHeight:28 }}>
                {weakRow2.length ? weakRow2.map(({t,pct},i) => (
                  <span key={`w2-${t}-${i}`} style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                    <TypePill t={t} />
                    <span className="label-muted" style={{ fontSize:12 }}>{pct}</span>
                  </span>
                )) : <span style={{ visibility:'hidden' }}>.</span>}
              </div>
            </div>
          </div>
        </div>

        <div style={rowWrapStyle}>
          <div style={{ display:'grid', gridTemplateColumns:'110px 1fr', gap:8 }}>
            <div className="label-muted" style={{ fontWeight:700, alignSelf:'center' }}>Resistance</div>
            <div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', minHeight:28 }}>
                {resRow1.length ? resRow1.map(({t,pct},i) => (
                  <span key={`r1-${t}-${i}`} style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                    <TypePill t={t} />
                    <span className="label-muted" style={{ fontSize:12 }}>{pct}</span>
                  </span>
                )) : <span className="label-muted">None</span>}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginTop:6, minHeight:28 }}>
                {resRow2.length ? resRow2.map(({t,pct},i) => (
                  <span key={`r2-${t}-${i}`} style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                    <TypePill t={t} />
                    <span className="label-muted" style={{ fontSize:12 }}>{pct}</span>
                  </span>
                )) : <span style={{ visibility:'hidden' }}>.</span>}
              </div>
            </div>
          </div>
        </div>

        {(mon.stats && Object.keys(mon.stats).length > 0) && (
          <div style={rowWrapStyle}>
            <div className="label-muted" style={{ fontWeight:700, marginBottom:6 }}>Base Stats</div>
            <StatsRow
              mon={mon}
              other={other}
              override={override}
              otherOverride={otherOverride}
              underlineKeys={underlineKeys}
              build={build}
              onSetIV={onSetIV}
              onSetEV={onSetEV}
              onSetLevel={onSetLevel}
              natureEl={natureEl}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CompareView({ left, right, onClearLeft, onClearRight, onReplaceLeft, onReplaceRight, onReplaceLeftFromTeam, onReplaceRightFromTeam }){
  const { list: natureList, byName: naturesByName } = useNatures();

  const [leftBuild, setLeftBuild] = useState(() => mkInitialBuild());
  const [rightBuild, setRightBuild] = useState(() => mkInitialBuild());

  const leftDirty = isDirty(leftBuild);
  const rightDirty = isDirty(rightBuild);

  const leftBase = useMemo(() => left ? getBaseStatsFrom(left) : null, [left]);
  const rightBase = useMemo(() => right ? getBaseStatsFrom(right) : null, [right]);

  const natureModsOf = (name) => {
    const n = naturesByName.get(normalizeKey(name || ''));
    return n?.mods || { attack:1, defense:1, special_attack:1, special_defense:1, speed:1 };
  };

  const leftOverride = useMemo(() => {
    if (!left || !leftBase) return null;
    if (!leftDirty) return null;
    const b = coerceBuild(leftBuild);
    return computeFinalStats(leftBase, b.iv, b.ev, b.level, natureModsOf(b.nature));
  }, [left, leftBase, leftBuild, leftDirty]);
  const rightOverride = useMemo(() => {
    if (!right || !rightBase) return null;
    if (!rightDirty) return null;
    const b = coerceBuild(rightBuild);
    return computeFinalStats(rightBase, b.iv, b.ev, b.level, natureModsOf(b.nature));
  }, [right, rightBase, rightBuild, rightDirty]);

  const leftUnderline = useMemo(() => underlineFrom(leftOverride, leftBase), [leftOverride, leftBase]);
  const rightUnderline = useMemo(() => underlineFrom(rightOverride, rightBase), [rightOverride, rightBase]);

  function makeSetters(side) {
    const setBuild = side === 'left' ? setLeftBuild : setRightBuild;
    return {
      onSetIV: (key, val) => setBuild((prev) => ({ ...prev, iv: { ...prev.iv, [key]: val } })),
      onSetEV: (key, val) => setBuild((prev) => {
        const next = { ...prev, ev: { ...prev.ev, [key]: val } };
        const sum = ['hp','attack','defense','special_attack','special_defense','speed'].reduce((s,k)=> s + (Number(next.ev[k] || 0) || 0), 0);
        if (sum <= 510) return next;
        const others = sum - (Number(next.ev[key] || 0) || 0);
        const allowed = Math.max(0, 510 - others);
        return { ...prev, ev: { ...prev.ev, [key]: Math.min(allowed, Number(val)||0) } };
      }),
      onSetLevel: (val) => setBuild((prev) => ({ ...prev, level: val }))
    };
  }
  const leftSetters = makeSetters('left');
  const rightSetters = makeSetters('right');

  return (
    <div style={{ marginTop:12 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <CompareBlock
          mon={left}
          other={right}
          onClear={onClearLeft}
          onReplace={onReplaceLeft}
          onReplaceFromTeam={onReplaceLeftFromTeam}
          build={leftBuild}
          onSetIV={leftSetters.onSetIV}
          onSetEV={leftSetters.onSetEV}
          onSetLevel={leftSetters.onSetLevel}
          natureEl={<NatureSelect natureList={natureList} value={leftBuild.nature} onChange={(v)=> setLeftBuild(prev=> ({...prev, nature:v}))} />}
          override={leftOverride}
          otherOverride={rightOverride}
          underlineKeys={leftUnderline}
        />
        <CompareBlock
          mon={right}
          other={left}
          onClear={onClearRight}
          onReplace={onReplaceRight}
          onReplaceFromTeam={onReplaceRightFromTeam}
          build={rightBuild}
          onSetIV={rightSetters.onSetIV}
          onSetEV={rightSetters.onSetEV}
          onSetLevel={rightSetters.onSetLevel}
          natureEl={<NatureSelect natureList={natureList} value={rightBuild.nature} onChange={(v)=> setRightBuild(prev=> ({...prev, nature:v}))} />}
          override={rightOverride}
          otherOverride={leftOverride}
          underlineKeys={rightUnderline}
        />
      </div>
    </div>
  );
}

function LevelPill({ min, max, compact=false }){
  const { rarityColors } = useContext(ColorContext);
  const hasMin = min != null;
  const hasMax = max != null;
  if (!hasMin && !hasMax) return null;
  const label = hasMin && hasMax
    ? (min === max ? `Lv. ${min}` : `Lv. ${min}-${max}`)
    : `Lv. ${hasMin ? min : max}`;
  const bg = rarityColors['level'] || '#9e50aaff';
  return (
    <span style={{
      display:'inline-block', padding:'2px 8px', fontSize:compact?11:12, borderRadius:999,
      color:'#111', background:bg, fontWeight:800, border:'1px solid #00000022'
    }}>
      {label}
    </span>
  );
}

function ItemPill({ item, compact=false }){
  const { rarityColors } = useContext(ColorContext);
  if (!item) return null;
  const bg = rarityColors['held item'] || '#F8E473';
  return (
    <span style={{
      display:'inline-block', padding:'2px 8px', fontSize:compact?11:12, borderRadius:999,
      color:'#111', background:bg, fontWeight:800, border:'1px solid #00000022'
    }}>
      {item}
    </span>
  );
}

function AreaMonCard({
  mon,
  monName,
  encounters,
  onView,
  caught=false,
  onToggleCaught,
  showCaught=true,
  showEv=true,
  showCatchRate=true,
  showCatchPercent=true,
  showHeldItem=true,
  showLevel=true
}){
  const cardStyle = {
    ...styles.monCard,
    opacity: showCaught ? (caught ? 0.4 : 1) : 1,
    cursor: mon && onView ? 'pointer' : 'default'
  };
  const compact = encounters.length > 1;
  const scrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const wrapStyle = {
    ...styles.encWrap,
    justifyContent: hasOverflow ? 'flex-start' : 'center'
  };
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setShowLeftArrow(el.scrollLeft > 0);
      setShowRightArrow(el.scrollLeft + el.clientWidth < el.scrollWidth);
      setHasOverflow(el.scrollWidth > el.clientWidth);
    };
    update();
    el.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [encounters]);
  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior:'smooth' });
  };
  const handleClick = () => {
    if (mon && onView) onView(mon);
  };
  const evLabel = (() => {
    if (!mon || !showEv) return null;
    const evMap = {
      ev_hp: 'HP',
      ev_attack: 'Atk',
      ev_defense: 'Def',
      ev_sp_attack: 'SpA',
      ev_sp_defense: 'SpD',
      ev_speed: 'Spe'
    };
    const yields = mon.yields || {};
    const parts = Object.entries(evMap)
      .filter(([k]) => (yields[k] || 0) > 0)
      .map(([k, label]) => `${yields[k]} ${label}`);
    if (!parts.length) return null;
    if (parts.length > 1) {
      return `EV- ${parts[0]}\n${parts.slice(1).join('\n')}`;
    }
    return `EV- ${parts[0]}`;
  })();
  const catchRate = mon?.catchRate ?? catchRates[mon?.id];
  const catchRateLabel = (catchRate != null && showCatchRate)
    ? `CR- ${catchRate}`
    : null;
  const catchPercentLabel = (catchRate != null && showCatchPercent)
    ? `%- ${(calcCatchChance(catchRate) * 100).toFixed(1)}`
    : null;
  const infoChips = [evLabel, catchRateLabel, catchPercentLabel].filter(Boolean);
  return (
    <div style={cardStyle} onClick={handleClick}>
      {infoChips.length > 0 && (
        <div
          style={{
            position:'absolute', top:6, left:6,
            display:'flex', flexDirection:'column', gap:4,
            alignItems:'flex-start'
          }}
        >
          {infoChips.map((txt, i) => (
            <span
              key={i}
              style={{
                display:'inline-block', padding:'2px 8px', fontSize:11,
                borderRadius:999, color:'var(--text)', background:'var(--surface)',
                border:'1px solid var(--divider)', fontWeight:700,
                whiteSpace:'pre-line'
              }}
            >
              {txt}
            </span>
          ))}
        </div>
      )}
      {showCaught && (
        <button
          onClick={e => { e.stopPropagation(); onToggleCaught && onToggleCaught(); }}
          title={caught ? 'Mark as uncaught' : 'Mark as caught'}
          style={{ position:'absolute', top:6, right:6, background:'transparent', border:'none', cursor:'pointer', padding:0, fontSize:0 }}
        >
          <PokeballIcon filled={caught} size={30} />
        </button>
      )}
      <div style={{ fontWeight:700 }}>{monName}</div>
      <Sprite mon={mon} size={80} alt={monName} />
      <div style={{ position:'relative', width:'100%', overflow:'hidden' }}>
        <div ref={scrollRef} className="encounter-scroll" style={wrapStyle}>
          {encounters.map((enc, idx) => (
            <div key={idx} style={styles.encCol}>
              {enc.method && <MethodPill method={enc.method} compact={compact} hordeSize={enc.hordeSize} />}
              {!/lure/i.test(enc.method || '') &&
                enc.rarities.map(r => (
                  <RarityPill key={`r-${idx}-${r}`} rarity={r} compact={compact} hordeSize={enc.hordeSize} />
                ))}
              {showLevel && <LevelPill min={enc.min} max={enc.max} compact={compact} />}
              {showHeldItem && enc.items.map(i => <ItemPill key={`i-${idx}-${i}`} item={i} compact={compact} />)}
            </div>
          ))}
        </div>
        {showLeftArrow && (
          <button
            onClick={e => { e.stopPropagation(); scroll(-1); }}
            style={{
              position:'absolute',
              top:'50%',
              left:0,
              transform:'translateY(-50%)',
              background:'var(--card)',
              border:'1px solid var(--divider)',
              color:'var(--text)',
              cursor:'pointer',
              borderRadius:'50%',
              width:24,
              height:24,
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              boxShadow:'0 0 4px rgba(0,0,0,0.5)'
            }}
            aria-label="Scroll left"
          >
            ?
          </button>
        )}
        {showRightArrow && (
          <button
            onClick={e => { e.stopPropagation(); scroll(1); }}
            style={{
              position:'absolute',
              top:'50%',
              right:0,
              transform:'translateY(-50%)',
              background:'var(--card)',
              border:'1px solid var(--divider)',
              color:'var(--text)',
              cursor:'pointer',
              borderRadius:'50%',
              width:24,
              height:24,
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              boxShadow:'0 0 4px rgba(0,0,0,0.5)'
            }}
            aria-label="Scroll right"
          >
            ?
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Loaders ---------- */
function useTmLocations(){
  const [index, setIndex] = useState({});
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(TM_URL, { cache:'no-store' });
        const json = await res.json();
        if (alive) setIndex(json || {});
      } catch (e) {
        console.error('load tm locations failed', e);
        if (alive) setIndex({});
      }
    })();
    return () => { alive = false; };
  }, []);
  return index;
}

/* ======================= LIVE ROUTE: WS client + Panel ======================= */

const STALE_AFTER_MS = 6000;
// Live battle requires more aggressive reconnects to stay in sync with the
// in-game action. Reconnect if no updates arrive within this window.
const BATTLE_STALE_AFTER_MS = 2000;

function normalizeHudText(s=''){
  let t = String(s).replace(/\r/g,'').trim();
  const lines = t.split(/\n+/).map((line) => {
    // Strip channel numbers like "Ch3" (or stray "Ch") that sometimes trail the route name
    let l = line.replace(/\bCh(?:\.|:)?\s*\d*\b/gi, '');
    l = l.replace(/\s{2,}/g,' ').trim();
    return l;
  }).filter(Boolean);
  t = lines.join('');
  // Treat OCR results that are just dashes as empty/no data
  if (/^-+$/.test(t)) return '';
  return t;
}

function similarity(a='', b=''){
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  const len1 = s1.length;
  const len2 = s2.length;
  const dp = Array.from({ length: len2 + 1 }, () => Array(len1 + 1).fill(0));
  for (let i = 0; i <= len2; i++) dp[i][0] = i;
  for (let j = 0; j <= len1; j++) dp[0][j] = j;
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (s1[j - 1] === s2[i - 1] ? 0 : 1)
      );
    }
  }
  const dist = dp[len2][len1];
  return (len1 === 0 && len2 === 0) ? 1 : 1 - dist / Math.max(len1, len2);
}

function coerceIncoming(msg){
  if (!msg) return null;
  if (typeof msg === 'string') {
    // Plain route or tagged variants
    const mTagged = msg.match(/^(?:ROUTE\|route:)?\s*(.+)$/i);
    if (mTagged) return { routeText: mTagged[1], confidence: null };
    // GUESS: "..."
    const m = msg.match(/GUESS:\s*"?([^"]+?)"?\s*$/i);
    if (m) return { routeText: m[1], confidence: null };
    if (msg.trim() === 'NO_ROUTE') return { routeText: '', confidence: 0 };
    return null;
  }
  const src = msg.payload || msg.data || msg;
  let t = src.text ?? src.route ?? src.name ?? src.guess ?? null;
  if (!t && typeof src.type === 'string' && src.type === 'no_route') t = '';
  if (!t && typeof src.line === 'string') {
    const m = src.line.match(/GUESS:\s*"?([^"]+?)"?\s*$/i);
    if (m) t = m[1];
  }
  if (!t && typeof src.message === 'string') {
    const m = src.message.match(/GUESS:\s*"?([^"]+?)"?\s*$/i);
    if (m) t = m[1];
  }
  let c = src.confidence ?? src.conf ?? src.c
  if (typeof c === 'string') { const f = parseFloat(c); if (!Number.isNaN(f)) c = f; }
  return (t !== null) ? { routeText: t, confidence: c } : null;
}

function coerceBattleIncoming(msg){
  if (!msg) return null;
  if (typeof msg === 'string') {
    if (msg.trim() === 'NO_MON') return { monText: '', confidence: 0 };
    const mTagged = msg.match(/^(?:MON\|mon:)?\s*(.+)$/i);
    if (mTagged) return { monText: mTagged[1], confidence: null };
    return { monText: msg, confidence: null };
  }
  const src = msg.payload || msg.data || msg;
  let t = src.text ?? src.mon ?? src.name ?? null;
  if (!t && typeof src.line === 'string') t = src.line;
  if (!t && typeof src.message === 'string') t = src.message;
  let c = src.confidence ?? src.conf ?? src.c;
  if (typeof c === 'string') { const f = parseFloat(c); if (!Number.isNaN(f)) c = f; }
  return (t !== null) ? { monText: t, confidence: c } : null;
}

/* ======================= LIVE ROUTE PANEL ======================= */

function LiveRoutePanel({ areasIndex, locIndex, onViewMon }){
  const [ocrEnabled, setOcrEnabled] = useState(isOcrEnabled());
  // Restore last confirmed route so it persists between tab switches
  const LAST_KEY = 'liveRouteLast';
  const lastRoute = (() => {
    try { return JSON.parse(localStorage.getItem(LAST_KEY) || '{}'); }
    catch { return {}; }
  })();

  const [rawText, setRawText] = useState(lastRoute.rawText || '');
  const [confidence, setConfidence] = useState(lastRoute.confidence ?? null);
  const [displayMap, setDisplayMap] = useState(lastRoute.displayMap || null);
  const [region, setRegion] = useState(lastRoute.region || null);
  const [entries, setEntries] = useState([]);
  const [connected, setConnected] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [regionChoices, setRegionChoices] = useState(() =>
    displayMap ? listRegionCandidates(areasIndex, displayMap) : []
  );
  const [methodFilters, setMethodFilters] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('liveMethodFilters') || '[]');
      const valid = Array.isArray(saved) ? saved.filter(t => ENCOUNTER_TYPES.includes(t)) : [];
      return new Set(valid.length ? valid : ENCOUNTER_TYPES);
    } catch {
      return new Set(ENCOUNTER_TYPES);
    }
  });
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showInfoMenu, setShowInfoMenu] = useState(false);
  const [showCaught, setShowCaught] = useState(() => {
    try { return JSON.parse(localStorage.getItem('liveShowCaught') ?? 'true'); }
    catch { return true; }
  });
  const [showEvYield, setShowEvYield] = useState(() => {
    try { return JSON.parse(localStorage.getItem('liveShowEvYield') ?? 'true'); }
    catch { return true; }
  });
  const [showCatchRate, setShowCatchRate] = useState(() => {
    try { return JSON.parse(localStorage.getItem('liveShowCatchRate') ?? 'true'); }
    catch { return true; }
  });
  const [showCatchPercent, setShowCatchPercent] = useState(() => {
    try { return JSON.parse(localStorage.getItem('liveShowCatchPercent') ?? 'true'); }
    catch { return true; }
  });
  const [showHeldItem, setShowHeldItem] = useState(() => {
    try { return JSON.parse(localStorage.getItem('liveShowHeldItem') ?? 'true'); }
    catch { return true; }
  });
  const [showLevel, setShowLevel] = useState(() => {
    try { return JSON.parse(localStorage.getItem('liveShowLevel') ?? 'true'); }
    catch { return true; }
  });
  const [showRegionMenu, setShowRegionMenu] = useState(false);
  const filterRef = useRef(null);
  const infoRef = useRef(null);
  const methodFiltersRef = useRef(methodFilters);
  const displayMapRef = useRef(displayMap);

  const { caught, toggleCaught } = React.useContext(CaughtContext);

  useEffect(() => {
    methodFiltersRef.current = methodFilters;
    try { localStorage.setItem('liveMethodFilters', JSON.stringify([...methodFilters])); } catch {}
  }, [methodFilters]);

  useEffect(() => { displayMapRef.current = displayMap; }, [displayMap]);

  useEffect(() => { setShowRegionMenu(false); }, [regionChoices, displayMap]);

  useEffect(() => {
    const onDoc = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilterMenu(false);
      if (infoRef.current && !infoRef.current.contains(e.target)) setShowInfoMenu(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('liveShowCaught', JSON.stringify(showCaught)); } catch {}
  }, [showCaught]);
  useEffect(() => {
    try { localStorage.setItem('liveShowEvYield', JSON.stringify(showEvYield)); } catch {}
  }, [showEvYield]);
  useEffect(() => {
    try { localStorage.setItem('liveShowCatchRate', JSON.stringify(showCatchRate)); } catch {}
  }, [showCatchRate]);
  useEffect(() => {
    try { localStorage.setItem('liveShowCatchPercent', JSON.stringify(showCatchPercent)); } catch {}
  }, [showCatchPercent]);
  useEffect(() => {
    try { localStorage.setItem('liveShowHeldItem', JSON.stringify(showHeldItem)); } catch {}
  }, [showHeldItem]);
  useEffect(() => {
    try { localStorage.setItem('liveShowLevel', JSON.stringify(showLevel)); } catch {}
  }, [showLevel]);

  const toggleFilter = (m) => {
    setMethodFilters(prev => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });
  };

  useEffect(() => {
    if (displayMap) {
      setEntries(buildGroupedEntries(areasIndex, displayMap, region, locIndex, methodFilters));
    }
  }, [methodFilters, areasIndex, displayMap, region, locIndex]);

  // Update available region choices whenever map changes
  useEffect(() => {
    if (displayMap) {
      setRegionChoices(listRegionCandidates(areasIndex, displayMap));
    } else {
      setRegionChoices([]);
    }
  }, [areasIndex, displayMap]);

  // Handle messages
  // React to OCR enabled/disabled changes
  useEffect(() => {
    const onChange = (e) => {
      const en = !!(e?.detail?.enabled ?? isOcrEnabled());
      setOcrEnabled(en);
      try { liveRouteClient.setEnabled(en); } catch {}
      if (!en) {
        setConnected(false);
        setIsStale(false);
      }
    };
    window.addEventListener('ocr-enabled-changed', onChange);
    return () => window.removeEventListener('ocr-enabled-changed', onChange);
  }, []);

  useEffect(() => {
    if (!ocrEnabled) {
      try { liveRouteClient.setEnabled(false); } catch {}
      return; // Don't connect or listen when disabled
    }
    const off = liveRouteClient.on((msg) => {
      const coerced = coerceIncoming(msg);
      if (!coerced) return;

      let cleaned = normalizeHudText(coerced.routeText);
      if (DEBUG_LIVE) console.log('[LIVE] OCR raw:', coerced.routeText, '-> cleaned:', cleaned);

      const { cleaned: trimmed, best } = findBestMapInText(cleaned, areasIndex);
      if (!best) return; // ignore noisy frames
      // Re-normalize after map extraction in case channel text slipped through
      cleaned = normalizeHudText(trimmed);

      const targetName = best.displayMap;
      const choices = listRegionCandidates(areasIndex, targetName);
      setRegionChoices(choices);
      setConfidence(coerced.confidence ?? null);
      if (targetName === displayMapRef.current) return;

      // choose region: saved pref -> best -> first choice
      const prefKey = `regionPref:${targetName}`;
      let picked = localStorage.getItem(prefKey);
      if (picked && !choices.includes(picked)) picked = null;
      const chosen = picked || best.region || choices[0] || null;

      setRawText(targetName);
      setRegion(chosen);
      setDisplayMap(targetName);
      setEntries(buildGroupedEntries(areasIndex, targetName, chosen, locIndex, methodFiltersRef.current));
      try {
        localStorage.setItem(LAST_KEY, JSON.stringify({
          rawText: targetName,
          confidence: coerced.confidence ?? null,
          displayMap: targetName,
          region: chosen,
        }));
      } catch {}
    });

    liveRouteClient.connect();

    // heartbeat watcher for stale/connected pill
    const pulse = setInterval(() => {
      setConnected(liveRouteClient.isOpen());
      const last = liveRouteClient.lastMsgTs || 0;
      setIsStale(!!rawText && Date.now() - last > STALE_AFTER_MS);
    }, 1000);

    // NEW: respond to "Reload OCR" signal (clear panel + reconnect)
    const onForce = () => {
      setRawText('');
      setConfidence(null);
      setDisplayMap(null);
      setRegion(null);
      setEntries([]);
      setRegionChoices([]);
      try { localStorage.removeItem(LAST_KEY); } catch {}
      liveRouteClient.forceReconnect();
    };
    window.addEventListener('force-live-reconnect', onForce);

    // Reconnect when tab becomes visible again (tab-away fix)
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        liveRouteClient.forceReconnect();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    // Also reconnect on window focus (covers some browsers)
    const onFocus = () => {
      liveRouteClient.forceReconnect();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      off();
      clearInterval(pulse);
      window.removeEventListener('force-live-reconnect', onForce);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areasIndex, locIndex, rawText, ocrEnabled]);

  const statusPill = (() => {
    if (!connected) return <span className="px-2 py-1 rounded-xl bg-red-600/20 text-red-300 text-xs">Disconnected</span>;
    if (isStale)   return <span className="px-2 py-1 rounded-xl bg-yellow-600/20 text-yellow-300 text-xs">Stale</span>;
    return <span className="px-2 py-1 rounded-xl bg-green-600/20 text-green-300 text-xs"></span>;
  })();

  const confPct = formatConfidence(confidence);
  // When user changes region via segmented buttons
  const handleRegionChange = (r) => {
    setRegion(r);
    if (displayMap) {
      const prefKey = `regionPref:${displayMap}`;
      localStorage.setItem(prefKey, r || '');
      setEntries(buildGroupedEntries(areasIndex, displayMap, r, locIndex, methodFilters));
      try {
        const prev = JSON.parse(localStorage.getItem(LAST_KEY) || '{}');
        localStorage.setItem(LAST_KEY, JSON.stringify({ ...prev, region: r }));
      } catch {}
    }
  };

  if (!ocrEnabled) {
    return (
      <div className="p-3" style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div className="label-muted">OCR disabled in settings</div>
      </div>
    );
  }

  return (
    <div className="p-3" style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
        <div className="label-muted">
          Live Location: <span style={{ fontWeight:800 }}>{stripTimeTag(rawText || '—')}</span>
          {SHOW_CONFIDENCE && (confPct !== null) && (
            <span className="text-slate-400 ml-2">({confPct}% Confidence)</span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div ref={infoRef} style={{ position:'relative' }}>
            <button
              className="region-btn"
              onClick={() => setShowInfoMenu(v => !v)}
            >
              Encounter Info {showInfoMenu ? '▴' : '▾'}
            </button>
            {showInfoMenu && (
              <div
                style={{ position:'absolute', right:0, top:'100%', marginTop:4, padding:8, background:'var(--surface)', border:'1px solid var(--divider)', borderRadius:8, zIndex:20, display:'flex', flexDirection:'column', gap:4 }}
              >
                <label className="label-muted" style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <input
                    type="checkbox"
                    checked={showCaught}
                    onChange={e=>setShowCaught(e.target.checked)}
                  />
                  Toggle Caught
                </label>
                <label className="label-muted" style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <input
                    type="checkbox"
                    checked={showEvYield}
                    onChange={e=>setShowEvYield(e.target.checked)}
                  />
                  EV Yield
                </label>
                <label className="label-muted" style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <input
                    type="checkbox"
                    checked={showCatchRate}
                    onChange={e=>setShowCatchRate(e.target.checked)}
                  />
                  Catch Rate
                </label>
                <label className="label-muted" style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <input
                    type="checkbox"
                    checked={showCatchPercent}
                    onChange={e=>setShowCatchPercent(e.target.checked)}
                  />
                  Catch %
                </label>
                <label className="label-muted" style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <input
                    type="checkbox"
                    checked={showHeldItem}
                    onChange={e=>setShowHeldItem(e.target.checked)}
                  />
                  Held Item
                </label>
                <label className="label-muted" style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <input
                    type="checkbox"
                    checked={showLevel}
                    onChange={e=>setShowLevel(e.target.checked)}
                  />
                  Level
                </label>
              </div>
            )}
          </div>
          <div ref={filterRef} style={{ position:'relative' }}>
            <button
              className="region-btn"
              onClick={() => setShowFilterMenu(v => !v)}
            >
              Encounter Type {showFilterMenu ? '▴' : '▾'}
            </button>
            {showFilterMenu && (
              <div
                style={{ position:'absolute', right:0, top:'100%', marginTop:4, padding:8, background:'var(--surface)', border:'1px solid var(--divider)', borderRadius:8, zIndex:20, display:'flex', flexDirection:'column', gap:4 }}
              >
                {ENCOUNTER_TYPES.map(t => (
                  <label key={t} className="label-muted" style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <input
                      type="checkbox"
                      checked={methodFilters.has(t)}
                      onChange={() => toggleFilter(t)}
                    />
                    {t}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="label-muted">{statusPill}</div>
        </div>
      </div>

      {!rawText && (
        <div className="label-muted">
          <b>LiveRouteOCR</b> is attempting to find Route Data... Adjust the OCR settings in Options if it is having trouble.
        </div>
      )}

      {rawText && !displayMap && (
        <div className="label-muted">No Route Found. Adjust OCR settings in Options or ensure you are on a valid route.</div>
      )}

      {displayMap && (
        <div style={styles.areaCard}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontWeight:800, fontSize:16 }}>
                {stripTimeTag(displayMap)} {region ? <span className="label-muted">({titleCase(region)})</span> : null}
              </div>
              <div className="label-muted">{entries.length} Pokemon</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {regionChoices.length > 1 && (
                <div style={{ position:'relative' }}>
                  <button
                    type="button"
                    onClick={()=> setShowRegionMenu(v => !v)}
                    className="region-btn"
                  >
                    {region ? titleCase(region) : 'Region'}
                  </button>
                  {showRegionMenu && (
                    <div className="region-menu">
                      {regionChoices.map(r => (
                        <button
                          type="button"
                          key={r}
                          onClick={()=> { handleRegionChange(r); setShowRegionMenu(false); }}
                          className={r===region ? 'active' : undefined}
                        >
                          {titleCase(r)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="label-muted" style={{ marginTop:8 }}>No encounter data found for this area.</div>
          ) : (
            <div style={{ ...styles.gridCols, marginTop:10 }}>
              {entries.map((g, idx) => {
                const mon = getMon(g.monName);
                const isCaught = mon ? caught.has(mon.id) : false;
                return (
                  <AreaMonCard
                    key={idx}
                    mon={mon}
                    monName={g.monName}
                    encounters={g.encounters}
                    onView={onViewMon}
                    caught={isCaught}
                    showCaught={showCaught}
                    showEv={showEvYield}
                    showCatchRate={showCatchRate}
                    showCatchPercent={showCatchPercent}
                    showHeldItem={showHeldItem}
                    showLevel={showLevel}
                    onToggleCaught={() => mon && toggleCaught(mon.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {DEBUG_LIVE && rawText && (
        <div className="label-muted" style={{ fontSize:12, opacity:.6 }}>
          Debug key: <code>{aliasKey(rawText)}</code>
        </div>
      )}
    </div>
  );
}

/* ======================= LIVE BATTLE PANEL ======================= */
function LiveBattlePanel({ onViewMon, onCompare }){
  const [ocrEnabled, setOcrEnabled] = useState(isOcrEnabled());
  const [rawText, setRawText] = useState('');
  const [confidence, setConfidence] = useState(null);
  const [mons, setMons] = useState([]);
  const [connected, setConnected] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [showCaught, setShowCaught] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('liveBattleShowCaught') ?? 'true');
    } catch {
      return true;
    }
  });
  const { caught, toggleCaught } = React.useContext(CaughtContext);

  useEffect(() => {
    try { localStorage.setItem('liveBattleShowCaught', JSON.stringify(showCaught)); } catch {}
  }, [showCaught]);
  
  // React to OCR enabled/disabled changes
  useEffect(() => {
    const onChange = (e) => {
      const en = !!(e?.detail?.enabled ?? isOcrEnabled());
      setOcrEnabled(en);
      try { liveBattleClient.setEnabled(en); } catch {}
      if (!en) {
        setConnected(false);
        setIsStale(false);
      }
    };
    window.addEventListener('ocr-enabled-changed', onChange);
    return () => window.removeEventListener('ocr-enabled-changed', onChange);
  }, []);

  useEffect(() => {
    if (!ocrEnabled) {
      try { liveBattleClient.setEnabled(false); } catch {}
      return; // Skip binding when disabled
    }
    const off = liveBattleClient.on((msg) => {
      const coerced = coerceBattleIncoming(msg);
      if (!coerced) return;
      let cleaned = normalizeHudText(coerced.monText);
      cleaned = cleaned
        .replace(/([A-Za-z])([Ll][Vv])/g, '$1 $2')
        .replace(/([A-Za-z])([Hh][Pp])/g, '$1 $2')
        .replace(/([A-Za-z])([Pp][Cc])/g, '$1 $2')
        // Break up fused names like "GloomGloom" that sometimes occur when
        // multiple health bars overlap in horde battles. Also ensure digits and
        // letters don't run together.
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/(\\d)([A-Za-z])/g, '$1 $2')
        .replace(/\b(?:HP|pc)\s*\d+\/\d+\b/gi, '')
        .replace(/\s*\s*/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      const compacted = cleaned.replace(/\s+/g, '');
      // If OCR returns nothing, reset the OCR state so the next detection
      // starts fresh, but keep showing the last detected Pokemon to avoid UI flicker
      if (!compacted) {
        setRawText('');
        setConfidence(null);
        return;
      }
      const lower = cleaned.toLowerCase();
      const compact = lower.replace(/[^a-z0-9]+/g, '');
      const matches = lower.match(POKE_NAME_REGEX) || [];
      const compactMatches = compact.match(POKE_NAME_COMPACT_REGEX) || [];
      let names = Array.from(new Set([...matches, ...compactMatches].map(normalizeKey)))
        .map(n => getMon(n)?.name)
        .filter(Boolean);

        if (names.length === 0) {
        const candLines = cleaned.split(/\n+/).map(s => s.trim()).filter(Boolean);
        const fuzzySet = new Set();
        for (const line of candLines) {
          const key = normalizeKey(line);
          let mon = getMon(key);
          if (!mon) {
            let best = null;
            let bestScore = 0;
            for (const m of DEX_LIST) {
              const score = similarity(key, normalizeKey(m.name));
              if (score > bestScore) { best = m; bestScore = score; }
            }
            if (best && bestScore >= 0.8) mon = best;
          }
          if (mon) fuzzySet.add(mon.name);
        }
        names = [...fuzzySet];
      }
      
      // If no Pokemon names are detected, reset OCR state but keep the last
      // displayed Pokemon until a different one is identified
      if (names.length === 0) {
        if (DEBUG_LIVE) console.log('[LIVE] No Pokemon names detected:', cleaned);
        setRawText('');
        setConfidence(null);
        return;
      }
      if (cleaned !== rawText) setRawText(cleaned);
      setConfidence(coerced.confidence ?? null);
      const prev = mons.map(m => m.name).sort().join('|');
      const next = names.slice().sort().join('|');
      if (prev !== next) {
        setMons(
          names
            .map(n => {
              const m = getMon(n);
              return m ? { ...m } : null;
            })
            .filter(Boolean)
        );
      }
    });

    const pulse = setInterval(() => {
      setConnected(liveBattleClient.isOpen());
      const last = liveBattleClient.lastMsgTs || 0;
      const stale = Date.now() - last > BATTLE_STALE_AFTER_MS;
      setIsStale(!!rawText && stale);
      if (stale && liveBattleClient.isOpen()) {
        // Force a reconnect to prompt fresh OCR data when the feed goes stale.
        liveBattleClient.forceReconnect();
      }
    }, 1000);

    const onForce = () => {
      setRawText('');
      setConfidence(null);
      setMons([]);
    };
    window.addEventListener('force-live-reconnect', onForce);

    return () => {
      off();
      clearInterval(pulse);
      window.removeEventListener('force-live-reconnect', onForce);
    };
  }, [rawText, ocrEnabled]);

  const statusPill = (() => {
    if (!connected) return <span className="px-2 py-1 rounded-xl bg-red-600/20 text-red-300 text-xs">Disconnected</span>;
    if (isStale)   return <span className="px-2 py-1 rounded-xl bg-yellow-600/20 text-yellow-300 text-xs">Stale</span>;
    return <span className="px-2 py-1 rounded-xl bg-green-600/20 text-green-300 text-xs"></span>;
  })();

  const confPct = formatConfidence(confidence);
  const nameText = mons.length > 0 ? mons.map(m => m.name).join(' | ') : 'No Pokemon Detected';
  useEffect(() => {
    try { window.liveBattleLastMons = mons; } catch {}
  }, [mons]);

  useEffect(() => {
    mons.forEach(mon => {
      if (mon.catchRate != null) return;
      const localRate = catchRates[mon.id];
      if (localRate != null) {
        setMons(prev =>
          prev.map(m => (m.id === mon.id ? { ...m, catchRate: localRate } : m))
        );
        return;
      }
      fetch(`https://pokeapi.co/api/v2/pokemon-species/${mon.id}/`)
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (!data) return;
          setMons(prev =>
            prev.map(m => (m.id === mon.id ? { ...m, catchRate: data.capture_rate } : m))
          );
        })
        .catch(() => {});
    });
  }, [mons]);

  if (!ocrEnabled) {
    return (
      <div className="p-3" style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div className="label-muted">OCR disabled in settings</div>
      </div>
    );
  }

  return (
    <div className="p-3" style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
        <div className="label-muted">
          Live Battle: <span style={{ fontWeight:800, whiteSpace:'pre-line' }}>{nameText}</span>
          {SHOW_CONFIDENCE && (confPct !== null) && (
            <span className="text-slate-400 ml-2">({confPct}% Confidence)</span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <label className="label-muted" style={{ display:'flex', alignItems:'center', gap:4 }}>
            <input
              type="checkbox"
              checked={showCaught}
              onChange={e=>setShowCaught(e.target.checked)}
            />
            Toggle Caught
          </label>
          <div className="label-muted">{statusPill}</div>
        </div>
      </div>

      {!rawText && mons.length === 0 && (
        <div className="label-muted">
          <b>LiveBattleOCR</b> is attempting to find Pokemon... Ensure you are in a battle or adjust the OCR settings in Options.
        </div>
      )}

      {rawText && mons.length === 0 && (
        <div className="label-muted">No matching Pokemon found.</div>
      )}

      {mons.length > 0 && (
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: mons.length === 1 ? '1fr' : '1fr 1fr'
          }}
        >
          {mons.map(mon => {
            const isSolo = mons.length === 1;
            const isCaught = caught.has(mon.id);
            const weakness = computeWeakness(mon.types);
            const wList = [
              ...weakness.x4.map(t => ({ t, mult: 400 })),
              ...weakness.x2.map(t => ({ t, mult: 200 })),
              ...weakness.x0.map(t => ({ t, mult: 0 }))
            ];
            const evMap = {
              ev_hp: 'HP',
              ev_attack: 'Atk',
              ev_defense: 'Def',
              ev_sp_attack: 'SpA',
              ev_sp_defense: 'SpD',
              ev_speed: 'Spe'
            };
            const evs = Object.entries(evMap)
              .filter(([k]) => (mon.yields || {})[k] > 0)
              .map(([k, label]) => `${(mon.yields || {})[k]} ${label}`);
            const held = (mon.heldItems || []).map(h => h.name).join(', ') || 'None';
            const statMap = {
              hp: 'HP',
              attack: 'Atk',
              defense: 'Def',
              sp_attack: 'SpA',
              sp_defense: 'SpD',
              speed: 'Spe'
            };
            const catchPercent = mon.catchRate != null
              ? (calcCatchChance(mon.catchRate) * 100).toFixed(1)
              : null;
            return (
              <div
                key={mon.id}
                style={{
                  ...styles.areaCard,
                  display: 'flex',
                  justifyContent: 'center',
                  padding: isSolo ? 24 : 12,
                  position: 'relative',
                  opacity: showCaught ? (isCaught ? 0.4 : 1) : 1
                }}
              >
                {onCompare && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onCompare(mon); }}
                    title="Compare"
                    className="region-btn"
                    style={{ position: 'absolute', top: 6, right: 36 }}
                  >
                    Compare
                  </button>
                )}
                <button
                  onClick={() => onViewMon?.(mon)}
                  style={{
                    appearance: 'none',
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    margin: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: isSolo ? 12 : 8,
                    width: '100%',
                    textAlign: 'center',
                    color: 'inherit'
                  }}
                >
                  <Sprite
                    mon={mon}
                    size={isSolo ? 140 : 80}
                    alt={mon.name}
                  />
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: isSolo ? 24 : 16
                    }}
                  >
                    {titleCase(mon.name)}
                  </div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: isSolo ? 16 : 14
                    }}
                  >
                    #{mon.id}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginTop: 6
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: isSolo ? 18 : 16 }}>Type:</span>
                    {(mon.types || []).map(t => (
                      <TypePill key={t} t={t} large />
                    ))}
                  </div>
                  <div style={{ marginTop: 6, width: '100%' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 8
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: isSolo ? 18 : 16 }}>Weakness:</span>
                      {wList.length
                        ? wList.map(w => (
                            <div
                              key={`${w.t}-${w.mult}`}
                              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <TypePill t={w.t} large />
                              <span style={{ fontWeight: 600, fontSize: isSolo ? 16 : 14 }}>
                                {w.mult === 0 ? 'Immune' : `${w.mult}%`}
                              </span>
                            </div>
                          ))
                        : <div className="label-muted">None</div>}
                    </div>
                  </div>
                  <div style={{ marginTop: 8, width: '100%', textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: isSolo ? 18 : 16, marginBottom: 4 }}>Details</div>
                    <div
                      style={{
                        display: 'grid',
                        gap: 6,
                        fontSize: isSolo ? 16 : 15
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 4, alignItems:'flex-start' }}>
                        <div style={{ fontWeight: 600, whiteSpace:'nowrap' }}>EV Yield:</div>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start' }}>
                          {evs.length ? evs.map((e,i) => (
                            <div key={i} style={{ lineHeight:1.2 }}>{e}</div>
                          )) : 'None'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                        <div style={{ fontWeight: 600 }}>Held Items:</div>
                        <div>{held}</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                        <div style={{ fontWeight: 600 }}>Catch Rate:</div>
                        <div>
                          {mon.catchRate != null
                            ? `${mon.catchRate} | ${catchPercent}%`
                            : '—'}
                        </div>
                      </div>
                      <div style={{ fontWeight: 600 }}>Base Stats:</div>
                      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 6 }}>
                        {Object.entries(statMap).map(([k, label]) => (
                          <InfoPill key={k} label={label} value={(mon.stats || {})[k] ?? '-'} large />
                        ))}
                        {(() => {
                          const s = mon.stats || {};
                          const total = ['hp','attack','defense','sp_attack','sp_defense','speed']
                            .map(k => Number(s[k]) || 0)
                            .reduce((a,b)=>a+b, 0);
                          return <InfoPill label="Total" value={total || '-'} large />;
                        })()}
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleCaught(mon.id); }}
                  title={isCaught ? 'Mark as uncaught' : 'Mark as caught'}
                  style={{ position: 'absolute', top: 6, right: 6, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <PokeballIcon filled={isCaught} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ======================= REVERSE AREAS -> MON INDEX ======================= */
function buildReverseAreasIndex(areasClean) {
  const rev = new Map();
  for (const [region, maps] of Object.entries(areasClean || {})) {
    for (const [mapName, entries] of Object.entries(maps || {})) {
      const grouped = groupEntriesByMon(entries);
      for (const g of grouped) {
        if (!rev.has(g.monId)) rev.set(g.monId, []);
        rev.get(g.monId).push({
          region,
          map: normalizeMapForGrouping(region, mapName),
          encounters: g.encounters || []
        });
      }
    }
  }
  return rev;
}

/* ======================= APP ======================= */
function App(){
  const platform = React.useMemo(() => {
    const p = window.app?.platform || navigator?.userAgent || '';
    const ua = String(p).toLowerCase();
    if (ua.includes('win')) return 'win32';
    if (ua.includes('linux')) return 'linux';
    return 'other';
  }, []);
  const isWindows = platform === 'win32';
  const isLinux = platform === 'linux';
  const ocrSupported = isWindows || isLinux;

  // Global shiny sprites toggle (mirrors Options menu)
  const [shinyGlobal, setShinyGlobal] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shinySprites') ?? 'false'); } catch { return false; }
  });
  useEffect(() => {
    const onChange = (e) => setShinyGlobal(!!e?.detail?.enabled);
    window.addEventListener('shiny-global-changed', onChange);
    return () => window.removeEventListener('shiny-global-changed', onChange);
  }, []);
  const [profileShiny, setProfileShiny] = useState(false);

  const [caught, setCaught] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('caughtPokemon') || '[]');
      return new Set(Array.isArray(saved) ? saved : []);
    } catch {
      return new Set();
    }
  });
  const toggleCaught = (id) => {
    setCaught(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem('caughtPokemon', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const replaceCaught = React.useCallback((ids) => {
    setCaught(prev => {
      let entries = [];
      if (ids && typeof ids[Symbol.iterator] === 'function') {
        entries = [...ids].filter(id => typeof id === 'number');
      } else {
        entries = [...prev];
      }
      const next = new Set(entries);
      try { localStorage.setItem('caughtPokemon', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  // Alpha caught state
  const [alphaCaught, setAlphaCaught] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('alphaCaughtPokemon') || '[]');
      return new Set(Array.isArray(saved) ? saved : []);
    } catch {
      return new Set();
    }
  });
  const toggleAlphaCaught = (id) => {
    setAlphaCaught(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem('alphaCaughtPokemon', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // Shiny caught state - stores arrays of catch entries per Pokemon
  const [shinyCaught, setShinyCaught] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('shinyCaughtPokemon') || '{}');
      const map = new Map();
      for (const [id, entries] of Object.entries(saved)) {
        // Ensure entries is always an array
        if (Array.isArray(entries)) {
          map.set(Number(id), entries);
        } else if (entries && typeof entries === 'object') {
          // Migrate old single-entry format to array
          map.set(Number(id), [entries]);
        }
      }
      return map;
    } catch {
      return new Map();
    }
  });

  const addShinyEntry = (id, data) => {
    setShinyCaught(prev => {
      const next = new Map(prev);
      const existing = next.get(id) || [];
      next.set(id, [...existing, data]);
      try {
        const obj = {};
        for (const [key, value] of next.entries()) {
          obj[key] = value;
        }
        localStorage.setItem('shinyCaughtPokemon', JSON.stringify(obj));
      } catch {}
      return next;
    });
  };

  const updateShinyEntry = (id, index, data) => {
    setShinyCaught(prev => {
      const next = new Map(prev);
      const entries = next.get(id) || [];
      if (index >= 0 && index < entries.length) {
        const updated = [...entries];
        updated[index] = data;
        next.set(id, updated);
        try {
          const obj = {};
          for (const [key, value] of next.entries()) {
            obj[key] = value;
          }
          localStorage.setItem('shinyCaughtPokemon', JSON.stringify(obj));
        } catch {}
      }
      return next;
    });
  };

  const removeShinyEntry = (id, index) => {
    setShinyCaught(prev => {
      const next = new Map(prev);
      const entries = next.get(id) || [];
      if (index >= 0 && index < entries.length) {
        const updated = entries.filter((_, i) => i !== index);
        if (updated.length === 0) {
          next.delete(id);
        } else {
          next.set(id, updated);
        }
        try {
          const obj = {};
          for (const [key, value] of next.entries()) {
            obj[key] = value;
          }
          localStorage.setItem('shinyCaughtPokemon', JSON.stringify(obj));
        } catch {}
      }
      return next;
    });
  };

  // Catch notifications state
  const [catchNotifications, setCatchNotifications] = useState([]);

  // Listen for pokemon-caught events from the chat log watcher
  useEffect(() => {
    const handlePokemonCaught = (data) => {
      if (!data || !data.pokemonName) return;

      const pokemonName = data.pokemonName;
      const isAlpha = data.isAlpha;

      // Find the Pokemon in the dex by name
      const pokemon = DEX.find(p =>
        p.name?.toLowerCase() === pokemonName.toLowerCase()
      );

      if (!pokemon) {
        console.warn('[AutoCatch] Pokemon not found in dex:', pokemonName);
        return;
      }

      const pokemonId = pokemon.id;

      // Check if already caught (for regular) or alpha caught (for alpha)
      if (isAlpha) {
        if (alphaCaught.has(pokemonId)) {
          console.log('[AutoCatch] Alpha Pokemon already marked as caught:', pokemonName);
          return;
        }
        // Mark as alpha caught
        toggleAlphaCaught(pokemonId);
      } else {
        if (caught.has(pokemonId)) {
          console.log('[AutoCatch] Pokemon already marked as caught:', pokemonName);
          return;
        }
        // Mark as caught
        toggleCaught(pokemonId);
      }

      // Get sprite URL
      const spriteUrl = localSpriteCandidates(pokemon)?.[0] || PLACEHOLDER_POKEMON;

      // Add notification
      const notificationId = Date.now();
      setCatchNotifications(prev => [...prev, {
        id: notificationId,
        pokemonName: pokemon.name,
        isAlpha,
        spriteUrl,
      }]);
    };

    // Set up the event listener
    const cleanup = window.app?.onPokemonCaught?.(handlePokemonCaught);
    return () => {
      if (cleanup && typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [caught, alphaCaught, toggleCaught, toggleAlphaCaught]);

  const removeCatchNotification = (id) => {
    setCatchNotifications(prev => prev.filter(n => n.id !== id));
  };

  const [query, setQuery]       = useState('');
  const [areaQuery, setAreaQuery] = useState('');
  const [areaRegion, setAreaRegion] = useState('All');
  const searchClearIntentRef = useRef(false);
  const [showRegionMenu, setShowRegionMenu] = useState(false);
  const [selected, setSelected] = useState(null);
  const [mode, setMode]         = useState(DEFAULT_MODE); // 'pokemon' | 'areas' | 'horde' | 'tm' | 'items' | 'breeding' | 'daycare' | 'team' | 'live' | 'battle' | 'market'

  const [showTypeChart, setShowTypeChart] = useState(false);
  const [showResources, setShowResources] = useState(false);

  // Sidebar action items (dex windows, type chart, resources) run a side
  // effect instead of switching mode.
  const handleNavAction = (item) => {
    if (item.action === 'open-dex') openDex(item.dex);
    else if (item.action === 'type-chart') setShowTypeChart(true);
    else if (item.action === 'resources') setShowResources(true);
  };

  // Compare mode state for Pokemon Search
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);
  const { list: natureList, byName: naturesByName } = useNatures();
  // Always disable compare when leaving the Pokemon Search tab
  useEffect(() => {
    if (mode !== 'pokemon') {
      setCompareMode(false);
      setCompareA(null);
      setCompareB(null);
    }
  }, [mode]);

  const [statusEffect, setStatusEffect] = useState(null);
  const [isOneHp, setIsOneHp] = useState(false);
  const [selectedBallKey, setSelectedBallKey] = useState(BALL_OPTIONS[0].key);
  const toggleStatusEffect = (effect) => {
    setStatusEffect((prev) => (prev === effect ? null : effect));
  };
  // Session-based recent Pokemon selections for quick history in Pokemon Search
  const [recentMons, setRecentMons] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('recentMons') || '[]'); }
    catch { return []; }
  });
  const [methodFilters, setMethodFilters] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('areaMethodFilters') || '[]');
      const valid = Array.isArray(saved) ? saved.filter(t => ENCOUNTER_TYPES.includes(t)) : [];
      return new Set(valid.length ? valid : ENCOUNTER_TYPES);
    } catch {
      return new Set(ENCOUNTER_TYPES);
    }
  });
  const [showMethodMenu, setShowMethodMenu] = useState(false);
  const [showInfoMenu, setShowInfoMenu] = useState(false);
  const methodFilterRef = useRef(null);
  const infoRef = useRef(null);
  const [showCaught, setShowCaught] = useState(() => {
    try { return JSON.parse(localStorage.getItem('areaShowCaught') ?? 'true'); }
    catch { return true; }
  });
  const [showEvYield, setShowEvYield] = useState(() => {
    try { return JSON.parse(localStorage.getItem('areaShowEvYield') ?? 'true'); }
    catch { return true; }
  });
  const [showCatchRate, setShowCatchRate] = useState(() => {
    try { return JSON.parse(localStorage.getItem('areaShowCatchRate') ?? 'true'); }
    catch { return true; }
  });
  const [showCatchPercent, setShowCatchPercent] = useState(() => {
    try { return JSON.parse(localStorage.getItem('areaShowCatchPercent') ?? 'true'); }
    catch { return true; }
  });
  const [showHeldItem, setShowHeldItem] = useState(() => {
    try { return JSON.parse(localStorage.getItem('areaShowHeldItem') ?? 'true'); }
    catch { return true; }
  });
  const [showLevel, setShowLevel] = useState(() => {
    try { return JSON.parse(localStorage.getItem('areaShowLevel') ?? 'true'); }
    catch { return true; }
  });
  const [marketData, setMarketData] = useState([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState(null);
  const [marketSelected, setMarketSelected] = useState(null);

  const toggleMethodFilter = (m) => {
    setMethodFilters(prev => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });
  };

  useEffect(() => {
    const onDoc = (e) => {
      if (methodFilterRef.current && !methodFilterRef.current.contains(e.target)) {
        setShowMethodMenu(false);
      }
      if (infoRef.current && !infoRef.current.contains(e.target)) {
        setShowInfoMenu(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('areaMethodFilters', JSON.stringify([...methodFilters])); } catch {}
  }, [methodFilters]);

  useEffect(() => { try { localStorage.setItem('areaShowCaught', JSON.stringify(showCaught)); } catch {} }, [showCaught]);
  useEffect(() => { try { localStorage.setItem('areaShowEvYield', JSON.stringify(showEvYield)); } catch {} }, [showEvYield]);
  useEffect(() => { try { localStorage.setItem('areaShowCatchRate', JSON.stringify(showCatchRate)); } catch {} }, [showCatchRate]);
  useEffect(() => { try { localStorage.setItem('areaShowCatchPercent', JSON.stringify(showCatchPercent)); } catch {} }, [showCatchPercent]);
  useEffect(() => { try { localStorage.setItem('areaShowHeldItem', JSON.stringify(showHeldItem)); } catch {} }, [showHeldItem]);
  useEffect(() => { try { localStorage.setItem('areaShowLevel', JSON.stringify(showLevel)); } catch {} }, [showLevel]);

  const detailRef = useRef(null);

  const [showUpToDate, setShowUpToDate] = useState(false);

  // OCR toggle from Options. Keep both live clients in step even when their
  // page isn't open, so the sidebar live status recovers when OCR comes back.
  const [ocrEnabled, setOcrEnabled] = useState(isOcrEnabled());
  useEffect(() => {
    const onChange = (e) => {
      const en = !!(e?.detail?.enabled ?? isOcrEnabled());
      setOcrEnabled(en);
      try { liveRouteClient.setEnabled(en); } catch {}
      try { liveBattleClient.setEnabled(en); } catch {}
    };
    window.addEventListener('ocr-enabled-changed', onChange);
    return () => window.removeEventListener('ocr-enabled-changed', onChange);
  }, []);

  useEffect(() => {
    if ((!ocrSupported || !ocrEnabled) && (mode === 'live' || mode === 'battle')) setMode(DEFAULT_MODE);
  }, [ocrSupported, ocrEnabled, mode]);

  useEffect(() => {
    liveBattleClient.connect();
    const onForce = () => { liveBattleClient.forceReconnect(); };
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        liveBattleClient.forceReconnect();
      }
    };
    const onFocus = () => { liveBattleClient.forceReconnect(); };
    window.addEventListener('force-live-reconnect', onForce);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('force-live-reconnect', onForce);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Suppress the in-app "Up to date" banner; Windows handles update UX.
  useEffect(() => { /* no-op */ }, []);

  useEffect(() => {
    if (mode !== 'market') return;
    let cancelled = false;
    setMarketLoading(true);
    setMarketError(null);
    const extractList = (d) => {
      if (Array.isArray(d)) return d;
      if (Array.isArray(d?.results)) return d.results;
      if (Array.isArray(d?.data?.results)) return d.data.results;
      if (Array.isArray(d?.data?.items)) return d.data.items;
      if (Array.isArray(d?.data)) return d.data;
      if (Array.isArray(d?.items)) return d.items;
      return [];
    };
    const gtlEndpoint = import.meta.env.VITE_GTL_ITEMS_URL;
    if (!gtlEndpoint) {
      setMarketData(ITEM_LIST);
      setMarketLoading(false);
      return;
    }
    const headers = {
      'Accept': 'application/json'
    };
    if (import.meta.env.VITE_GTL_AUTH) headers['Authorization'] = import.meta.env.VITE_GTL_AUTH;
    if (import.meta.env.VITE_GTL_ORIGIN) headers['Origin'] = import.meta.env.VITE_GTL_ORIGIN;
    fetch(gtlEndpoint, { headers })
      .then(async r => {
        if (!r.ok) {
          let msg = `Request failed: ${r.status}`;
          const text = await r.text().catch(() => '');
          if (text) msg += ` - ${text}`;
          throw new Error(msg);
        }
        return r.json();
      })
      .then(d => {
        if (cancelled) return;
        setMarketData(extractList(d));
      })
      .catch(err => {
        if (!cancelled) {
          console.error('GTL fetch error', err);
          setMarketError(err?.message || 'Failed to fetch data');
        }
      })
      .finally(() => { if (!cancelled) setMarketLoading(false); });
    return () => { cancelled = true; };
  }, [mode]);

  const [methodColors, setMethodColors] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('methodColors') || '{}');
      const { lure, ...rest } = saved || {};
      return { ...DEFAULT_METHOD_COLORS, ...rest };
    } catch {
      return DEFAULT_METHOD_COLORS;
    }
  });
  const [rarityColors, setRarityColors] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('rarityColors') || '{}');
      return { ...DEFAULT_RARITY_COLORS, ...saved };
    } catch {
      return DEFAULT_RARITY_COLORS;
    }
  });

  const locIndex   = useMemo(() => buildLocationsIndex(DEX_LIST), []);
  const areasClean = useMemo(() => buildAreasIndex(DEX_LIST, HORDE_SIZE_MAP), []);
  const tmIndex    = useTmLocations();
  const areasRevByMon = useMemo(() => buildReverseAreasIndex(areasClean), [areasClean]); // NEW
  const regionOptions = useMemo(() => ['All', ...Object.keys(areasClean).sort((a,b)=>a.localeCompare(b))], [areasClean]);

  const [typeFilter, setTypeFilter] = useState('');
  const [typeFilter2, setTypeFilter2] = useState('');
  const [eggFilter, setEggFilter] = useState('');
  const [abilityFilter, setAbilityFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [moveFilter, setMoveFilter] = useState('');
  const [moveLevelOnly, setMoveLevelOnly] = useState(false);
  const [itemFilter, setItemFilter] = useState('');

  // Close the Pokemon profile when any filter is selected/changed
  useEffect(() => {
    if (!selected) return;
    const anyFilter = Boolean(
      typeFilter || typeFilter2 || eggFilter || abilityFilter || regionFilter || moveFilter || itemFilter || (moveFilter && moveLevelOnly)
    );
    if (anyFilter) setSelected(null);
  }, [typeFilter, typeFilter2, eggFilter, abilityFilter, regionFilter, moveFilter, moveLevelOnly, itemFilter]);
  const typeOptions = useMemo(() => {
    const set = new Set();
    for (const m of DEX_LIST) for (const t of m.types || []) set.add(normalizeType(t));
    return [...set].sort((a,b)=>a.localeCompare(b));
  }, []);
  const eggGroupOptions = useMemo(() => {
    const set = new Set();
    for (const m of DEX_LIST) for (const g of m.eggGroups || []) set.add(normalizeEggGroup(g));
    return [...set].sort((a,b)=>a.localeCompare(b));
  }, []);
  const abilityOptions = useMemo(() => {
    const set = new Set();
    for (const m of DEX_LIST) for (const a of m.abilities || []) if (a?.name && a.name !== '--') set.add(a.name);
    return [...set].sort((a,b)=>a.localeCompare(b));
  }, []);
  const moveOptions = useMemo(() => {
    const set = new Set();
    for (const m of DEX_LIST) for (const mv of m.moves || []) if (mv?.name) set.add(mv.name);
    return [...set].sort((a,b)=>a.localeCompare(b));
  }, []);
  const itemOptions = useMemo(() => {
    const set = new Set();
    for (const m of DEX_LIST) for (const h of m.heldItems || []) if (h?.name) set.add(h.name);
    // If no held items are found in the dex data, fall back to the full item list
    // so the Held Item filter still offers suggestions.
    if (set.size === 0) for (const item of ITEM_LIST) if (item?.name) set.add(item.name);
    return [...set].sort((a,b)=>a.localeCompare(b));
  }, []);
  const pokemonRegionOptions = useMemo(() => {
    const set = new Set();
    for (const m of DEX_LIST) for (const l of m.locations || []) if (l.region_name) set.add(l.region_name);
    return [...set].sort((a,b)=>a.localeCompare(b));
  }, []);

  useEffect(() => { if (!moveFilter) setMoveLevelOnly(false); }, [moveFilter]);

  const hasFilters = Boolean(typeFilter || typeFilter2 || eggFilter || abilityFilter || regionFilter || moveFilter || itemFilter);

  useEffect(() => { document.title = APP_TITLE; }, []);

  useEffect(() => {
    setShowRegionMenu(false);
    if (mode !== 'pokemon') setSelected(null);
    setTypeFilter('');
    setTypeFilter2('');
    setEggFilter('');
    setAbilityFilter('');
    setRegionFilter('');
    setMoveFilter('');
    setMoveLevelOnly(false);
    setItemFilter('');
  }, [mode]);
  // Ensure the second Type filter only applies when the first is set
  useEffect(() => {
    if (!typeFilter) setTypeFilter2('');
  }, [typeFilter]);
  useEffect(() => {
    setStatusEffect(null);
    setIsOneHp(false);
    setSelectedBallKey(BALL_OPTIONS[0].key);
  }, [selected]);
  useEffect(() => {
    if (selected && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selected]);
  useEffect(() => {
    if (!selected || selected.catchRate != null) return;
    const localRate = catchRates[selected.id];
    if (localRate != null) {
      setSelected((s) => (s && s.id === selected.id ? { ...s, catchRate: localRate } : s));
      return;
    }
    (async () => {
      try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${selected.id}/`);
        if (!res.ok) return;
        const data = await res.json();
        setSelected((s) => (s && s.id === selected.id ? { ...s, catchRate: data.capture_rate } : s));
      } catch (e) {
        console.error('fetch catch rate failed', e);
      }
    })();
  }, [selected]);
  useEffect(() => {
    (async () => {
      try {
        const current = await window.app?.getVersion?.().catch(() => null);
        if (current) {
          const last = localStorage.getItem('last-version');
          if (last !== current) {
            openPatchNotes();
            localStorage.setItem('last-version', current);
          }
        }
      } catch (err) {
        console.error('Version check failed', err);
      }
    })();
  }, []);

// (Removed: legacy OCR setup auto-open)

  // Search by Pokemon
  const results = React.useMemo(() => {
    if (mode !== 'pokemon') return [];
    const q = query.trim().toLowerCase();
    if (!hasFilters && !q) return [];

    const matchesFilters = (mon) => {
      if (typeFilter) {
        const types = (mon.types || []).map(normalizeType);
        if (!types.includes(normalizeType(typeFilter))) return false;
        if (typeFilter2) {
          if (!types.includes(normalizeType(typeFilter2))) return false;
        }
      }
      if (eggFilter) {
        const eggs = (mon.eggGroups || []).map(normalizeEggGroup);
        if (!eggs.includes(normalizeEggGroup(eggFilter))) return false;
      }
      if (abilityFilter) {
        const abilities = (mon.abilities || []).map(a => keyName(a.name));
        if (!abilities.includes(keyName(abilityFilter))) return false;
      }
      if (moveFilter) {
        const moves = mon.moves || [];
        if (moveLevelOnly) {
          const has = moves.some(mv => keyName(mv.name) === keyName(moveFilter) && mv.type === 'level');
          if (!has) return false;
        } else {
          const names = moves.map(mv => keyName(mv.name));
          if (!names.includes(keyName(moveFilter))) return false;
        }
      }
      if (itemFilter) {
        const items = (mon.heldItems || []).map(h => keyName(h.name));
        if (!items.includes(keyName(itemFilter))) return false;
      }
      if (regionFilter) {
        const regions = (mon.locations || []).map(l => normalizeRegion(l.region_name));
        if (!regions.includes(normalizeRegion(regionFilter))) return false;
      }
      return true;
    };

    const matchesQuery = (mon) => {
      if (!q) return true;
      return mon.name.toLowerCase().includes(q) || String(mon.id) === q;
    };

    let list = [];
    for (const mon of DEX_LIST) {
      if (matchesFilters(mon) && matchesQuery(mon)) list.push(mon);
      for (const form of mon.forms || []) {
        if (matchesFilters(form) && matchesQuery(form)) list.push(form);
      }
    }
    if (!hasFilters && q) list = list.slice(0, 24);
    return list;
  }, [mode, query, hasFilters, typeFilter, typeFilter2, eggFilter, abilityFilter, regionFilter, moveFilter, moveLevelOnly, itemFilter]);

  // Helper to compare mons (accounts for forms without numeric id)
  const sameMon = (a, b) => {
    if (!a || !b) return false;
    if (a.id != null && b.id != null) return Number(a.id) === Number(b.id);
    return normalizeKey(a.name) === normalizeKey(b.name);
  };

  // Results with pinned first selection in compare mode
  const combinedResults = React.useMemo(() => {
    if (mode !== 'pokemon') return results;
    if (!(compareMode && compareA && !compareB)) return results;
    const rest = results.filter(r => !sameMon(r, compareA));
    return [compareA, ...rest];
  }, [results, compareMode, compareA, compareB, mode]);

  // Filter recent list based on compare state
  const recentFiltered = React.useMemo(() => {
    if (mode !== 'pokemon') return recentMons;
    if (compareMode && compareA && compareB) return [];
    if (compareMode && compareA && !compareB) {
      if (!Array.isArray(recentMons)) return [];
      return recentMons.filter(r => {
        const m = getMonByDex(r?.id);
        if (m) return !sameMon(m, compareA);
        if (r?.name) return normalizeKey(r.name) !== normalizeKey(compareA.name);
        return true;
      });
    }
    return recentMons;
  }, [recentMons, mode, compareMode, compareA, compareB]);

  // Track recents when selection changes
  useEffect(() => {
    if (!selected || selected.id == null) return;
    setRecentMons(prev => {
      const base = Array.isArray(prev) ? prev : [];
      const without = base.filter(m => m && m.id !== selected.id);
      const next = [{ id: selected.id, name: selected.name }, ...without].slice(0, 8);
      try { sessionStorage.setItem('recentMons', JSON.stringify(next)); } catch {}
      return next;
    });
  }, [selected?.id]);

  // No additional reset needed; recents show whenever the query is empty.

  // Search by Area (cleaned + grouped) with Sinnoh Victory Road unified
  const areaHits = React.useMemo(() => {
    if (mode!=='areas') return [];
    const q = areaQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    // Suppress results while user is typing the word "route"
    if ('route'.startsWith(q)) return [];
    // If query begins with "route" but lacks a number, avoid suggesting routes yet
    if (q.startsWith('route') && !/^route\s*\d+/.test(q)) return [];
    const buckets = new Map();
    const regionKey = normalizeRegion(areaRegion);
    for (const [region, maps] of Object.entries(areasClean)) {
      const regionNorm = normalizeRegion(region);
      if (regionKey !== 'all' && regionNorm !== regionKey) continue;
      for (const [mapName, entries] of Object.entries(maps)) {
        const displayMap = normalizeMapForGrouping(region, mapName);
        if (!mapNameMatches(displayMap, q)) continue;
        const time = extractTimeTag(displayMap).toLowerCase();
        const baseMap = stripTimeTag(displayMap);
        const key = `${region}|||${baseMap}`;
        if (!buckets.has(key)) buckets.set(key, { region, map: baseMap, entries: [] });
        const adjusted = time
          ? entries.map(e => ({ ...e, method: e.method ? `${e.method} (${time})` : `(${time})` }))
          : entries;
        buckets.get(key).entries.push(...adjusted);
      }
    }
    const hits = [];
    for (const { region, map, entries } of buckets.values()) {
      const regionNorm = normalizeRegion(region);
      if (regionKey !== 'all' && regionNorm !== regionKey) continue;
      let grouped = groupEntriesByMon(entries).map(g => {
        const fallback = lookupRarity(g.monName, region, map, locIndex);
        g.encounters.forEach(enc => {
          if (!enc.rarities.length && fallback) enc.rarities.push(fallback);
        });
        return g;
      });
      if (methodFilters && methodFilters.size) {
        grouped = grouped
          .map(g => ({
            ...g,
            encounters: g.encounters.filter(enc => {
              const method = (enc.method || '').toLowerCase();
              const rarities = (enc.rarities || []).map(r => r.toLowerCase());
              const filters = Array.from(methodFilters).map(f => String(f).toLowerCase());
              // Only show lure encounters when the 'Lure' filter is enabled.
              if (/lure/.test(method) || rarities.some(r => /lure/.test(r))) {
                return filters.includes('lure');
              }
              return filters.some(fL => method.includes(fL) || rarities.some(r => r.includes(fL)));
            })
          }))
          .filter(g => g.encounters.length);
      }
      if (grouped.length) hits.push({ region, map, count: grouped.length, entries: grouped });
    }
    hits.sort((a,b)=> a.region.localeCompare(b.region) || a.map.localeCompare(b.map));
    return hits.slice(0, 30);
 }, [areaQuery, areasClean, locIndex, mode, areaRegion, methodFilters]);

  const tmHits = React.useMemo(() => {
    if (mode !== 'tm') return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const regionKey = normalizeRegion(areaRegion);
    const hits = [];
    for (const [region, entries] of Object.entries(tmIndex)) {
      const regionNorm = normalizeRegion(region);
      if (regionKey !== 'all' && regionNorm !== regionKey) continue;
      for (const entry of entries || []) {
        if (entry.tm.toLowerCase().includes(q)) {
          hits.push({ ...entry, region });
        }
      }
    }
    hits.sort((a,b)=> a.region.localeCompare(b.region) || a.tm.localeCompare(b.tm));
    return hits;
  }, [query, tmIndex, mode, areaRegion]);

  const itemHits = React.useMemo(() => {
    if (mode !== 'items') return [];
    const q = normalizeKey(query);
    if (!q) return [];
    return ITEM_LIST.filter(i => normalizeKey(i.name).includes(q)).slice(0, 30);
  }, [query, mode]);

const marketResults = React.useMemo(() => {
    if (mode !== 'market') return [];
    const q = query.trim().toLowerCase();
    return marketData
      .map((item, idx) => {
        const id = item?.id ?? item?.item_id;
        const name = item?.name || item?.item_name || ITEM_INDEX.byId.get(id)?.name || `Item ${id ?? idx}`;
        const price = item?.price ?? item?.min_price;
        return { ...item, id, name, price };
      })
      .filter(i => i.name && !i.name.includes('?'))
      .filter(i => !q || i.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [mode, query, marketData]);

  const openMarketItem = (item) => {
    setMarketSelected(item);
  };

  // Selected Pokemon details (MERGED sources)
  const resolved = React.useMemo(() => {
    if (!selected) return null;

    const norm = normalizeKey(selected.name);
    const baseLocsRaw = (() => {
      const locEntry = locIndex[norm] || locIndex[`and-${norm}`] || locIndex[norm.replace(/^and-/, '')];
      return Array.isArray(locEntry?.locations) ? locEntry.locations : [];
    })();

    // Normalize base locations to array-of-arrays form
    const baseLocs = baseLocsRaw.map(l => ({
      region: titleCase(l.region || 'Unknown'),
      map: normalizeMapForGrouping(l.region || 'Unknown', l.map || ''),
      method: Array.isArray(l.method) ? l.method.filter(Boolean) : (l.method ? [l.method] : []),
      rarity: Array.isArray(l.rarity) ? l.rarity.filter(Boolean) : (l.rarity ? [l.rarity] : []),
      min: l.min_level ?? l.min,
      max: l.max_level ?? l.max,
      items: Array.isArray(l.items) ? l.items.filter(Boolean) : [],
    }));

    // Extra from Areas reverse index
    const extraLocs = (areasRevByMon.get(selected.id) || []).flatMap(e =>
      (e.encounters || []).map(enc => ({
        region: titleCase(e.region),
        map: e.map,
        method: [enc.method].filter(Boolean),
        rarity: (enc.rarities || []).filter(Boolean),
        min: enc.min,
        max: enc.max,
        items: (enc.items || []).filter(Boolean),
      }))
    );

    // Locations from dex data
    const dexLocs = (selected.locations || []).map(l => {
      let method = l.type;
      let rarity = l.rarity;
      if (rarity && /lure/i.test(rarity)) {
        method = `Lure${method ? ` (${method})` : ''}`;
        rarity = '';
      }
      if (method && /lure/i.test(method)) {
        rarity = '';
      }
      return {
        region: titleCase(l.region_name || 'Unknown'),
        map: normalizeMapForGrouping(l.region_name || 'Unknown', stripSeason(l.location)),
        method: [method].filter(Boolean),
        rarity: [rarity].filter(Boolean),
        min: l.min_level,
        max: l.max_level,
        items: (selected.heldItems || []).map(h => h.name),
      };
    });

    // Merge & dedupe by region+map; union methods/rarities
    const byKey = new Map();
    for (const src of [...baseLocs, ...extraLocs, ...dexLocs]) {
      if (!src.map) continue;
      const key = `${src.region}|${src.map}`;
      const prev = byKey.get(key) || { region: src.region, map: src.map, method: [], rarity: [], items: [], min: src.min, max: src.max };
      prev.method.push(...(src.method || []));
      prev.rarity.push(...(src.rarity || []));
      prev.items.push(...(src.items || []));
      prev.min = Math.min(prev.min ?? src.min ?? Infinity, src.min ?? Infinity);
      prev.max = Math.max(prev.max ?? src.max ?? 0, src.max ?? 0);
      byKey.set(key, prev);
    }

    const mergedLocs = [...byKey.values()].map(l => {
      const methods = [...new Set(l.method)];
      let rarities = [...new Set(l.rarity)];
      if (methods.length === 1) {
        rarities = selectRarest(rarities);
      }
      const hordeSize = getHordeSize(HORDE_SIZE_MAP, l.region, l.map, selected.name);
      return {
        ...l,
        method: methods,
        rarity: rarities,
        items: [...new Set(l.items)],
        ...(hordeSize ? { hordeSize } : {}),
      };
    });

    const types = [...new Set((selected.types || []).map(normalizeType))];
    const moves = groupMoves(selected.moves || []);
    return {
      ...selected,
      types,
      moves,
      weakness: computeWeakness(types),
      locations: mergedLocs,
      eggGroups: selected.eggGroups || []
    };
  }, [selected, locIndex, areasRevByMon]);

  // Group locations by region
  const byRegion = React.useMemo(() => {
    if (!resolved?.locations?.length) return [];
    const groups = new Map();
    for (const L of resolved.locations) {
      const reg = titleCase(L.region || 'Unknown');
      if (!groups.has(reg)) groups.set(reg, []);
      groups.get(reg).push(L);
    }
    const order = ['Kanto','Johto','Hoenn','Sinnoh','Unova','Unknown'];
    return [...groups.entries()].sort((a,b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  }, [resolved]);

  const selectedBall = React.useMemo(
    () => BALL_OPTIONS.find(opt => opt.key === selectedBallKey) || BALL_OPTIONS[0],
    [selectedBallKey]
  );

  const catchPercent = React.useMemo(() => {
    if (!resolved?.catchRate) return null;
    const statusMult = STATUS_MULTIPLIERS[statusEffect] || 1;
    const chance = calcCatchChance(
      resolved.catchRate,
      isOneHp ? 0.01 : 1,
      statusMult,
      selectedBall.multiplier
    );
    return chance * 100;
  }, [resolved, statusEffect, isOneHp, selectedBall]);

  const [singleBuild, setSingleBuild] = useState(() => mkInitialBuild());
  const singleDirty = isDirty(singleBuild);
  const singleBaseStats = useMemo(() => resolved ? getBaseStatsFrom(resolved) : null, [resolved]);
  const natureModsOf = (name) => {
    const n = naturesByName.get(normalizeKey(name || ''));
    return n?.mods || { attack:1, defense:1, special_attack:1, special_defense:1, speed:1 };
  };
  const singleOverride = useMemo(() => {
    if (!singleBaseStats || !singleDirty) return null;
    const b = coerceBuild(singleBuild);
    return computeFinalStats(singleBaseStats, b.iv, b.ev, b.level, natureModsOf(b.nature));
  }, [singleBaseStats, singleBuild, singleDirty]);
  const singleUnderline = useMemo(() => underlineFrom(singleOverride, singleBaseStats), [singleOverride, singleBaseStats]);
  const singleSetters = {
    onSetIV: (key, val) => setSingleBuild((prev) => ({ ...prev, iv: { ...prev.iv, [key]: val } })),
    onSetEV: (key, val) => setSingleBuild((prev) => {
      const next = { ...prev, ev: { ...prev.ev, [key]: val } };
      const sum = ['hp','attack','defense','special_attack','special_defense','speed'].reduce((s,k)=> s + (Number(next.ev[k] || 0) || 0), 0);
      if (sum <= 510) return next;
      const others = sum - (Number(next.ev[key] || 0) || 0);
      const allowed = Math.max(0, 510 - others);
      return { ...prev, ev: { ...prev.ev, [key]: Math.min(allowed, Number(val)||0) } };
    }),
    onSetLevel: (val) => setSingleBuild((prev) => ({ ...prev, level: val }))
  };
  useEffect(() => { setSingleBuild(mkInitialBuild()); }, [resolved]);
  useEffect(() => { setProfileShiny(false); }, [resolved]);

  const getLatestLiveBattleMon = () => {
    const fromPayload = (payload) => {
      const coerced = coerceBattleIncoming(payload);
      if (!coerced) return [];
      let cleaned = normalizeHudText(coerced.monText);
      cleaned = cleaned
        .replace(/([A-Za-z])([Ll][Vv])/g, '$1 $2')
        .replace(/([A-Za-z])([Hh][Pp])/g, '$1 $2')
        .replace(/([A-Za-z])([Pp][Cc])/g, '$1 $2')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/(\d)([A-Za-z])/g, '$1 $2')
        .replace(/\b(?:HP|pc)\s*\d+\/\d+\b/gi, '')
        .replace(/\s*\s*/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      const lower = cleaned.toLowerCase();
      const compact = lower.replace(/[^a-z0-9]+/g, '');
      const matches = lower.match(POKE_NAME_REGEX) || [];
      const compactMatches = compact.match(POKE_NAME_COMPACT_REGEX) || [];
      let names = Array.from(new Set([...matches, ...compactMatches].map(normalizeKey)))
        .map(n => getMon(n)?.name)
        .filter(Boolean);
      if (names.length === 0) {
        const candLines = cleaned.split(/\n+/).map(s => s.trim()).filter(Boolean);
        const fuzzySet = new Set();
        for (const line of candLines) {
          const key = normalizeKey(line);
          let mon = getMon(key);
          if (!mon) {
            let best = null;
            let bestScore = 0;
            for (const m of DEX_LIST) {
              const score = similarity(key, normalizeKey(m.name));
              if (score > bestScore) { best = m; bestScore = score; }
            }
            if (best && bestScore >= 0.8) mon = best;
          }
          if (mon) fuzzySet.add(mon.name);
        }
        names = [...fuzzySet];
      }
      return names
        .map(n => {
          const m = getMon(n);
          return m ? { ...m } : null;
        })
        .filter(Boolean);
    };

    let mons = fromPayload(liveBattleClient.lastPayload);
    if (!mons.length) {
      const fallback = window.liveBattleLastMons || [];
      mons = Array.isArray(fallback) ? fallback : [];
    }
    return (Array.isArray(mons) && mons.length) ? mons[0] : null;
  };

  return (
    <CaughtContext.Provider value={{ caught, toggleCaught, replaceCaught }}>
    <AlphaCaughtContext.Provider value={{ alphaCaught, toggleAlphaCaught }}>
    <ShinyCaughtContext.Provider value={{ shinyCaught, addShinyEntry, updateShinyEntry, removeShinyEntry }}>
    <ColorContext.Provider value={{ methodColors, rarityColors, setMethodColors, setRarityColors }}>
      <>
      {/* Mount the color picker without a visible trigger so Options menu can open it */}
      <ColorPickerButton renderTrigger={false} />
      {/* Dex windows have no trigger here; the sidebar opens them via openDex */}
      <CaughtListButton renderTrigger={false} />
      <AlphaDexButton renderTrigger={false} />
      <EventDexButton renderTrigger={false} />
      <ShinyDexButton renderTrigger={false} />

{showUpToDate && (
        <div
          style={{
            position:'fixed',
            top:10,
            left:'50%',
            transform:'translateX(-50%)',
            zIndex:9999,
            padding:'8px 12px',
            background:'var(--surface)',
            color:'var(--text)',
            borderRadius:10,
            border:'1px solid var(--divider)',
            boxShadow:'0 8px 28px rgba(0,0,0,.45)',
            fontWeight:700,
            pointerEvents:'none'
          }}
        >
          Up to date
        </div>
      )}

      <AppShell
        mode={mode}
        onNavigate={setMode}
        onAction={handleNavAction}
        ocrSupported={ocrSupported}
        ocrEnabled={ocrEnabled}
        onOpenLive={() => setMode('live')}
      >
      <div className="container">
        {/* Search / Mode Card */}
        <div style={{ ...styles.card, marginBottom:16 }}>
        {isLinux && (
          <div className="label-muted" style={{ marginBottom:8 }}>
            Live route tracking is unavailable on Linux.
          </div>
        )}

        <div style={{ display: mode==='horde' ? 'block' : 'none' }}>
          <HordeSearch />
        </div>

        {mode==='pokemon' && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:8 }}>
            <select
              value={typeFilter}
                onChange={e=>setTypeFilter(e.target.value)}
                className="input"
                style={{ height:44, borderRadius:10, width:'auto' }}
              >
                <option value="">Type</option>
                {typeOptions.map(t => <option key={t} value={t}>{titleCase(t)}</option>)}
              </select>
              {Boolean(typeFilter) && (
                <select
                  value={typeFilter2}
                  onChange={e=>setTypeFilter2(e.target.value)}
                  className="input"
                  style={{ height:44, borderRadius:10, width:'auto' }}
                >
                  <option value="">Type</option>
                  {typeOptions.map(t => <option key={`t2-${t}`} value={t}>{titleCase(t)}</option>)}
                </select>
              )}
              <select
                value={eggFilter}
                onChange={e=>setEggFilter(e.target.value)}
                className="input"
                style={{ height:44, borderRadius:10, width:'auto' }}
              >
                <option value="">Egg Group</option>
                {eggGroupOptions.map(g => <option key={g} value={g}>{titleCase(g)}</option>)}
              </select>
              <select
                value={abilityFilter}
                onChange={e=>setAbilityFilter(e.target.value)}
                className="input"
                style={{ height:44, borderRadius:10, width:'auto' }}
              >
                <option value="">Ability</option>
                {abilityOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select
                value={regionFilter}
                onChange={e=>setRegionFilter(e.target.value)}
                className="input"
                style={{ height:44, borderRadius:10, width:'auto' }}
              >
                <option value="">Region</option>
                {pokemonRegionOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <SearchFilter
                value={moveFilter}
                onChange={setMoveFilter}
                options={moveOptions}
                placeholder="Move"
              />
              <SearchFilter
                value={itemFilter}
                onChange={setItemFilter}
                options={itemOptions}
                placeholder="Held Item"
              />
              <button
                type="button"
                className={`region-btn${compareMode ? ' compare-active' : ''}`}
                aria-pressed={compareMode}
                onClick={() => {
                  setMode('pokemon');
                  if (compareMode) {
                    setCompareMode(false);
                    setCompareA(null);
                    setCompareB(null);
                    setSelected(null);
                    setQuery('');
                  } else {
                    setCompareMode(true);
                  }
                }}
                title="Compare"
              >
                Compare
              </button>
              {false && (/* Clear Filters moved to inline chips row */
                <button
                  type="button"
                  className="region-btn"
                  onClick={() => {}}
                  title="Clear Filters"
                >
                  Clear Filters
                </button>
              )}
              {/* Compare toggle moved to top menu and profile header */}
            </div>
          )}

          {/* Active filter chips (Pokemon) */}
          {mode==='pokemon' && hasFilters && (
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:8 }}>
              <button
                type="button"
                className="region-btn"
                onClick={() => {
                  // Reset all Pokemon filters
                  setTypeFilter('');
                  setTypeFilter2('');
                  setEggFilter('');
                  setAbilityFilter('');
                  setRegionFilter('');
                  setMoveFilter('');
                  setMoveLevelOnly(false);
                  setItemFilter('');
                }}
                title="Clear Filters"
              >
                Clear Filters
              </button>
              {typeFilter && (
                <div style={styles.chip}>
                  <span>{titleCase(typeFilter)}</span>
                  <button
                    type="button"
                    aria-label="Clear Type Filter"
                    title="Clear"
                    style={styles.chipX}
                    className="chip-x"
                    onClick={(e)=>{ e.stopPropagation(); setTypeFilter(''); }}
                  >
                    ×
                  </button>
                </div>
              )}
              {typeFilter2 && (
                <div style={styles.chip}>
                  <span>{titleCase(typeFilter2)}</span>
                  <button
                    type="button"
                    aria-label="Clear Secondary Type Filter"
                    title="Clear"
                    style={styles.chipX}
                    className="chip-x"
                    onClick={(e)=>{ e.stopPropagation(); setTypeFilter2(''); }}
                  >
                    ×
                  </button>
                </div>
              )}
              {eggFilter && (
                <div style={styles.chip}>
                  <span>{titleCase(eggFilter)}</span>
                  <button
                    type="button"
                    aria-label="Clear Egg Group Filter"
                    title="Clear"
                    style={styles.chipX}
                    className="chip-x"
                    onClick={(e)=>{ e.stopPropagation(); setEggFilter(''); }}
                  >
                    ×
                  </button>
                </div>
              )}
              {abilityFilter && (
                <div style={styles.chip}>
                  <span>{abilityFilter}</span>
                  <button
                    type="button"
                    aria-label="Clear Ability Filter"
                    title="Clear"
                    style={styles.chipX}
                    className="chip-x"
                    onClick={(e)=>{ e.stopPropagation(); setAbilityFilter(''); }}
                  >
                    ×
                  </button>
                </div>
              )}
              {regionFilter && (
                <div style={styles.chip}>
                  <span>{regionFilter}</span>
                  <button
                    type="button"
                    aria-label="Clear Region Filter"
                    title="Clear"
                    style={styles.chipX}
                    className="chip-x"
                    onClick={(e)=>{ e.stopPropagation(); setRegionFilter(''); }}
                  >
                    ×
                  </button>
                </div>
              )}
              {moveFilter && (
                <div style={styles.chip}>
                  <span>{moveFilter}</span>
                  <button
                    type="button"
                    aria-label="Clear Move Filter"
                    title="Clear"
                    style={styles.chipX}
                    className="chip-x"
                    onClick={(e)=>{ e.stopPropagation(); setMoveFilter(''); setMoveLevelOnly(false); }}
                  >
                    ×
                  </button>
                </div>
              )}
              {moveFilter && moveLevelOnly && (
                <div style={styles.chip}>
                  <span>Level-up only</span>
                  <button
                    type="button"
                    aria-label="Clear Level-up Only Filter"
                    title="Clear"
                    style={styles.chipX}
                    className="chip-x"
                    onClick={(e)=>{ e.stopPropagation(); setMoveLevelOnly(false); }}
                  >
                    ×
                  </button>
                </div>
              )}
              {itemFilter && (
                <div style={styles.chip}>
                  <span>{itemFilter}</span>
                  <button
                    type="button"
                    aria-label="Clear Item Filter"
                    title="Clear"
                    style={styles.chipX}
                    className="chip-x"
                    onClick={(e)=>{ e.stopPropagation(); setItemFilter(''); }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Context label + search input (hidden for Live) */}
          {mode!=='live' && mode!=='battle' && mode!=='breeding' && mode!=='daycare' && mode!=='team' && mode!=='horde' && (
            <>
               <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div className="label-muted" style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span>
                    {mode==='pokemon'
                      ? 'Search by name or Dex #'
                      : mode==='areas'
                      ? 'Search by route/area name'
                      : mode==='tm'
                      ? 'Search by TM name'
                      : 'Search by item name'}
                  </span>
                  {mode==='areas' && areaRegion !== 'All' && (
                    <div style={{ ...styles.chip, marginLeft:4 }}>
                      <span>{areaRegion}</span>
                      <button
                        type="button"
                        aria-label="Clear Region Filter"
                        title="Clear"
                        style={styles.chipX}
                        className="chip-x"
                        onClick={(e)=>{ e.stopPropagation(); setAreaRegion('All'); }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
                {mode==='pokemon' && moveFilter && (
                  <label className="label-muted" style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
                    <input
                      type="checkbox"
                      checked={moveLevelOnly}
                      onChange={e=>setMoveLevelOnly(e.target.checked)}
                    />
                    Level-up only
                  </label>
                )}
                {mode==='areas' && (
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div ref={infoRef} style={{ position:'relative' }}>
                      <button
                        className="region-btn"
                        onClick={() => setShowInfoMenu(v => !v)}
                      >
                        Encounter Info {showInfoMenu ? '▴' : '▾'}
                      </button>
                      {showInfoMenu && (
                        <div
                          style={{ position:'absolute', right:0, top:'100%', marginTop:4, padding:8, background:'var(--surface)', border:'1px solid var(--divider)', borderRadius:8, zIndex:20, display:'flex', flexDirection:'column', gap:4 }}
                        >
                          <label className="label-muted" style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <input
                              type="checkbox"
                              checked={showCaught}
                              onChange={e=>setShowCaught(e.target.checked)}
                            />
                            Toggle Caught
                          </label>
                          <label className="label-muted" style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <input
                              type="checkbox"
                              checked={showEvYield}
                              onChange={e=>setShowEvYield(e.target.checked)}
                            />
                            EV Yield
                          </label>
                          <label className="label-muted" style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <input
                              type="checkbox"
                              checked={showCatchRate}
                              onChange={e=>setShowCatchRate(e.target.checked)}
                            />
                            Catch Rate
                          </label>
                          <label className="label-muted" style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <input
                              type="checkbox"
                              checked={showCatchPercent}
                              onChange={e=>setShowCatchPercent(e.target.checked)}
                            />
                            Catch %
                          </label>
                          <label className="label-muted" style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <input
                              type="checkbox"
                              checked={showHeldItem}
                              onChange={e=>setShowHeldItem(e.target.checked)}
                            />
                            Held Item
                          </label>
                          <label className="label-muted" style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <input
                              type="checkbox"
                              checked={showLevel}
                              onChange={e=>setShowLevel(e.target.checked)}
                            />
                            Level
                          </label>
                        </div>
                      )}
                    </div>
                    <div ref={methodFilterRef} style={{ position:'relative' }}>
                      <button
                        className="region-btn"
                        style={{ display:'flex', alignItems:'center', gap:4 }}
                        onClick={() => setShowMethodMenu(v => !v)}
                      >
                        Encounter Type {showMethodMenu ? '▴' : '▾'}
                      </button>
                      {showMethodMenu && (
                        <div
                          style={{ position:'absolute', right:0, top:'100%', marginTop:4, padding:8, background:'var(--surface)', border:'1px solid var(--divider)', borderRadius:8, zIndex:20, display:'flex', flexDirection:'column', gap:4 }}
                        >
                          {ENCOUNTER_TYPES.map(t => (
                            <label key={t} className="label-muted" style={{ display:'flex', alignItems:'center', gap:4 }}>
                              <input
                                type="checkbox"
                                checked={methodFilters.has(t)}
                                onChange={() => toggleMethodFilter(t)}
                              />
                              {t}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ position:'relative' }}>
                      <button
                        type="button"
                        onClick={()=> setShowRegionMenu(v => !v)}
                        className="region-btn"
                      >
                        {areaRegion === 'All' ? 'Region' : areaRegion}
                      </button>
                      {showRegionMenu && (
                        <div className="region-menu">
                          {regionOptions.map(r => (
                            <button
                              type="button"
                              key={r}
                              onClick={()=> { setAreaRegion(r); setShowRegionMenu(false); }}
                              className={r===areaRegion ? 'active' : undefined}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Region chip now shown inline with label on the left; no separate row here */}
                {mode==='tm' && (
                  <div style={{ position:'relative' }}>
                    <button
                      type="button"
                      onClick={()=> setShowRegionMenu(v => !v)}
                      className="region-btn"
                    >
                      {areaRegion === 'All' ? 'Region' : areaRegion}
                    </button>
                    {showRegionMenu && (
                      <div className="region-menu">
                        {regionOptions.map(r => (
                          <button
                            type="button"
                            key={r}
                            onClick={()=> { setAreaRegion(r); setShowRegionMenu(false); }}
                            className={r===areaRegion ? 'active' : undefined}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <input
                value={mode==='areas' ? areaQuery : query}
                onChange={(e)=> {
                  if (mode==='areas') setAreaQuery(e.target.value);
                  else setQuery(e.target.value);
                }}
                onMouseDown={() => { searchClearIntentRef.current = true; }}
                onTouchStart={() => { searchClearIntentRef.current = true; }}
                onFocus={() => {
                  const shouldClear = searchClearIntentRef.current;
                  searchClearIntentRef.current = false;
                  if (!shouldClear) return;
                  if (mode==='areas') setAreaQuery('');
                  else setQuery('');
                }}
                onBlur={() => { searchClearIntentRef.current = false; }}
                onMouseUp={() => { searchClearIntentRef.current = false; }}
                onMouseLeave={() => { searchClearIntentRef.current = false; }}
                onTouchEnd={() => { searchClearIntentRef.current = false; }}
                onTouchCancel={() => { searchClearIntentRef.current = false; }}
                placeholder={mode==='pokemon'
                  ? 'e.g. Garchomp or 445'
                  : mode==='areas'
                  ? 'e.g. Victory Road, Viridian Forest, Route 10'
                  : mode==='tm'
                  ? 'e.g. Giga Drain, Payback'
                  : 'e.g. Master Ball, Shiny Charm'}
                className="input"
                style={{ height:44, borderRadius:10, fontSize:16 }}
              />
            </>
          )}

          {/* Live route panel */}
          {mode==='live' && ocrSupported && (
            <div style={{ marginTop:4 }}>
              <LiveRoutePanel
                areasIndex={areasClean}
                locIndex={locIndex}
                onViewMon={(mon) => { setSelected(mon); setMode('pokemon'); }}
              />
            </div>
          )}

          {/* Live battle panel */}
          {mode==='battle' && ocrSupported && (
            <div style={{ marginTop:4 }}>
              <LiveBattlePanel
                onViewMon={(mon) => { setSelected(mon); setMode('pokemon'); }}
                onCompare={(mon) => {
                  setCompareMode(true);
                  setCompareA(mon);
                  setCompareB(null);
                  setMode('pokemon');
                  setQuery('');
                }}
              />
            </div>
          )}

          {/* Breeding simulator */}
          {mode==='breeding' && (
            <div style={{ marginTop:4 }}>
              <BreedingSimulator />
            </div>
          )}

          {mode==='daycare' && (
            <div style={{ marginTop:4 }}>
              <DaycareManager />
            </div>
          )}

          {/* Team builder */}
          {mode==='team' && (
            <div style={{ marginTop:4 }}>
              <TeamBuilder
                onViewMon={(val) => {
                  let target = null;
                  if (val && typeof val === 'object') {
                    target = getMon(val.name) || getMonByDex(val.id);
                  } else if (val) {
                    target = getMon(String(val));
                  }
                  if (target) {
                    setSelected(target);
                    setMode('pokemon');
                  }
                }}
              />
            </div>
          )}

          {/* Recent selections (session) shown when Pokemon search is blank and no filters are active */}
          {mode==='pokemon' && !query.trim() && !hasFilters && recentFiltered.length > 0 && !(compareMode && compareA && compareB) && (
            <div style={{ marginTop:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <div className="label-muted" style={{ fontWeight:700 }}>Recent</div>
                <button
                  type="button"
                  className="link-btn"
                  style={{ background:'none', border:0, padding:0, color:'var(--accent)', fontWeight:700, cursor:'pointer' }}
                  onClick={() => {
                    setRecentMons([]);
                    try { sessionStorage.removeItem('recentMons'); } catch {}
                  }}
                >
                  Clear Recents
                </button>
              </div>
              <div className="result-grid">
                {recentFiltered.map((r) => {
                  const mon = getMonByDex(r.id);
                  if (!mon) return null;
                  const t = [...new Set((mon.types || []).map(normalizeType))];
                  return (
                    <button
                      key={`recent-${r.id}`}
                      onClick={()=>{
                        if (compareMode) {
                          if (!compareA || (compareA && compareB)) {
                            setCompareA(mon);
                            setCompareB(null);
                            setSelected(null);
                            setQuery('');
                          } else if (compareA && !compareB) {
                            if (!sameMon(compareA, mon)) {
                              setCompareB(mon);
                              setQuery('');
                              setSelected(null);
                            }
                          }
                        } else {
                          setSelected(mon);
                          setQuery('');
                        }
                      }}
                      className="result-tile"
                      style={{ alignItems:'center', padding:10, borderRadius:12, border:'1px solid var(--divider)', background:'var(--surface)', gap:12 }}
                    >
                      <Sprite mon={mon} size={64} alt={mon.name} />
                      <div style={{ textAlign:'left', flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:800 }}>{titleCase(mon.name)}</div>
                        <div className="label-muted">Dex #{mon.id}</div>
                        <div style={{ display:'flex', gap:6, marginTop:6 }}>
                          {t.map(tp => <TypePill key={`r-${r.id}-${tp}`} t={tp} compact />)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pokemon results */}
          {mode==='pokemon' && !(compareMode && compareA && compareB) && !!combinedResults.length && (
            <div className="result-grid" style={{ marginTop:12 }}>
              {combinedResults.map(p => {
                const mon = p;
                const t = [...new Set((p.types || []).map(normalizeType))];
                return (
                  <button
                    key={`${p.id}-${p.name}`}
                    onClick={()=>{
                      if (compareMode) {
                        if (!compareA || (compareA && compareB)) {
                          setCompareA(p);
                          setCompareB(null);
                          setQuery('');
                        } else if (compareA && !compareB) {
                          if (!sameMon(compareA, p)) {
                            setCompareB(p);
                            setQuery('');
                          }
                        }
                      } else {
                        setSelected(p);
                        setQuery('');
                      }
                    }}
                    className={`result-tile${compareMode && compareA && sameMon(p, compareA) ? ' compare-selected' : ''}`}
                      style={{ alignItems:'center', padding:10, borderRadius:12, border:'1px solid var(--divider)', background:'var(--surface)', gap:12 }}
                  >
                    <Sprite mon={mon} size={64} alt={p.name} />
                    <div style={{ textAlign:'left', flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:800 }}>{titleCase(p.name)}</div>
                      <div className="label-muted">Dex #{p.id}</div>
                      <div style={{ display:'flex', gap:6, marginTop:6 }}>
                        {t.map(tp => <TypePill key={tp} t={tp} compact />)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {mode==='pokemon' && compareMode && (
            <CompareView
              left={compareA}
              right={compareB}
              onClearLeft={() => { setCompareA(compareB); setCompareB(null); setSelected(null); setQuery(''); }}
              onClearRight={() => { setCompareB(null); setSelected(null); setQuery(''); }}
              onReplaceLeft={() => {
                const mon = getLatestLiveBattleMon();
                if (!mon) return; // No notifications
                if (!compareA || normalizeKey(compareA.name) !== normalizeKey(mon.name)) {
                  setCompareA(mon);
                }
              }}
              onReplaceRight={() => {
                const mon = getLatestLiveBattleMon();
                if (!mon) return; // No notifications
                if (!compareB || normalizeKey(compareB.name) !== normalizeKey(mon.name)) {
                  setCompareB(mon);
                }
              }}
              onReplaceLeftFromTeam={(picked) => {
                if (!picked) return;
                if (!compareA || normalizeKey(compareA.name) !== normalizeKey(picked.name)) {
                  setCompareA(picked);
                }
              }}
              onReplaceRightFromTeam={(picked) => {
                if (!picked) return;
                if (!compareB || normalizeKey(compareB.name) !== normalizeKey(picked.name)) {
                  setCompareB(picked);
                }
              }}
            />
          )}

          {/* Area results */}
          {mode==='areas' && !!areaHits.length && (
            <div style={{ marginTop:12, display:'grid', gap:12 }}>
              {areaHits.map(hit => (
                <div key={`${hit.region}-${hit.map}`} style={styles.areaCard}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                    <div style={{ fontWeight:800, fontSize:16 }}>
                      {hit.map} <span className="label-muted">({hit.region})</span>
                    </div>
                    <div className="label-muted">{hit.count} Pokemon</div>
                  </div>

                  <div style={{ ...styles.gridCols, marginTop:10 }}>
                    {hit.entries.map((g, idx) => {
                      const mon = getMon(g.monName);
                      const isCaught = mon ? caught.has(mon.id) : false;
                      return (
                        <AreaMonCard
                          key={idx}
                          mon={mon}
                          monName={g.monName}
                          encounters={g.encounters}
                          onView={(m) => {
                            setSelected(m);
                            setMode('pokemon');
                          }}
                          caught={isCaught}
                          showCaught={showCaught}
                          showEv={showEvYield}
                          showCatchRate={showCatchRate}
                          showCatchPercent={showCatchPercent}
                          showHeldItem={showHeldItem}
                          showLevel={showLevel}
                          onToggleCaught={() => mon && toggleCaught(mon.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* TM results */}
          {mode==='tm' && !!tmHits.length && (
            <div style={{ marginTop:12, display:'grid', gap:12 }}>
              {tmHits.map((hit, idx) => (
                <div key={`${hit.region}-${hit.tm}-${idx}`} style={styles.areaCard}>
                  <div style={{ fontWeight:800, fontSize:16 }}>
                    {hit.tm} <span className="label-muted">({hit.region})</span>
                  </div>
                  <div style={{ marginTop:6 }}>{hit.location}</div>
                </div>
              ))}
            </div>
          )}

          {/* Item results */}
          {mode==='items' && !!itemHits.length && (
            <div style={{ marginTop:12, display:'grid', gap:12 }}>
              {itemHits.map(item => (
                <div key={item.id} style={styles.areaCard}>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <img
                      src={`${ITEM_ICON_BASE}${item.id}.png`}
                      alt={item.name}
                      style={{ width:36, height:36, imageRendering:'pixelated' }}
                      onError={e => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = ITEM_PLACEHOLDER;
                        e.currentTarget.style.imageRendering = 'auto';
                      }}
                    />
                    <div>
                      <div style={{ fontWeight:800 }}>{item.name}</div>
                      <div style={{ whiteSpace:'pre-line' }}>{item.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Market results */}
          {mode==='market' && (
            <div style={{ marginTop:12 }}>
              {marketLoading && (
                <div className="label-muted">Loading market data…</div>
              )}
              {marketError && (
                <div className="label-error">{marketError}</div>
              )}
              {!marketLoading && !marketError && (
                <div style={{ display:'grid', gap:12 }}>
                  {marketResults.map((item, idx) => (
                    <div
                      key={item.id ?? idx}
                      style={{ ...styles.areaCard, cursor:'pointer' }}
                      onClick={() => openMarketItem(item)}
                    >
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                          <img
                            src={`${ITEM_ICON_BASE}${item.id}.png`}
                            alt={item.name}
                            style={{ width:36, height:36, imageRendering:'pixelated' }}
                            onError={e => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = ITEM_PLACEHOLDER;
                              e.currentTarget.style.imageRendering = 'auto';
                            }}
                          />
                          <div style={{ fontWeight:800 }}>
                            {item.name}
                          </div>
                        </div>
                        {item.price != null ? (
                          <div>₽ {Number(item.price).toLocaleString()}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {!marketResults.length && (
                    <div className="label-muted">No market data.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detail Panel (Pokemon) */}
        {mode==='pokemon' && resolved && !(compareMode && (compareA || compareB)) && (
          <div ref={detailRef}>
            <PokemonProfile
              key={resolved.id ?? resolved.name}
              mon={resolved}
              spriteMon={selected}
              caught={{ isCaught: caught.has(resolved.id), toggle: () => toggleCaught(resolved.id) }}
              alpha={{
                eligible: ALPHA_ID_SET.has(resolved.id),
                isCaught: alphaCaught.has(resolved.id),
                toggle: () => toggleAlphaCaught(resolved.id),
              }}
              shiny={{ on: profileShiny || shinyGlobal, toggle: () => setProfileShiny(v => !v) }}
              build={{
                value: singleBuild,
                set: setSingleBuild,
                override: singleOverride,
                underline: singleUnderline,
                setters: singleSetters,
                natureList,
              }}
              catchInfo={{
                ballKey: selectedBallKey,
                setBallKey: setSelectedBallKey,
                percent: catchPercent,
                oneHp: isOneHp,
                setOneHp: setIsOneHp,
                status: statusEffect,
                toggleStatus: toggleStatusEffect,
              }}
              locations={byRegion}
              onClose={() => { setSelected(null); setQuery(''); }}
              onCompare={() => {
                setCompareMode(true);
                setCompareA(resolved);
                setCompareB(null);
                setSelected(null);
                setQuery('');
              }}
              onTypeClick={(tp) => {
                setMode('pokemon');
                setSelected(null);
                setQuery('');
                setTypeFilter(normalizeType(tp));
                setTypeFilter2('');
              }}
              onSelectMon={setSelected}
              onOpenArea={(region, mapName) => {
                setMode('areas');
                setAreaRegion(region);
                // Remove any parenthetical notes from the location name
                setAreaQuery(mapName.replace(/\s*\([^)]*\)/g, '').trim());
                // The shell's main area scrolls, not the window.
                document.querySelector('.shell-main')?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        )}
      </div>
      </AppShell>

      {showTypeChart && (
        <div
          onClick={() => {
            setShowTypeChart(false);
            setMode('pokemon');
          }}
          style={{
            position:'fixed',
            top:0,
            left:0,
            width:'100%',
            height:'100%',
            background:'rgba(0,0,0,0.75)',
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            zIndex:1100
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ maxWidth:'85vw', maxHeight:'85vh', padding:8 }}
          >
            <img
              src={typeChartImg}
              alt="Pokemon type chart"
              style={{
                maxWidth:'85vw',
                maxHeight:'85vh',
                width:'auto',
                height:'auto',
                display:'block',
                borderRadius:12,
                boxShadow:'0 12px 32px rgba(0,0,0,0.6)',
                objectFit:'contain'
              }}
            />
          </div>
        </div>
      )}

      {showResources && (
        <ResourcesOverlay onClose={() => setShowResources(false)} />
      )}

      {marketSelected && (
        <div
          onClick={() => setMarketSelected(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '80%',
              height: '80%',
              background: 'var(--surface)',
              border: '1px solid var(--divider)',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 10px',
                borderBottom: '1px solid var(--divider)'
              }}
            >
              <div style={{ fontWeight: 800 }}>{marketSelected.name}</div>
              <button
                onClick={() => setMarketSelected(null)}
                style={{ cursor: 'pointer' }}
              >
                X
              </button>
            </div>
            <webview
              src={`https://pokemmohub.com/items/${normalizeKey(marketSelected.name)}`}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      )}

      {/* Catch notifications */}
      {catchNotifications.map((notification) => (
        <CatchNotification
          key={notification.id}
          pokemonName={notification.pokemonName}
          isAlpha={notification.isAlpha}
          spriteUrl={notification.spriteUrl}
          onComplete={() => removeCatchNotification(notification.id)}
        />
      ))}
    </>
    </ColorContext.Provider>
    </ShinyCaughtContext.Provider>
    </AlphaCaughtContext.Provider>
    </CaughtContext.Provider>
  );
}

export default App;
