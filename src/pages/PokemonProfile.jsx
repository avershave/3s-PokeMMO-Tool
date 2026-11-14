import { useState } from 'react';
import './profile.css';
import alphaIconUrl from '../../data/alpha.ico';
import { headerBackground } from '../lib/typeColors.js';
import { titleCase } from '../lib/typeChart.js';
import { normalizeKey } from '../lib/areas.js';
import { formatHeight, formatWeight, formatGenderRatio } from '../lib/format.js';
import { ITEM_INDEX, ITEM_ICON_BASE, ITEM_PLACEHOLDER } from '../lib/items.js';
import { STATUS_EFFECT_BUTTONS } from '../lib/catch.js';
import { MOVE_METHODS } from '../lib/moves.js';
import Sprite from '../components/pokemon/Sprite.jsx';
import TypePill from '../components/pokemon/TypePill.jsx';
import StatsRow from '../components/pokemon/StatsRow.jsx';
import NatureSelect from '../components/pokemon/NatureSelect.jsx';
import EvolutionChain from '../components/pokemon/EvolutionChain.jsx';
import MovesTable from '../components/pokemon/MovesTable.jsx';
import MethodPill from '../components/pokemon/MethodPill.jsx';
import RarityPill from '../components/pokemon/RarityPill.jsx';
import BallSelect from '../components/pokemon/BallSelect.jsx';
import DelayedTooltip from '../components/pokemon/DelayedTooltip.jsx';
import PokeballIcon from '../components/pokemon/PokeballIcon.jsx';
import { useAbilityDesc } from '../components/pokemon/AbilityPill.jsx';
import RecommendedMovesets from '../components/RecommendedMovesets.jsx';

const DASH = '—';
const EV_LABELS = [
  ['ev_hp', 'HP'], ['ev_attack', 'Atk'], ['ev_defense', 'Def'],
  ['ev_sp_attack', 'Sp. Atk'], ['ev_sp_defense', 'Sp. Def'], ['ev_speed', 'Spd'],
];
const ABILITY_SLOTS = ['1', '2', 'Hidden'];

function evYieldText(yields = {}) {
  const parts = EV_LABELS.filter(([key]) => (yields[key] || 0) > 0).map(([key, label]) => `${yields[key]} ${label}`);
  return parts.length ? parts.join(', ') : 'None';
}

// Up to three ability slots; a repeated ability or a placeholder ("--") leaves its slot empty.
function abilitySlots(abilities = []) {
  const names = abilities.map(a => a?.name).filter(Boolean);
  const seen = new Set();
  return ABILITY_SLOTS.map((slot, i) => {
    const name = names[i];
    if (!name || !/[a-z]/i.test(name) || seen.has(name)) return null;
    seen.add(name);
    return { slot, name };
  }).filter(Boolean);
}

function uniqueHeldItems(items = []) {
  const seen = new Set();
  return items.filter(h => {
    if (!h) return false;
    const key = h.id != null ? `id-${h.id}` : `name-${normalizeKey(typeof h === 'string' ? h : h.name || '')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchupGroups(weakness = {}) {
  const resists = [
    ...(weakness.x0_5 || []).map(t => ({ t })),
    ...(weakness.x0_25 || []).map(t => ({ t, note: '¼×' })),
  ];
  return [
    { label: '4× weak', list: (weakness.x4 || []).map(t => ({ t })) },
    { label: '2× weak', list: (weakness.x2 || []).map(t => ({ t })) },
    { label: 'Resists', list: resists },
    { label: 'Immune', list: (weakness.x0 || []).map(t => ({ t })) },
  ].filter(g => g.list.length);
}

function AbilityRow({ name, slot }) {
  const desc = useAbilityDesc(name)?.trim();
  return (
    <div className="pp-row">
      <DelayedTooltip content={desc || null} delay={400}>
        <span className="pp-row-main" style={{ cursor: desc ? 'help' : 'default' }}>{titleCase(name)}</span>
      </DelayedTooltip>
      <span className="pp-row-aside">{slot}</span>
    </div>
  );
}

function HeldItemRow({ item }) {
  const name = typeof item === 'string' ? item : item.name;
  const info = ITEM_INDEX.byId.get(item.id) || ITEM_INDEX.byName.get(normalizeKey(name || ''));
  return (
    <div className="pp-row pp-held">
      <img
        src={item.id ? `${ITEM_ICON_BASE}${item.id}.png` : ITEM_PLACEHOLDER}
        alt=""
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = ITEM_PLACEHOLDER;
          e.currentTarget.style.imageRendering = 'auto';
        }}
      />
      <DelayedTooltip content={info?.description || ''}>
        <span className="pp-row-main" style={{ cursor: info?.description ? 'help' : 'default' }}>{name}</span>
      </DelayedTooltip>
    </div>
  );
}

function Fold({ title, open, onToggle, children }) {
  return (
    <section className="pp-fold">
      <button type="button" className="pp-fold-head" aria-expanded={open} onClick={onToggle}>
        {open ? '▾' : '▸'} {title}
      </button>
      {open && <div className="pp-fold-body">{children}</div>}
    </section>
  );
}

function LocationRow({ region, loc, onOpenArea }) {
  const methods = (Array.isArray(loc.method) ? loc.method : [loc.method]).filter(Boolean);
  const rarities = (Array.isArray(loc.rarity) ? loc.rarity : [loc.rarity]).filter(Boolean);
  const isLure = methods.some(m => /lure/i.test(m));
  const level = loc.min && loc.max ? `Lv ${loc.min}-${loc.max}` : (loc.min || loc.max) ? `Lv ${loc.min || loc.max}` : null;
  return (
    <button type="button" className="pp-row pp-loc" onClick={() => onOpenArea(region, loc.map)} title="Open in Area search">
      <span className="pp-loc-name">{loc.map}</span>
      {level && <span className="pp-loc-level">{level}</span>}
      <span className="pp-loc-pills">
        {methods.map((m, j) => <MethodPill key={`m-${j}-${m}`} method={m} />)}
        {!isLure && rarities.map((r, j) => <RarityPill key={`r-${j}-${r}`} rarity={r} hordeSize={loc.hordeSize} />)}
      </span>
    </button>
  );
}

export default function PokemonProfile({
  mon, spriteMon, caught, alpha, shiny, build, catchInfo, locations = [],
  onClose, onCompare, onTypeClick, onSelectMon, onOpenArea,
}) {
  const [showLocations, setShowLocations] = useState(false);
  const [showSets, setShowSets] = useState(false);
  const [showMoves, setShowMoves] = useState(false);

  const name = titleCase(mon.name || '') || DASH;
  const types = mon.types || [];
  const eggGroups = (mon.eggGroups || []).filter(Boolean).map(titleCase).join(' / ');
  const facts = [
    ['Egg group', eggGroups || 'None'],
    ['Catch rate', mon.catchRate ?? DASH],
    ['EV yield', evYieldText(mon.yields)],
    ['Gender', formatGenderRatio(mon.genderRatio)],
    ['Exp', titleCase(String(mon.expType || '').replace(/_/g, ' ')) || DASH],
    ['Height', formatHeight(mon.height)],
    ['Weight', formatWeight(mon.weight)],
    ['Obtainable', mon.obtainable == null ? DASH : (mon.obtainable ? 'Yes' : 'No')],
  ];
  const abilities = abilitySlots(mon.abilities);
  const heldItems = uniqueHeldItems(mon.heldItems);
  const matchups = matchupGroups(mon.weakness);
  const hasMoves = MOVE_METHODS.some(m => (mon.moves?.[m.key] || []).length);
  const percent = Number.isFinite(catchInfo.percent) ? `${catchInfo.percent.toFixed(1)}%` : DASH;

  return (
    <article className="pp pokemon-profile">
      <header className="pp-header" data-part="profile-header" style={{ background: headerBackground(types) }}>
        <div className="pp-sprite">
          <Sprite mon={spriteMon} size={96} alt={name} forceShiny={shiny.on} playOnHover />
          <button
            type="button"
            className={`pp-shiny${shiny.on ? ' is-on' : ''}`}
            onClick={shiny.toggle}
            aria-pressed={shiny.on}
            aria-label="Shiny sprite"
            title="Toggle shiny sprite"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <polygon points="12,2 14.9,8.1 22,9 16.8,13.4 18.3,20.4 12,16.9 5.7,20.4 7.2,13.4 2,9 9.1,8.1" />
            </svg>
          </button>
        </div>

        <div className="pp-id">
          <h1 className="pp-name">{name}</h1>
          {mon.id != null && <div className="pp-no">#{String(mon.id).padStart(3, '0')}</div>}
          <div className="pp-types">
            {types.length ? types.map(t => (
              <button key={t} type="button" className="pp-type" onClick={() => onTypeClick(t)} title="Filter by type">
                {titleCase(t)}
              </button>
            )) : <span className="pp-type">{DASH}</span>}
          </div>
          {mon.forms?.length > 1 && (
            <div className="pp-forms">
              Forms: {mon.forms.map(f => f.name).join(' · ')}
            </div>
          )}
        </div>

        <dl className="pp-facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="pp-actions">
          <button type="button" className="pp-btn" onClick={onCompare}>Compare</button>
          <button
            type="button"
            className="pp-icon"
            onClick={caught.toggle}
            aria-pressed={caught.isCaught}
            title={caught.isCaught ? 'Mark as uncaught' : 'Mark as caught'}
            aria-label={caught.isCaught ? 'Mark as uncaught' : 'Mark as caught'}
          >
            <PokeballIcon filled={caught.isCaught} />
          </button>
          {alpha.eligible && (
            <button
              type="button"
              className="pp-icon"
              onClick={alpha.toggle}
              aria-pressed={alpha.isCaught}
              title={alpha.isCaught ? 'Mark Alpha as uncaught' : 'Mark Alpha as caught'}
              aria-label={alpha.isCaught ? 'Mark Alpha as uncaught' : 'Mark Alpha as caught'}
            >
              <img src={alphaIconUrl} alt="" style={{ opacity: alpha.isCaught ? 1 : 0.4 }} />
            </button>
          )}
          <button type="button" className="pp-icon pp-close" onClick={onClose} aria-label="Close profile" title="Close profile">
            ×
          </button>
        </div>
      </header>

      <div className="pp-body">
        <div className="pp-col">
          <section>
            <h2 className="pp-h">Base stats</h2>
            <StatsRow
              mon={mon}
              override={build.override}
              underlineKeys={build.underline}
              build={build.value}
              onSetIV={build.setters.onSetIV}
              onSetEV={build.setters.onSetEV}
              onSetLevel={build.setters.onSetLevel}
              natureEl={
                <NatureSelect
                  natureList={build.natureList}
                  value={build.value.nature}
                  onChange={(v) => build.set(prev => ({ ...prev, nature: v }))}
                />
              }
            />
          </section>

          <section>
            <h2 className="pp-h">Type matchups</h2>
            {matchups.length ? matchups.map(g => (
              <div key={g.label} className="pp-row pp-matchup">
                <span className="pp-row-label">{g.label}</span>
                <span className="pp-chips">
                  {g.list.map(({ t, note }) => (
                    <span key={t} className="pp-chip-wrap">
                      <TypePill t={t} compact />
                      {note && <span className="pp-chip-note">{note}</span>}
                    </span>
                  ))}
                </span>
              </div>
            )) : <p className="pp-empty">None</p>}
          </section>

          <section className="pp-evo">
            <EvolutionChain mon={mon} onSelect={onSelectMon} />
          </section>
        </div>

        <div className="pp-col">
          <section>
            <h2 className="pp-h">Abilities</h2>
            {abilities.length
              ? abilities.map(a => <AbilityRow key={a.slot} name={a.name} slot={a.slot} />)
              : <p className="pp-empty">None</p>}
          </section>

          <section>
            <h2 className="pp-h">Held items</h2>
            {heldItems.length
              ? heldItems.map((h, i) => <HeldItemRow key={h.id ?? h.name ?? i} item={h} />)
              : <p className="pp-empty">None</p>}
          </section>

          <section>
            <h2 className="pp-h">Catch</h2>
            <div className="pp-catch">
              <BallSelect value={catchInfo.ballKey} onChange={catchInfo.setBallKey} />
              <span className="pp-catch-pct">{percent}</span>
            </div>
            <div className="pp-mods">
              <button
                type="button"
                className={`pp-mod danger${catchInfo.oneHp ? ' is-on' : ''}`}
                aria-pressed={catchInfo.oneHp}
                onClick={() => catchInfo.setOneHp(v => !v)}
              >
                1 HP
              </button>
              {STATUS_EFFECT_BUTTONS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`pp-mod${catchInfo.status === key ? ' is-on' : ''}`}
                  aria-pressed={catchInfo.status === key}
                  onClick={() => catchInfo.toggleStatus(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="pp-below">
        <Fold title="Locations" open={showLocations} onToggle={() => setShowLocations(v => !v)}>
          {locations.length === 0 && <p className="pp-empty">No wild locations found.</p>}
          {locations.map(([region, list]) => (
            <div key={region} className="pp-region">
              <h3 className="pp-region-name">{region}</h3>
              {list.map((loc, i) => <LocationRow key={`${loc.map}-${i}`} region={region} loc={loc} onOpenArea={onOpenArea} />)}
            </div>
          ))}
        </Fold>

        <section className="pp-fold pp-sets">
          <RecommendedMovesets speciesName={mon.name} expanded={showSets} onToggle={() => setShowSets(v => !v)} />
        </section>

        {hasMoves && (
          <Fold title="Moves" open={showMoves} onToggle={() => setShowMoves(v => !v)}>
            {MOVE_METHODS.map(m => (
              <MovesTable key={m.key} title={m.label} moves={mon.moves[m.key] || []} showLevel={m.key === 'lv'} />
            ))}
          </Fold>
        )}
      </div>
    </article>
  );
}
