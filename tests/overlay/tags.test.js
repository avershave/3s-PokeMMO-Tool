import { buildTags, hasOutline, descendants } from '../../scripts/overlay/tags.js';
const dex = [
  { id: 63, name: 'Abra', abilities: [{name:'Synchronize'},{name:'Inner Focus'},{name:'Magic Guard'}],
    moves: [{name:'Teleport', type:'level'}], evolutions: [{id:64}], yields: { ev_sp_attack: 1 } },
  { id: 64, name: 'Kadabra', abilities: [], moves: [], evolutions: [{id:65}], yields: {} },
  { id: 65, name: 'Alakazam', abilities: [], moves: [], evolutions: [], yields: { ev_sp_attack: 3 } },
  { id: 52, name: 'Meowth', abilities: [{name:'Pickup'},{name:'Technician'},{name:'Unnerve'}],
    moves: [{name:'Pay Day', type:'level'}, {name:'Thief', type:'move_learner_tools'}], evolutions: [], yields: { ev_speed: 1 } },
];
const utilityRules = [{key:'utility.pickup', ability:'Pickup'}, {key:'utility.synchronize', ability:'Synchronize'},
  {key:'utility.payday', levelMove:'Pay Day'}, {key:'utility.thief', levelMove:'Thief'}];
const explanations = Object.fromEntries(['utility.pickup','utility.synchronize','utility.payday','utility.thief','pvp.smogon','ev']
  .map(k => [k, { title: k, summary: k + ' s', body: 'b' }]));
const base = { dex, smogon: { ou: [], uu: ['Alakazam'], ru: [], nu: [] }, utilityRules, explanations,
  story: { entries: [{ id: 65, summary: 'Fast, hits hard', body: 'x' }] }, tips: {} };

test('PvP and Story carry down with via', () => {
  const t = buildTags(base).pokemon[63];
  expect(t.find(x => x.kind === 'pvp')).toMatchObject({ summary: 'Smogon Gen 5 UU', via: 65, viaName: 'Alakazam' });
  expect(t.find(x => x.kind === 'story')).toMatchObject({ via: 65, summary: 'Fast, hits hard' });
});
test('utility from ability and level-up move only, never TM', () => {
  const keys = buildTags(base).pokemon[52].filter(x => x.kind === 'utility').map(x => x.key);
  expect(keys).toEqual(['utility.pickup', 'utility.payday']);
});
test('utility does not carry down', () => {
  expect(buildTags(base).pokemon[65].some(x => x.kind === 'utility')).toBe(false);
});
test('hidden ability is labeled', () => {
  const d = [{ ...dex[3], abilities: [{name:'Technician'},{name:'Technician'},{name:'Pickup'}] }];
  expect(buildTags({ ...base, dex: d }).pokemon[52][0].summary).toMatch(/\(Hidden Ability\)$/);
});
test('EV tag text and outline ignores EV', () => {
  const t = buildTags(base).pokemon[65];
  expect(t.find(x => x.kind === 'ev').summary).toBe('+3 Sp. Atk');
  expect(hasOutline([{ kind: 'ev', key: 'ev', summary: '+1 Spe' }])).toBe(false);
});
test('descendants is transitive and cycle-safe', () => {
  const byId = new Map(dex.map(d => [d.id, d]));
  expect(descendants(byId, 63)).toEqual([64, 65]);
});
test('every utility rule and pvp/ev has an explanation (real content files)', async () => {
  const rules = (await import('../../tags/utility-rules.json')).default;
  const ex = (await import('../../tags/explanations.json')).default;
  for (const k of [...rules.map(r => r.key), 'pvp.smogon', 'ev']) expect(ex[k]?.summary).toBeTruthy();
  for (const v of Object.values(ex)) expect(v.summary.split(/\s+/).length).toBeLessThanOrEqual(5);
});

// Additional coverage
test('descendants survives a cycle', () => {
  const byId = new Map([[1, { id: 1, evolutions: [{id:2}] }], [2, { id: 2, evolutions: [{id:1}] }]]);
  expect(descendants(byId, 1)).toEqual([2]);
});
test('tag order is pvp, story, utility, ev', () => {
  const kinds = buildTags(base).pokemon[63].map(t => t.kind);
  expect(kinds).toEqual(['pvp', 'story', 'utility', 'ev']);
});
test('multi-EV label and zero-EV omission', () => {
  const d = [{ id: 1, name: 'X', abilities: [], moves: [], evolutions: [], yields: { ev_hp: 1, ev_sp_defense: 1 } },
             { id: 2, name: 'Y', abilities: [], moves: [], evolutions: [], yields: { ev_hp: 0 } }];
  const p = buildTags({ ...base, dex: d, smogon: {}, story: { entries: [] } }).pokemon;
  expect(p[1].find(t => t.kind === 'ev').summary).toBe('+1 HP, +1 Sp. Def');
  expect(p[2].some(t => t.kind === 'ev')).toBe(false);
});
test('own pvp beats descendant; highest-tier descendant otherwise', () => {
  const d = [
    { id: 1, name: 'A', abilities: [], moves: [], evolutions: [{id:2},{id:3}], yields: {} },
    { id: 2, name: 'B', abilities: [], moves: [], evolutions: [], yields: {} },
    { id: 3, name: 'C', abilities: [], moves: [], evolutions: [], yields: {} },
  ];
  let p = buildTags({ ...base, dex: d, smogon: { ou: ['C'], uu: ['B'] }, story: { entries: [] } }).pokemon;
  expect(p[1].find(t => t.kind === 'pvp')).toMatchObject({ summary: 'Smogon Gen 5 OU', via: 3, viaName: 'C' });
  p = buildTags({ ...base, dex: d, smogon: { ou: ['A'], uu: ['B'] }, story: { entries: [] } }).pokemon;
  expect(p[1].find(t => t.kind === 'pvp').via).toBeUndefined();
});
test('smogon names match punctuation-insensitively; unmatched are warned', () => {
  const d = [{ id: 1, name: "Mr. Mime", abilities: [], moves: [], evolutions: [], yields: {} }];
  const r = buildTags({ ...base, dex: d, smogon: { ou: ['Mr. Mime', 'Missingno'] }, story: { entries: [] } });
  expect(r.pokemon[1].find(t => t.kind === 'pvp')).toBeTruthy();
  expect(r.warnings.some(w => w.includes('Missingno'))).toBe(true);
});
test('compound eyes rule matches dex spelling Compoundeyes', () => {
  const d = [{ id: 1, name: 'V', abilities: [{name:'Compoundeyes'},{name:'Compoundeyes'},{name:'Tinted Lens'}], moves: [], evolutions: [], yields: {} }];
  const rules = [{ key: 'utility.compoundeyes', ability: 'Compound Eyes' }];
  const ex = { ...explanations, 'utility.compoundeyes': { title: 't', summary: 'Rare item lead', body: 'b' } };
  const r = buildTags({ ...base, dex: d, utilityRules: rules, explanations: ex, smogon: {}, story: { entries: [] } });
  expect(r.pokemon[1][0].key).toBe('utility.compoundeyes');
});
test('real dex data builds with real content', async () => {
  const { DEX_LIST } = await import('../../src/lib/dex.js');
  const rules = (await import('../../tags/utility-rules.json')).default;
  const explanations = (await import('../../tags/explanations.json')).default;
  const smogon = (await import('../../tags/smogon-gen5.json')).default;
  const story = (await import('../../tags/story.json')).default;
  const tips = (await import('../../tags/tips.json')).default;
  const r = buildTags({ dex: DEX_LIST, smogon, utilityRules: rules, explanations, story, tips });
  expect(r.warnings).toEqual(expect.any(Array));
  expect(r.pokemon[63].some(t => t.key === 'utility.synchronize')).toBe(true);
  expect(r.pokemon[65].find(t => t.kind === 'pvp')).toBeTruthy();
});
