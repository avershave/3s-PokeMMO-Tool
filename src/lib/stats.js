import { normalizeKey } from './areas.js';

// ---------- Stat computation ----------
const STAT_KEYS = ['hp','attack','defense','special_attack','special_defense','speed'];
function clamp(n, lo, hi){
  const x = Number(n);
  if (isNaN(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
function getBaseStatsFrom(mon = {}){
  const s = mon?.stats || {};
  return {
    hp: Number(s.base_hp ?? s.hp ?? s.HP ?? 0) || 0,
    attack: Number(s.base_attack ?? s.attack ?? s.att ?? 0) || 0,
    defense: Number(s.base_defense ?? s.defense ?? s.def ?? 0) || 0,
    special_attack: Number(s.base_special_attack ?? s.special_attack ?? s.s_att ?? s.sp_attack ?? 0) || 0,
    special_defense: Number(s.base_special_defense ?? s.special_defense ?? s.s_def ?? s.sp_defense ?? 0) || 0,
    speed: Number(s.base_speed ?? s.speed ?? s.spd ?? 0) || 0,
  };
}
function getDisplayStatsFrom(mon = {}){
  const s = mon?.stats || {};
  return {
    hp: Number(s.hp ?? s.HP ?? s.base_hp ?? 0) || 0,
    attack: Number(s.attack ?? s.att ?? s.base_attack ?? 0) || 0,
    defense: Number(s.defense ?? s.def ?? s.base_defense ?? 0) || 0,
    special_attack: Number(s.special_attack ?? s.s_att ?? s.sp_attack ?? s.base_special_attack ?? 0) || 0,
    special_defense: Number(s.special_defense ?? s.s_def ?? s.sp_defense ?? s.base_special_defense ?? 0) || 0,
    speed: Number(s.speed ?? s.spd ?? s.base_speed ?? 0) || 0,
  };
}
function computeFinalStats(base, ivs, evs, level, natureMods){
  const L = clamp(level, 1, 100);
  const IV = Object.fromEntries(STAT_KEYS.map(k => [k, clamp(ivs?.[k] ?? 0, 0, 31)]));
  const EVraw = Object.fromEntries(STAT_KEYS.map(k => [k, clamp(evs?.[k] ?? 0, 0, 252)]));
  let total = STAT_KEYS.reduce((sum,k)=> sum + (EVraw[k]||0), 0);
  const EV = { ...EVraw };
  if (total > 510) {
    let excess = total - 510;
    const order = [...STAT_KEYS].sort((a,b) => (EV[b]||0) - (EV[a]||0));
    for (const k of order){
      if (excess <= 0) break;
      const take = Math.min(excess, EV[k]);
      EV[k] -= take;
      excess -= take;
    }
  }
  const EVq = Object.fromEntries(STAT_KEYS.map(k => [k, Math.floor((EV[k]||0) / 4)]));
  const Nat = natureMods || { attack:1, defense:1, special_attack:1, special_defense:1, speed:1 };

  const out = {};
  out.hp = Math.floor(((2*base.hp + IV.hp + EVq.hp) * L) / 100) + L + 10;
  for (const k of ['attack','defense','special_attack','special_defense','speed']){
    const raw = Math.floor(((2*base[k] + IV[k] + EVq[k]) * L) / 100) + 5;
    const mod = Nat[k] ?? 1.0;
    out[k] = Math.floor(raw * mod);
  }
  return out;
}
function sumStats(map){ return ['hp','attack','defense','special_attack','special_defense','speed'].reduce((s,k)=> s + ((map?.[k]||0) | 0), 0); }

function mkInitialBuild(){
  return {
    level: '',
    nature: '',
    iv: { hp:'', attack:'', defense:'', special_attack:'', special_defense:'', speed:'' },
    ev: { hp:'', attack:'', defense:'', special_attack:'', special_defense:'', speed:'' },
  };
}

function isDirty(b){
  if (!b) return false;
  if (b.level !== '' && b.level != null) return true;
  if (b.nature && normalizeKey(b.nature) !== '') return true;
  for (const k of ['hp','attack','defense','special_attack','special_defense','speed']){ if (b.iv?.[k] !== '' && (b.iv?.[k] ?? 0) !== 0) return true; }
  for (const k of ['hp','attack','defense','special_attack','special_defense','speed']){ if (b.ev?.[k] !== '' && (b.ev?.[k] ?? 0) !== 0) return true; }
  return false;
}

function coerceBuild(b){
  const rawL = b?.level;
  const level = (rawL === '' || rawL == null)
    ? 50
    : clamp(parseInt(rawL, 10) || 1, 1, 100);
  return {
    level,
    nature: b?.nature || '',
    iv: { hp: b?.iv?.hp === '' ? 0 : (b?.iv?.hp ?? 0), attack: b?.iv?.attack === '' ? 0 : (b?.iv?.attack ?? 0), defense: b?.iv?.defense === '' ? 0 : (b?.iv?.defense ?? 0), special_attack: b?.iv?.special_attack === '' ? 0 : (b?.iv?.special_attack ?? 0), special_defense: b?.iv?.special_defense === '' ? 0 : (b?.iv?.special_defense ?? 0), speed: b?.iv?.speed === '' ? 0 : (b?.iv?.speed ?? 0) },
    ev: { hp: b?.ev?.hp === '' ? 0 : (b?.ev?.hp ?? 0), attack: b?.ev?.attack === '' ? 0 : (b?.ev?.attack ?? 0), defense: b?.ev?.defense === '' ? 0 : (b?.ev?.defense ?? 0), special_attack: b?.ev?.special_attack === '' ? 0 : (b?.ev?.special_attack ?? 0), special_defense: b?.ev?.special_defense === '' ? 0 : (b?.ev?.special_defense ?? 0), speed: b?.ev?.speed === '' ? 0 : (b?.ev?.speed ?? 0) },
  };
}

function underlineFrom(override, baseline){
  const set = new Set();
  if (!override || !baseline) return set;
  for (const k of ['hp','attack','defense','special_attack','special_defense','speed']){ if ((override[k]||0) !== (baseline[k]||0)) set.add(k); }
  if (sumStats(override) !== sumStats(baseline)) set.add('total');
  return set;
}

export { STAT_KEYS, clamp, getBaseStatsFrom, getDisplayStatsFrom, computeFinalStats, sumStats, mkInitialBuild, isDirty, coerceBuild, underlineFrom };
