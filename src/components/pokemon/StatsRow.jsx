import { useState } from 'react';
import { clamp, getBaseStatsFrom } from '../../lib/stats.js';

function StatInputBox({ label, value, min, max, onChange }) {
  return (
    <div className="profile-stat-input">
      <div className="profile-stat-input-label">{label}</div>
      <input
        className="input profile-stat-input-field"
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        min={min}
        max={max}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function StatsRow({ mon, other=null, override=null, otherOverride=null, underlineKeys=new Set(), build, onSetIV, onSetEV, onSetLevel, natureEl=null }) {
  const baseStats = getBaseStatsFrom(mon || {});
  const otherBaseStats = other ? getBaseStatsFrom(other) : null;
  const keyMeta = [
    { label: 'HP', key: 'hp', color: '#f87171' },
    { label: 'Att', key: 'attack', color: '#fb923c' },
    { label: 'Def', key: 'defense', color: '#facc15' },
    { label: 'Sp. Atk', key: 'special_attack', color: '#60a5fa' },
    { label: 'Sp. Def', key: 'special_defense', color: '#34d399' },
    { label: 'Spd', key: 'speed', color: '#f472b6' },
  ];

  const map = Object.fromEntries(keyMeta.map(({ label, key }) => {
    const raw = override && override[key] != null ? override[key] : (Number(baseStats[key]) || 0);
    return [label, raw];
  }));
  const otherMap = other ? Object.fromEntries(keyMeta.map(({ label, key }) => {
    const raw = otherOverride && otherOverride[key] != null ? otherOverride[key] : (Number(otherBaseStats?.[key]) || 0);
    return [label, raw];
  })) : null;
  const total = keyMeta.reduce((sum, { label }) => sum + (Number(map[label]) || 0), 0);
  const totalOther = other ? keyMeta.reduce((sum, { label }) => sum + (Number(otherMap?.[label]) || 0), 0) : null;

  const evTotal = ['hp','attack','defense','special_attack','special_defense','speed']
    .reduce((s,k)=> s + (Number(build?.ev?.[k] || 0) || 0), 0);

  const [showExtras, setShowExtras] = useState(false);

  const maxStatValue = Math.max(
    180,
    ...keyMeta.map(({ label }) => Number(map[label]) || 0),
    ...(other ? keyMeta.map(({ label }) => Number(otherMap?.[label]) || 0) : [])
  );

  const valueToPercent = (value) => {
    const pct = Math.max(6, Math.round((Number(value) || 0) / maxStatValue * 100));
    return pct + '%';
  };

  const toggleExtras = () => {
    if (showExtras) {
      for (const { key } of keyMeta) {
        onSetEV && onSetEV(key, '');
        onSetIV && onSetIV(key, '');
      }
      onSetLevel && onSetLevel('');
    }
    setShowExtras((prev) => !prev);
  };

  const underlineTotal = underlineKeys?.has('total');

  return (
    <div className="profile-stats">
      <div className="profile-stats-lines">
        {keyMeta.map(({ label, key, color }) => {
          const value = map[label] ?? '-';
          const numericValue = Number(value) || 0;
          const underline = underlineKeys?.has(key);
          const diff = other ? ((Number(map[label]) || 0) - (Number(otherMap?.[label]) || 0)) : null;

          return (
            <div key={label} className="profile-stat-line">
              <span className="profile-stat-label">{label}</span>
              <div className="profile-stat-bar">
                <div className="profile-stat-bar-fill" style={{ width: valueToPercent(numericValue), background: color }} />
              </div>
              <span className={'profile-stat-value' + (underline ? ' is-underlined' : '')}>{value ?? '-'}</span>
              {diff != null && diff !== 0 && (
                <span className={'profile-stat-diff ' + (diff > 0 ? 'is-positive' : 'is-negative')}>
                  {diff > 0 ? '+' + diff : diff}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="profile-stat-total">
        <span className="profile-stat-label">Total</span>
        <div className="profile-stat-total-value">
          <span className={'profile-stat-value' + (underlineTotal ? ' is-underlined' : '')}>{total || '-'}</span>
          {totalOther != null && totalOther !== undefined && (total - totalOther) !== 0 && (
            <span className={'profile-stat-diff ' + ((total - totalOther) > 0 ? 'is-positive' : 'is-negative')}>
              {(total - totalOther) > 0 ? '+' + (total - totalOther) : (total - totalOther)}
            </span>
          )}
        </div>
      </div>
      {natureEl && (
        <div className="profile-nature-row">
          {natureEl}
        </div>
      )}
      <button type="button" className="profile-stats-toggle" onClick={toggleExtras}>
        Include IVs and EVs
        <span className="profile-stats-toggle-icon">{showExtras ? 'v' : '>'}</span>
      </button>
      {showExtras && (
        <div className="profile-stats-extra">
          <div className="profile-stats-extra-grid">
            {keyMeta.map(({ label, key }) => (
              <StatInputBox
                key={'iv-' + key}
                label={label + ' IV'}
                value={build?.iv?.[key] ?? ''}
                min={0}
                max={31}
                onChange={(e) => {
                  const raw = e.target.value;
                  const val = raw === '' ? '' : clamp(parseInt(raw, 10) || 0, 0, 31);
                  onSetIV && onSetIV(key, val);
                }}
              />
            ))}
            <StatInputBox
              label="Level"
              value={build?.level ?? ''}
              min={1}
              max={100}
              onChange={(e) => {
                const raw = e.target.value;
                const val = raw === '' ? '' : clamp(parseInt(raw, 10) || 0, 1, 100);
                onSetLevel && onSetLevel(val);
              }}
            />
            {keyMeta.map(({ label, key }) => (
              <StatInputBox
                key={'ev-' + key}
                label={label + ' EV'}
                value={build?.ev?.[key] ?? ''}
                min={0}
                max={252}
                onChange={(e) => {
                  const raw = e.target.value;
                  const val = raw === '' ? '' : clamp(parseInt(raw, 10) || 0, 0, 252);
                  onSetEV && onSetEV(key, val);
                }}
              />
            ))}
            <div className="profile-stat-total-card">
              <div className="profile-stat-input-label">EV Total</div>
              <div className="profile-stat-total-value"><span>{evTotal || 0}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StatsRow;
