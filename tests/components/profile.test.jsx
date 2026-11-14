// @vitest-environment jsdom
import { render, screen, fireEvent, within } from '@testing-library/react';
import PokemonProfile from '../../src/pages/PokemonProfile.jsx';
import { headerBackground } from '../../src/lib/typeColors.js';

// Ability descriptions and sprites load from PokeAPI; keep the tests off the network.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })));
});
afterEach(() => { vi.unstubAllGlobals(); });

const snubbull = { id:209, name:'snubbull', types:['normal'], expType:'slow', eggGroups:['field','fairy'],
  height:6, weight:78, genderRatio:75, obtainable:true, catchRate:190, yields:{ ev_attack:1 },
  abilities:[{name:'Intimidate'},{name:'Run Away'},{name:'Rattled'}], heldItems:[],
  stats:{ hp:60, attack:80, defense:50, sp_attack:40, sp_defense:40, speed:30 },
  weakness:{ x4:[], x2:['fighting'], x0_5:[], x0_25:[], x0:['ghost'] }, moves:{} };
const base = { spriteMon: snubbull, caught:{ isCaught:false, toggle(){} }, alpha:{ eligible:false, isCaught:false, toggle(){} },
  shiny:{ on:false, toggle(){} }, build:{ value:{}, set(){}, override:null, underline:new Set(), setters:{}, natureList:[] },
  catchInfo:{ ballKey:'poke', setBallKey(){}, percent:24.7, oneHp:false, setOneHp(){}, status:null, toggleStatus(){} },
  locations:[], onClose(){}, onTypeClick(){}, onSelectMon(){}, onOpenArea(){} };

test('header shows the name, number and type colour', () => {
  const { container } = render(<PokemonProfile {...base} mon={snubbull} onCompare={() => {}} />);
  // The evolution chain also names Snubbull, so look inside the header.
  const header = within(container.querySelector('[data-part="profile-header"]'));
  expect(header.getByText('Snubbull')).toBeTruthy();
  expect(header.getByText('#209')).toBeTruthy();
  expect(container.querySelector('[data-part="profile-header"]').style.background).toContain('linear-gradient');
  expect(headerBackground(['normal'])).toContain('linear-gradient');
});
test('abilities are labelled 1, 2 and Hidden', () => {
  render(<PokemonProfile {...base} mon={snubbull} onCompare={() => {}} />);
  expect(screen.getByText('Intimidate')).toBeTruthy();
  expect(screen.getByText('Hidden')).toBeTruthy();
});
test('compare and close call back', () => {
  const onCompare = vi.fn(), onClose = vi.fn();
  render(<PokemonProfile {...base} mon={snubbull} onCompare={onCompare} onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
  fireEvent.click(screen.getByRole('button', { name: /close profile/i }));
  expect(onCompare).toHaveBeenCalled(); expect(onClose).toHaveBeenCalled();
});
test('missing data shows placeholders, not crashes', () => {
  const bare = { id:700, name:'mystery', types:[], abilities:[], heldItems:[], catchRate:null, yields:{},
    weakness:{}, moves:{}, stats:{ hp:1, attack:1, defense:1, sp_attack:1, sp_defense:1, speed:1 } };
  const { container } = render(<PokemonProfile {...base} mon={bare} spriteMon={bare}
    catchInfo={{ ...base.catchInfo, percent:null }} onCompare={() => {}} />);
  expect(container.textContent).not.toMatch(/undefined|null|NaN/);
  expect(screen.getAllByText(/None|—/).length).toBeGreaterThan(0);
});
