/* ---------- Sidebar navigation model ---------- */
// Mode items switch the App `mode`. Action items run a side effect instead
// and never show as active.
export const NAV_GROUPS = [
  {
    id: 'live', label: 'Live', requiresOcr: true,
    items: [
      { id: 'battle', label: 'Battle', mode: 'battle' },
      { id: 'live', label: 'Route', mode: 'live' },
    ],
  },
  {
    id: 'lookup', label: 'Look up',
    items: [
      { id: 'pokemon', label: 'Pokémon', mode: 'pokemon' },
      { id: 'areas', label: 'Areas', mode: 'areas' },
      { id: 'horde', label: 'Hordes', mode: 'horde' },
      { id: 'tm', label: 'TMs', mode: 'tm' },
    ],
  },
  {
    id: 'dex', label: 'My dex',
    items: [
      { id: 'dex-caught', label: 'Pokédex', action: 'open-dex', dex: 'caught' },
      { id: 'dex-alpha', label: 'Alpha Dex', action: 'open-dex', dex: 'alpha' },
      { id: 'dex-event', label: 'Event Dex', action: 'open-dex', dex: 'event' },
      { id: 'dex-shiny', label: 'Shiny Dex', action: 'open-dex', dex: 'shiny' },
    ],
  },
  {
    id: 'tools', label: 'Tools',
    items: [
      { id: 'team', label: 'Team Builder', mode: 'team' },
      { id: 'items', label: 'Items', mode: 'items' },
      { id: 'breeding', label: 'Breeding', mode: 'breeding' },
      { id: 'daycare', label: 'Daycare', mode: 'daycare' },
      { id: 'market', label: 'Market', mode: 'market' },
      { id: 'type-chart', label: 'Type chart', action: 'type-chart' },
    ],
  },
];

export const DEFAULT_MODE = 'pokemon';

export function visibleGroups({ ocrSupported }) {
  return NAV_GROUPS.filter((g) => !g.requiresOcr || ocrSupported);
}

export function isItemActive(item, mode) {
  return item.action === undefined && item.mode === mode;
}

// Ask the matching dex window (caught, alpha, event, shiny) to open itself.
export function openDex(dex) {
  window.dispatchEvent(new CustomEvent('open-dex', { detail: { dex } }));
}
