import React from 'react';
import Sprite from './Sprite.jsx';
import TypePill from './TypePill.jsx';
import { titleCase } from '../../lib/typeChart.js';
import { normalizeKey } from '../../lib/areas.js';
import { DEX_LIST, getMonByDex, EVO_PARENTS, MOVES_INDEX } from '../../lib/dexData.js';
import { ITEM_INDEX, ITEM_ICON_BASE, ITEM_PLACEHOLDER } from '../../lib/items.js';

function EvolutionChain({ mon, onSelect }) {
  const base = React.useMemo(() => {
    if (!mon) return null;
    let cur = mon;
    while (EVO_PARENTS.get(cur.id)?.length) {
      const parentId = EVO_PARENTS.get(cur.id)[0];
      const parent = getMonByDex(parentId);
      if (!parent) break;
      cur = parent;
    }
    return cur;
  }, [mon]);

  const renderMon = (m, isFormDisplay = false) => {
    if (!m) return null;
    // For forms, check if the name matches (since forms might not have IDs)
    const isSelected = isFormDisplay
      ? !!(mon && m && normalizeKey(m.name) === normalizeKey(mon.name))
      : !!(mon && m && m.id === mon.id);
    const canSelect = !!(onSelect && !isSelected);
    const handleSelect = () => {
      if (onSelect) onSelect(m);
    };
    const handleKeyDown = (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        handleSelect();
      }
    };
    return (
      <div style={{ display:'flex', alignItems:'center', gap:16 }}>
        <div style={{ textAlign:'center' }}>
          <div
            style={{
              display:'inline-block',
              padding:2,
              border: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: canSelect ? 'pointer' : 'default',
            }}
            role={canSelect ? 'button' : undefined}
            tabIndex={canSelect ? 0 : undefined}
            onClick={canSelect ? handleSelect : undefined}
            onKeyDown={canSelect ? handleKeyDown : undefined}
          >
            <Sprite mon={m} size={72} alt={m.name} />
          </div>
          <div className="label-muted">#{m.id ? String(m.id).padStart(3,'0') : '--'}</div>
          {isSelected ? (
            <span style={{ color:'var(--accent)', fontWeight:700 }}>
              {titleCase(m.name)}
            </span>
          ) : (
            <button
              type="button"
              className="link-btn"
              style={{ background:'none', border:0, padding:0, color:'var(--accent)', fontWeight:700, cursor:'pointer' }}
              onClick={handleSelect}
            >
              {titleCase(m.name)}
            </button>
          )}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center', marginTop:4 }}>
            {(m.types || []).map(t => <TypePill key={t} t={t} compact />)}
          </div>
        </div>
        {Array.isArray(m.evolutions) && m.evolutions.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {m.evolutions.map((evo) => {
              const child = getMonByDex(evo.id);

              const rawType = String(evo.type || '').toLowerCase();
              const locationMap = {
                level_location_1: 'Lv. Up Near A Special Magnetic Field',
                level_location_2: 'Lv. Up Near A Moss Rock',
                level_location_3: 'Lv. Up Near An Ice Rock',
              };
              const isLevelLocation = Object.prototype.hasOwnProperty.call(locationMap, rawType);
              const typeLabel = rawType.replace(/_/g, ' ');
              let label = isLevelLocation ? locationMap[rawType] : titleCase(typeLabel);

              const needsItem = rawType.includes('item');
              const isTrade = rawType.startsWith('trade');
              let val = null;
              let itemId = null;
              if (!isLevelLocation) {
                if (evo.item_name) {
                  val = evo.item_name;
                  const found = ITEM_INDEX.byName.get(normalizeKey(evo.item_name));
                  if (found?.id != null) itemId = found.id;
                } else if (needsItem && typeof evo.val === 'number' && ITEM_INDEX.byId.has(evo.val)) {
                  val = ITEM_INDEX.byId.get(evo.val)?.name;
                  itemId = evo.val;
                } else if (evo.val != null) {
                  val = evo.val;
                }
              }

              if (rawType === 'level_with_monster' && typeof evo.val === 'number') {
                const partner = getMonByDex(evo.val);
                if (partner) {
                  label = `Level up with ${titleCase(partner.name)}`;
                  val = null;
                }
              }

              if (rawType === 'level_with_skill' && typeof evo.val === 'number') {
                const move = MOVES_INDEX.byId.get(evo.val);
                if (move) {
                  label = `Level up knowing ${move.name}`;
                  val = null;
                }
              }

              if (
                rawType === 'happiness' ||
                rawType === 'happiness_day' ||
                rawType === 'happiness_night'
              ) {
                label = 'Evolve with Happiness';
                if (rawType === 'happiness_day') label += ': Day';
                if (rawType === 'happiness_night') label += ': Night';
                val = null;
              }

              // Clean up bogus trade values like "0:" so it renders as plain "Trade"
              if (isTrade) {
                const sval = String(val ?? '').trim();
                if (!sval || /^0:?$/.test(sval)) {
                  val = null;
                }
              }

              if (val != null) {
                    if (/with item$/i.test(label) && (evo.item_name || (needsItem && ITEM_INDEX.byId.has(evo.val)))) {
                      label = `${label.replace(/ item$/i, '')} ${val}`;
                   } else {
                      label = `${label}: ${val}`;
                   }
                 }

          return (
                <div key={evo.id} style={{ display:'flex', alignItems:'center', gap:16 }}>
                  <div style={{ textAlign:'center', fontSize:12, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                    {itemId != null && (
                      <img
                        src={`${ITEM_ICON_BASE}${itemId}.png`}
                        alt={String(val || 'Item')}
                        style={{ width:22, height:22, imageRendering:'pixelated' }}
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = ITEM_PLACEHOLDER; e.currentTarget.style.imageRendering = 'auto'; }}
                      />
                    )}
                    <div style={{ fontSize:24 }}>{"\u2192"}</div>
                    <div className="label-muted">{label}</div>
                  </div>
                  {renderMon(child)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (!base) return null;
  const hasChain = base.id !== mon.id || (base.evolutions || []).length > 0;

  // Find the true base form if current mon is an alternate form
  let formsSource = base;
  if (mon?.name) {
    // Check if current mon is an alternate form by checking if any Pokemon has this as a form
    const monNameKey = normalizeKey(mon.name);
    const trueBase = DEX_LIST.find(p =>
      Array.isArray(p.forms) && p.forms.some(f => normalizeKey(f.name) === monNameKey)
    );
    if (trueBase) {
      formsSource = trueBase;
    }
  }

  const hasForms = Array.isArray(formsSource.forms) && formsSource.forms.length > 0;

  // Determine the title based on what's available
  let title = 'Evolution';
  if (hasForms && hasChain) {
    title = 'Evolution / Forms';
  } else if (hasForms && !hasChain) {
    title = 'Forms';
  }

  return (
    <div className="evo-chain">
      <div className="evo-title">{title}</div>
      {!hasChain && !hasForms ? (
        <div className="label-muted">This Pokémon doesn't evolve</div>
      ) : (
        <>
          {hasChain && renderMon(base)}
          {hasForms && (
            <div style={{ marginTop: hasChain ? 16 : 0 }}>
              {hasChain && <div className="evo-subtitle">Forms</div>}
              <div style={{ display:'flex', flexWrap:'wrap', gap:16 }}>
                {/* Show the base form first */}
                {renderMon(formsSource, true)}
                {/* Then show all the other forms */}
                {formsSource.forms.map((form, idx) => (
                  <div key={`form-${idx}`}>
                    {renderMon(form, true)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default EvolutionChain;
