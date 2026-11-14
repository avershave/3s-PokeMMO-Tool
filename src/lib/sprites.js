import { normalizeKey } from './areas.js';

/** Optional overrides in .env / .env.production:
 *  VITE_SPRITES_BASE=/sprites/pokeapi/
 *  VITE_SPRITES_EXT=.png
 */
const SPRITES_BASE = (import.meta.env.VITE_SPRITES_BASE || `${import.meta.env.BASE_URL}sprites/`).replace(/\/+$/, '/');
const SPRITES_EXT  = import.meta.env.VITE_SPRITES_EXT || '.png';
const PLACEHOLDER_POKEMON = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 10c-5.5 0-10 4.5-10 10v5h-5c-5.5 0-10 4.5-10 10v30c0 5.5 4.5 10 10 10h5v5c0 5.5 4.5 10 10 10s10-4.5 10-10v-5h5c5.5 0 10-4.5 10-10V35c0-5.5-4.5-10-10-10h-5v-5c0-5.5-4.5-10-10-10z" fill="none" stroke="currentColor" stroke-width="2"/><text x="50" y="55" font-size="40" text-anchor="middle" fill="currentColor">?</text></svg>`)}`;

const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

/* ---------- sprite source helpers & component ---------- */
function localSpriteCandidates(mon){
const id = String(mon?.id||'').trim();
const key = normalizeKey(mon?.name||'');
const bases = [SPRITES_BASE, `${import.meta.env.BASE_URL}sprites/`, `${import.meta.env.BASE_URL}sprites/pokeapi/`, `${import.meta.env.BASE_URL}sprites/national/`];
const exts = [SPRITES_EXT, '.png', '.gif', '.webp'];
const out = [];
for (const b of bases){ for (const e of exts){ if (id) out.push(`${b}${id}${e}`); if (key) out.push(`${b}${key}${e}`); } }
return [...new Set(out)];
}
function spriteSources(mon, opts = {}){
const shiny = !!opts.shiny;
if (!mon) return [];

// Use placeholder for Pokemon with ID >= 650 (Event Pokemon with incorrect sprite data)
if (mon?.id != null && mon.id >= 650) {
  return [PLACEHOLDER_POKEMON];
}

const arr = [];

// Prefer higher-resolution PokeAPI sprites first when we have a canonical dex number
// Our dex id lives on `mon.id` (not `mon.dex`).
if (mon?.id != null) {
  if (shiny) {
    // Shiny front_default (static path)
    arr.push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${mon.id}.png`);
  }
  // Non-shiny default + official artwork
  arr.push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${mon.id}.png`);
  arr.push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${mon.id}.png`);
  }

// Fallbacks to any provided or local sprites
if (!shiny) {
  if (mon.sprite) arr.push(mon.sprite);
  if (mon.sprites?.front_default) arr.push(mon.sprites.front_default);
} else {
  if (mon.sprites?.front_shiny) arr.push(mon.sprites.front_shiny);
  // Some species expose shiny official artwork
  const shinyArt = mon.sprites?.other?.["official-artwork"]?.front_shiny;
  if (shinyArt) arr.push(shinyArt);
}
if (mon.image) arr.push(mon.image);
if (mon.icon) arr.push(mon.icon);
arr.push(...localSpriteCandidates(mon));

return [...new Set(arr)].filter(Boolean);
}
// Build best-guess PokeAPI slugs for alternate forms
function buildPokeApiSlugCandidates(mon){
  const out = [];
  const norm = (s='') => String(s).toLowerCase().normalize('NFKD')
    .replace(/[^\w\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').trim();
  const add = (s) => { if (s && !out.includes(s)) out.push(s); };

  if (!mon) return out;
  add(mon.slug);
  add(norm(mon.name));

  const m = String(mon.name||'').match(/^(.*?)\s*\((.+)\)\s*$/);
  if (m) {
    const base = norm(m[1]);
    const rawLabel = norm(m[2]);
    // direct join
    add(`${base}-${rawLabel}`);
    // strip common suffix words like "form/forme/style/mode/trim"
    let label = rawLabel
      .replace(/\bforms?\b/g,'')
      .replace(/\bformes?\b/g,'')
      .replace(/\bmode\b/g,'')
      .replace(/\bstyle\b/g,'')
      .replace(/\bpattern\b/g,'')
      .replace(/\bcoat\b/g,'')
      .replace(/\bcloak\b/g,'')
      .replace(/\btrim\b/g,'')
      .replace(/\bsize\b/g,'')
      .replace(/\bstandard-?mode\b/g,'standard')
      .replace(/--+/g,'-').replace(/^-|-$/g,'');
    if (label) add(`${base}-${label}`);
    // regional adjective normalization
    let label2 = label
      .replace(/\balolan\b/,'alola')
      .replace(/\bgalarian\b/,'galar')
      .replace(/\bhisuian\b/,'hisui')
      .replace(/\bpaldean\b/,'paldea')
      .replace(/\beast-sea\b/,'east')
      .replace(/\bwest-sea\b/,'west')
      .replace(/--+/g,'-').replace(/^-|-$/g,'');
    if (label2 && label2 !== label) add(`${base}-${label2}`);
    // try also slug-without -form/forme suffix
    if (mon.slug) {
      const s1 = mon.slug.replace(/-forms?\b/,'').replace(/-formes?\b/,'');
      add(s1);
    }
  }
  return out.filter(Boolean);
}

async function resolvePokeapiSprite(mon){
  const candidates = buildPokeApiSlugCandidates(mon);
  // Try pokemon endpoint first
  for (const slug of candidates){
    try {
      const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`);
      if (!r.ok) continue;
      const d = await r.json();
      const s = d?.sprites?.front_default || d?.sprites?.other?.["official-artwork"]?.front_default;
      if (s) return s;
    } catch {}
  }
  // Try pokemon-form endpoint as a fallback for forms that only exist there
  for (const slug of candidates){
    try {
      const r = await fetch(`https://pokeapi.co/api/v2/pokemon-form/${slug}`);
      if (!r.ok) continue;
      const d = await r.json();
      const s = d?.sprites?.front_default;
      if (s) return s;
    } catch {}
  }
  return null;
}
async function resolvePokeapiSpriteShiny(mon){
  const candidates = buildPokeApiSlugCandidates(mon);
  // Try pokemon endpoint first
  for (const slug of candidates){
    try {
      const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`);
      if (!r.ok) continue;
      const d = await r.json();
      const s = d?.sprites?.front_shiny || d?.sprites?.other?.["official-artwork"]?.front_shiny;
      if (s) return s;
    } catch {}
  }
  // Try pokemon-form endpoint
  for (const slug of candidates){
    try {
      const r = await fetch(`https://pokeapi.co/api/v2/pokemon-form/${slug}`);
      if (!r.ok) continue;
      const d = await r.json();
      const s = d?.sprites?.front_shiny;
      if (s) return s;
    } catch {}
  }
  return null;
}
const SPRITE_ANIMATION_CACHE = new Map();

function animationSources(mon, opts = {}){
  const shiny = !!opts.shiny;
  if (!mon) return [];
  const showdownBase = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/';
  const bwBase = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/';
  const suffix = shiny ? 'shiny/' : '';
  const arr = [];

  if (mon?.id != null) {
    arr.push(`${showdownBase}${suffix}${mon.id}.gif`);
    arr.push(`${bwBase}${suffix}${mon.id}.gif`);
  }

  const showdown = mon?.sprites?.other?.showdown;
  if (showdown) {
    const key = shiny ? 'front_shiny' : 'front_default';
    if (showdown[key]) arr.push(showdown[key]);
  }

  const animated = mon?.sprites?.versions?.['generation-v']?.['black-white']?.animated;
  if (animated) {
    const key = shiny ? 'front_shiny' : 'front_default';
    if (animated[key]) arr.push(animated[key]);
  }

  const slugCandidates = buildPokeApiSlugCandidates(mon);
  for (const slug of slugCandidates) {
    arr.push(`${showdownBase}${suffix}${slug}.gif`);
  }

  return [...new Set(arr)].filter(Boolean);
}

async function resolvePokeapiAnimation(mon, opts = {}){
  if (!mon) return null;
  const shiny = !!opts.shiny;
  const candidates = buildPokeApiSlugCandidates(mon);
  for (const slug of candidates){
    try {
      const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`);
      if (!r.ok) continue;
      const d = await r.json();
      const showdown = d?.sprites?.other?.showdown?.[shiny ? 'front_shiny' : 'front_default'];
      if (showdown) return showdown;
      const animated = d?.sprites?.versions?.['generation-v']?.['black-white']?.animated?.[shiny ? 'front_shiny' : 'front_default'];
      if (animated) return animated;
    } catch {}
  }
  return null;
}

function preloadImage(url){
  if (!url) return Promise.reject(new Error('No image URL'));
  if (typeof Image !== 'undefined'){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  }
  if (typeof fetch === 'function'){
    return fetch(url, { method:'GET' }).then(resp => {
      if (!resp.ok) throw new Error('Failed to load image');
      return url;
    });
  }
  return Promise.resolve(url);
}

export { SPRITES_BASE, SPRITES_EXT, PLACEHOLDER_POKEMON, TRANSPARENT_PNG, localSpriteCandidates, spriteSources, buildPokeApiSlugCandidates, resolvePokeapiSprite, resolvePokeapiSpriteShiny, SPRITE_ANIMATION_CACHE, animationSources, resolvePokeapiAnimation, preloadImage };
