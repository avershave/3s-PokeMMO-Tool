# Desktop Redesign, Stage 1 (Shell and Pokémon Profile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scattered buttons and pill navigation with the style C sidebar shell, retire the 11 themes, and rebuild the Pokémon profile page in style C.

**Architecture:**
- **Style:** colours and fonts live once, as CSS variables in `src/styles/tokens.css`. The old theme variables (`--bg`, `--surface`, …) are re-pointed at style C values, so screens not yet restyled take on the new palette straight away.
- **Shell:** a new `AppShell` (sidebar + main area) wraps the existing `mode`-based screen switching in `App.jsx`. The sidebar is driven by a pure navigation model (`src/lib/nav.js`).
- **Profile:** the profile page moves out of `App.jsx` into `src/pages/PokemonProfile.jsx`. Its shared leaf components move into `src/components/pokemon/`.

**Tech Stack:** Electron, React 19 (React Compiler on), Vite 8, Vitest, @testing-library/react + jsdom (new, for component tests), @fontsource packages (new, offline fonts).

**Spec:** `docs/superpowers/specs/2026-11-13-desktop-redesign-design.md`. This plan covers spec stage 1 only: shell, Settings, live status, tokens, shared components and the Pokémon profile. Stages 2–4 get their own plans.

## Global Constraints

- **Base branch:** `desktop-redesign` (built on `desktop-compiler-trim`).
- **React Compiler is on.** Follow the rules of hooks: no hook after an early return.
- **Commits:** plain messages, no Co-Authored-By lines. Push to `avershave/3s-PokeMMO-Tool`, PR against `main` (at the end of the stage, not per task).
- **CI** (`ci.yml`) must pass: `npm test`, `npm run build`.
- **Palette** (spec): bg `#23262D`, sidebar `#1C1F25`, surface `#2C3038`, line `#353A44`, text `#E9EAEE`, muted `#8A8F9C`, live `#7BD88F`.
- **Type** (spec): Bricolage Grotesque 800 (big names), 500 (headings); Barlow 400/600 (body); Barlow Semi Condensed 500/600 (numbers, facts). Bundled locally, no Google Fonts request.
- **Sprites** use `image-rendering: pixelated`.
- **Themes are retired:** no `theme-*` classes, no Theme button. Ignore the saved `theme` localStorage value. `colorConfig.js` (method/rarity colours) stays.
- **Behaviour:** no screen loses a feature. Only placement and look change in this stage.
- **Copy:** sentence case, plain verbs. Sidebar labels exactly as in Task 4.

## Review Focus

1. **Narrow window** (the app docked beside the game, about 600–900 px wide, and also with Options → UI scale changed): the sidebar collapses behind a menu button, and nothing scrolls sideways. jsdom doesn't evaluate media queries, so this is checked by screenshots at 760 px in Task 7 Step 5, Task 8 Step 6 and Task 9 Step 2.
2. **OCR unsupported (Linux) or disabled in Options:** no Live group and no live status. The app opens on Pokémon search, not a blank page. *(Task 4 and Task 6 tests)*
3. **An old saved theme** (`localStorage.theme = 'white'`) from a previous version: the app still renders style C, and no `theme-*` class is added to `<html>`/`<body>`. *(Task 1 test)*
4. **Light type colours** (Electric `#F7D02C`, Ice `#96D9D6`, Ground `#E2BF65`) behind the white name text: the header stays readable, at contrast ≥ 3:1 against `#FFFFFF`. *(Task 2 test)*
5. **A Pokémon with missing data** (no abilities, no held items, `catchRate` null, no evolutions, an event ID ≥ 650): the profile shows "None" or "—" and doesn't crash. *(Task 8 test)*

---

### Task 1: Style C tokens, bundled fonts, themes retired

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/index.css:1-420` (the `:root` / `html.theme-*` blocks), `src/main.jsx`, `src/App.jsx:4105-4112` (theme state and effect), `src/App.jsx:4359-4370` (`headerSprite` theme branches), `src/App.jsx:6292` (`<ThemeButton>`), and the `ThemeButton` import
- Delete: `src/components/ThemeButton.jsx`
- Modify: `package.json` (add `@fontsource/bricolage-grotesque`, `@fontsource/barlow`, `@fontsource/barlow-semi-condensed`)
- Test: `tests/styles/tokens.test.js`

**Interfaces:**
- Produces these CSS variables on `:root`, used by every later task:
  - **Colour:** `--c-bg`, `--c-sidebar`, `--c-surface`, `--c-line`, `--c-text`, `--c-muted`, `--c-live`
  - **Font families:** `--f-display` (Bricolage Grotesque), `--f-body` (Barlow), `--f-num` (Barlow Semi Condensed)
- **Legacy variables** keep their names and point at style C:

  | Legacy | Value |
  |---|---|
  | `--bg` | `var(--c-bg)` |
  | `--card` | `var(--c-surface)` |
  | `--card-dark` | `var(--c-sidebar)` |
  | `--surface` | `var(--c-surface)` |
  | `--text` | `var(--c-text)` |
  | `--muted` | `var(--c-muted)` |
  | `--divider` | `var(--c-line)` |
  | `--accent` | `#C9C78F` |
  | `--accent-contrast` | `#1C1F25` |

  Every other variable in the old `:root` block keeps its current value. `--profile-hero-accent-*` stays until Task 8 removes its last use.

- [ ] **Step 1: Write the failing test**

```js
// tests/styles/tokens.test.js
import { readFileSync } from 'node:fs';
const css = readFileSync('src/index.css', 'utf8') + readFileSync('src/styles/tokens.css', 'utf8');
const app = readFileSync('src/App.jsx', 'utf8');

test('no theme selectors remain', () => { expect(css).not.toMatch(/\.theme-[a-z]+/); });
test('style C palette is defined', () => {
  for (const [k, v] of Object.entries({ '--c-bg':'#23262D', '--c-sidebar':'#1C1F25', '--c-surface':'#2C3038',
    '--c-line':'#353A44', '--c-text':'#E9EAEE', '--c-muted':'#8A8F9C', '--c-live':'#7BD88F' }))
    expect(css).toMatch(new RegExp(`${k}:\\s*${v}`, 'i'));
});
test('legacy variables point at style C', () => {
  expect(css).toMatch(/--bg:\s*var\(--c-bg\)/);
  expect(css).toMatch(/--divider:\s*var\(--c-line\)/);
});
test('the app no longer applies or offers themes', () => {
  expect(app).not.toMatch(/ThemeButton|theme-\$\{|classList\.add\(`theme-/);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/styles/tokens.test.js`
Expected: FAIL (no `src/styles/tokens.css`).

- [ ] **Step 3: Implement**
  - **tokens.css:** the `--c-*` and `--f-*` variables.
  - **index.css:** replace the theme blocks with a single `:root` block, using the legacy mapping above, and import `./styles/tokens.css` at the top. Body: `font-family: var(--f-body); background: var(--c-bg); color: var(--c-text)`.
  - **main.jsx:** import the font weights listed in Global Constraints.
  - **App.jsx:**
    - Remove the theme state and effect and the `ThemeButton` render.
    - `headerSprite` keeps only its random-sprite fallback.
    - Delete `ThemeButton.jsx`.

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: all pass, and the build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A src/styles src/index.css src/main.jsx src/App.jsx src/components/ThemeButton.jsx package.json package-lock.json tests/styles
git commit -m "Retire themes; add style C tokens and bundled fonts"
```

---

### Task 2: Type colours module with readable header backgrounds

**Files:**
- Create: `src/lib/typeColors.js`
- Modify: `src/App.jsx:960-966` (`TYPE_COLORS` moves out and is imported back)
- Test: `tests/lib/typeColors.test.js`

**Interfaces:**
- `TYPE_COLORS`: the existing 17-type map, moved verbatim (no Fairy, Gen 5).
- `contrastRatio(hexA: string, hexB: string): number`: WCAG 2 relative-luminance contrast.
- `headerStops(types: string[]): [string, string]`: two hex colours for the profile header gradient.
  - **One type:** `[c, shade(c)]`.
  - **Two types:** `[c1, c2]`.
  - **Empty or unknown:** `['#3A3F4A', '#2C3038']`.
  - **Contrast:** each stop is darkened in 5% steps until `contrastRatio('#FFFFFF', stop) >= 3`.
- `headerBackground(types: string[]): string`: `linear-gradient(90deg, ${a} 0%, ${b} 100%)`.

- [ ] **Step 1: Write the failing test**

```js
import { TYPE_COLORS, contrastRatio, headerStops, headerBackground } from '../../src/lib/typeColors.js';
test('contrast ratio matches WCAG', () => {
  expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
  expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
});
test('every type header keeps white text readable', () => {
  for (const t of Object.keys(TYPE_COLORS))
    for (const s of headerStops([t])) expect(contrastRatio('#FFFFFF', s)).toBeGreaterThanOrEqual(3);
});
test('dual types blend both colours', () => {
  const [a, b] = headerStops(['fire', 'flying']);
  expect(a).not.toBe(b);
});
test('unknown types fall back to neutral', () => {
  expect(headerStops([])).toEqual(['#3A3F4A', '#2C3038']);
  expect(headerStops(['???'])).toEqual(['#3A3F4A', '#2C3038']);
});
test('type names are case-insensitive', () => {
  expect(headerStops(['Normal'])).toEqual(headerStops(['normal']));
});
test('headerBackground is a left-to-right gradient', () => {
  expect(headerBackground(['water'])).toMatch(/^linear-gradient\(90deg, #[0-9a-f]{6} 0%, #[0-9a-f]{6} 100%\)$/i);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/lib/typeColors.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** the four exports. `shade(c)` darkens by 20%. Hex output is lowercase `#rrggbb`. App.jsx imports `TYPE_COLORS` from the new module.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/typeColors.js src/App.jsx tests/lib/typeColors.test.js
git commit -m "Move type colours to a module with readable header gradients"
```

---

### Task 3: Live clients module

**Files:**
- Create: `src/lib/liveClients.js`
- Modify: `src/App.jsx:2774-2920` (the `LiveRouteClient` and `LiveBattleClient` classes and the `liveRouteClient` / `liveBattleClient` singletons move out verbatim; App.jsx imports them)
- Test: `tests/lib/liveClients.test.js`

**Interfaces:**
- **Exports:** `liveRouteClient` and `liveBattleClient`. Same objects and methods as today: `on(fn) => unsubscribe`, `isOpen(): boolean`, `lastMsgTs: number`, `lastPayload`, `setEnabled(bool)`, `forceReconnect()`.
- Task 6's `LiveStatus` consumes `liveRouteClient`.

- [ ] **Step 1: Write the failing test**

```js
import { liveRouteClient, liveBattleClient } from '../../src/lib/liveClients.js';
test('clients expose the subscription API', () => {
  for (const c of [liveRouteClient, liveBattleClient]) {
    const off = c.on(() => {});
    expect(typeof off).toBe('function');
    expect(typeof c.isOpen()).toBe('boolean');
    off();
  }
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/lib/liveClients.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Move the classes and singletons.** If they reference App-module helpers, move those helpers with them or import them. The test must not open a socket that keeps Vitest alive: either connect lazily on the first `on()`, or call `setEnabled(false)` in an `afterAll`.

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/liveClients.js src/App.jsx tests/lib/liveClients.test.js
git commit -m "Move live OCR clients into their own module"
```

---

### Task 4: Navigation model

**Files:**
- Create: `src/lib/nav.js`
- Test: `tests/lib/nav.test.js`

**Interfaces:**
- `NAV_GROUPS: Array<{ id, label, requiresOcr?: boolean, items: NavItem[] }>`
- `NavItem` is one of:
  - `{ id, label, mode }`: switches the App `mode`
  - `{ id, label, action: 'open-dex', dex: 'caught'|'alpha'|'event'|'shiny' }`
  - `{ id, label, action: 'type-chart' }`
- **The groups, in order, with exact labels:**
  - **Live** (`requiresOcr: true`): Battle → `battle`; Route → `live`
  - **Look up:** Pokémon → `pokemon`; Areas → `areas`; Hordes → `horde`; TMs → `tm`
  - **My dex:** Pokédex → `caught`; Alpha Dex → `alpha`; Event Dex → `event`; Shiny Dex → `shiny`
  - **Tools:** Team Builder → `team`; Items → `items`; Breeding → `breeding`; Daycare → `daycare`; Market → `market`; Type chart → action `type-chart`
- `visibleGroups({ ocrSupported: boolean }): NAV_GROUPS` filtered.
- `isItemActive(item: NavItem, mode: string): boolean`.
- `DEFAULT_MODE = 'pokemon'`.

- [ ] **Step 1: Write the failing test**

```js
import { NAV_GROUPS, visibleGroups, isItemActive, DEFAULT_MODE } from '../../src/lib/nav.js';
const APP_MODES = ['pokemon','areas','horde','tm','items','breeding','daycare','team','live','battle','market'];
test('every app mode has a sidebar entry', () => {
  const modes = NAV_GROUPS.flatMap(g => g.items).map(i => i.mode).filter(Boolean);
  expect(new Set(modes)).toEqual(new Set(APP_MODES));
});
test('live group is hidden without OCR', () => {
  expect(visibleGroups({ ocrSupported:false }).map(g => g.id)).not.toContain('live');
  expect(visibleGroups({ ocrSupported:true })[0].id).toBe('live');
});
test('labels match the design', () => {
  expect(NAV_GROUPS.map(g => g.label)).toEqual(['Live','Look up','My dex','Tools']);
  expect(NAV_GROUPS[1].items.map(i => i.label)).toEqual(['Pokémon','Areas','Hordes','TMs']);
});
test('active state follows mode', () => {
  const pokemon = NAV_GROUPS[1].items[0];
  expect(isItemActive(pokemon, 'pokemon')).toBe(true);
  expect(isItemActive(pokemon, 'areas')).toBe(false);
  expect(isItemActive(NAV_GROUPS[2].items[0], 'pokemon')).toBe(false);
});
test('app opens on Pokémon search', () => { expect(DEFAULT_MODE).toBe('pokemon'); });
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/lib/nav.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/lib/nav.js` as specified.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nav.js tests/lib/nav.test.js
git commit -m "Add sidebar navigation model"
```

---

### Task 5: Dex windows open without their own buttons

**Files:**
- Modify: `src/components/CaughtListButton.jsx`, `AlphaDexButton.jsx`, `EventDexButton.jsx`, `ShinyDexButton.jsx`
- Modify: `package.json` (devDependencies `jsdom`, `@testing-library/react`), `vitest.config.js`
- Test: `tests/components/dexOpen.test.jsx`

**Interfaces:**
- Each dex component takes `renderTrigger = true`. When it's false, the component renders no trigger button, only its window when open. This matches `ColorPickerButton`'s existing prop.
- Each listens for `window` event `open-dex` with `detail.dex` equal to its key (`caught`, `alpha`, `event`, `shiny`) and opens itself.
- **Exported helper** from `src/lib/nav.js`: `openDex(dex)` dispatches `new CustomEvent('open-dex', { detail: { dex } })`.
- **Vitest config:**
  - `include: ['tests/**/*.test.{js,jsx}']`
  - `plugins: [react()]` from `@vitejs/plugin-react`
  - Component tests start with `// @vitest-environment jsdom`.

- [ ] **Step 1: Write the failing test**

```jsx
// @vitest-environment jsdom
import { render, screen, act } from '@testing-library/react';
import AlphaDexButton from '../../src/components/AlphaDexButton.jsx';
import CaughtListButton from '../../src/components/CaughtListButton.jsx';
import { openDex } from '../../src/lib/nav.js';

test('hidden trigger renders no button', () => {
  render(<AlphaDexButton renderTrigger={false} />);
  expect(screen.queryByRole('button', { name: /alpha dex/i })).toBeNull();
});
test('open-dex opens only the matching window', () => {
  render(<><AlphaDexButton renderTrigger={false} /><CaughtListButton renderTrigger={false} /></>);
  act(() => openDex('alpha'));
  expect(screen.getByText('Alpha Dex')).toBeTruthy();
  expect(screen.queryByText(/Total caught/i)).toBeNull();
});
```

Wrap the components in the providers they need (`CaughtContext`, `AlphaCaughtContext`, …) with in-memory values if they throw without them.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/components/dexOpen.test.jsx`
Expected: FAIL (the trigger renders, and `openDex` isn't exported).

- [ ] **Step 3: Implement** the prop, the event listener (added in a `useEffect`, removed on unmount) and `openDex`.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/*DexButton.jsx src/components/CaughtListButton.jsx src/lib/nav.js vitest.config.js package.json package-lock.json tests/components
git commit -m "Let dex windows open from outside their own buttons"
```

---

### Task 6: Sidebar shell, live status and Settings footer

**Files:**
- Create: `src/components/shell/AppShell.jsx`, `src/components/shell/Sidebar.jsx`, `src/components/shell/LiveStatus.jsx`, `src/components/shell/shell.css`
- Modify: `src/components/PatchNotesButton.jsx`, `OptionsMenu.jsx`, `SponsorButton.jsx`, `FeedbackButton.jsx`, `VersionBadge.jsx` (add `variant`)
- Test: `tests/components/shell.test.jsx`

**Interfaces:**
- `AppShell({ mode, onNavigate(mode), onAction(item), ocrSupported, ocrEnabled, onOpenLive(), children })`: the sidebar on the left, `children` in a scrolling main area.
- `Sidebar` (same props minus `children`):
  - Logo "3's PokeMMO Tool" at the top.
  - `visibleGroups({ ocrSupported: ocrSupported && ocrEnabled })`.
  - Clicking a `mode` item calls `onNavigate(item.mode)`. An `action` item calls `onAction(item)`.
  - The active row has `aria-current="page"`.
  - **Bottom:** `LiveStatus` (only when OCR is supported and enabled), then a Settings group: Options, Patch notes, Resources, Sponsor, Feedback, and the version.
- `LiveStatus({ client = liveRouteClient, onOpen })`: subscribes to `client`, polls `client.isOpen()` every 1000 ms, and shows:
  - **Not open:** "Helper not connected"
  - **Open with a route:** "Reading PokeMMO" with the route text below. The route is the `text` (or `route`) field of the last message, trimmed, ignoring `NO_ROUTE` / empty.
  - **Open, no route:** "Reading PokeMMO" / "No route detected"
  - Clicking it calls `onOpen`.
- `variant="sidebar"` on the five footer components:
  - The trigger renders as a full-width sidebar row instead of a fixed-position button.
  - Windows and modals stay as they are.
  - OptionsMenu's dropdown opens upward and to the right of the sidebar.
  - The default `variant` keeps today's rendering.
- **Narrow layout:** below 900 px of viewport width, the sidebar hides behind a menu button at the top-left of the main area, and opens as an overlay. Choosing an item closes it.
- **Styling:**
  - Sidebar background `var(--c-sidebar)`, width 200 px.
  - Group labels 12 px in `var(--c-muted)`, sentence case.
  - Rows 14 px, 6 px × 18 px padding.
  - The active row gets a 3 px left border in `var(--accent)` and background `var(--c-surface)`. The live dot uses `var(--c-live)`.

- [ ] **Step 1: Write the failing test**

```jsx
// @vitest-environment jsdom
import { render, screen, fireEvent, act } from '@testing-library/react';
import AppShell from '../../src/components/shell/AppShell.jsx';
import LiveStatus from '../../src/components/shell/LiveStatus.jsx';

const fakeClient = (open, msg) => { let fn; return { isOpen: () => open, on: f => { fn = f; return () => {}; }, emit: () => fn?.(msg) }; };

test('navigates by mode and marks the active row', () => {
  const onNavigate = vi.fn();
  render(<AppShell mode="pokemon" onNavigate={onNavigate} onAction={() => {}} ocrSupported ocrEnabled><p>page</p></AppShell>);
  expect(screen.getByRole('button', { name: 'Pokémon' }).getAttribute('aria-current')).toBe('page');
  fireEvent.click(screen.getByRole('button', { name: 'Areas' }));
  expect(onNavigate).toHaveBeenCalledWith('areas');
});
test('dex and type chart go through onAction', () => {
  const onAction = vi.fn();
  render(<AppShell mode="pokemon" onNavigate={() => {}} onAction={onAction} ocrSupported={false}><p /></AppShell>);
  fireEvent.click(screen.getByRole('button', { name: 'Type chart' }));
  expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'type-chart' }));
});
test('no live group or status without OCR', () => {
  render(<AppShell mode="pokemon" onNavigate={() => {}} onAction={() => {}} ocrSupported={false}><p /></AppShell>);
  expect(screen.queryByText('Battle')).toBeNull();
  expect(screen.queryByText(/Reading PokeMMO|Helper not connected/)).toBeNull();
});
test('live status reflects the helper', () => {
  const c = fakeClient(true, { type: 'route', text: 'Route 35' });
  render(<LiveStatus client={c} onOpen={() => {}} />);
  act(() => c.emit());
  expect(screen.getByText('Reading PokeMMO')).toBeTruthy();
  expect(screen.getByText('Route 35')).toBeTruthy();
});
test('live status when the helper is down', () => {
  render(<LiveStatus client={fakeClient(false)} onOpen={() => {}} />);
  expect(screen.getByText('Helper not connected')).toBeTruthy();
});
test('settings group holds the moved buttons', () => {
  render(<AppShell mode="pokemon" onNavigate={() => {}} onAction={() => {}} ocrSupported={false}><p /></AppShell>);
  for (const name of ['Options', 'Patch notes', 'Resources', 'Sponsor', 'Feedback'])
    expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toBeTruthy();
});
```

Resources is a sidebar row that calls `onAction({ id: 'resources', action: 'resources' })`. App.jsx opens `ResourcesOverlay` from it in Task 7.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/components/shell.test.jsx`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement** the shell components, `shell.css` and the `variant` props.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/shell src/components/PatchNotesButton.jsx src/components/OptionsMenu.jsx src/components/SponsorButton.jsx src/components/FeedbackButton.jsx src/components/VersionBadge.jsx tests/components/shell.test.jsx
git commit -m "Add sidebar shell with live status and settings footer"
```

---

### Task 7: Put the app inside the shell

**Files:**
- Modify: `src/App.jsx`:
  - `4074`: `mode` defaults to `DEFAULT_MODE`
  - `4098-4101`: resources no longer sets mode `'home'`
  - `4877-4892`: the fixed top-right and top-centre bars
  - `4916-4974`: the HomeScreen branch, header and segmented nav
  - `6290-6296`: the bottom buttons
- Delete: `src/components/HomeScreen.jsx`
- Test: `tests/components/appShell.test.jsx`

**Interfaces:**
- **Consumes:**
  - `AppShell` (Task 6)
  - `openDex` and `DEFAULT_MODE` (Tasks 4–5)
  - dex components with `renderTrigger={false}` (Task 5)
- **`onAction` in App:**
  - `open-dex` → `openDex(item.dex)`
  - `type-chart` → `setShowTypeChart(true)`
  - `resources` → `setShowResources(true)`
- **What stays where it is:**
  - The search card (filters and search box) stays at the top of the main area for `pokemon`, `areas` and `tm`, minus the segmented buttons, Resources button and Live buttons it held.
  - The Linux "Live route tracking is unavailable" note stays.
  - The "Up to date" toast stays.
- **`ocrEnabled`** for the shell comes from `isOcrEnabled()`, kept current by the existing `ocr-enabled-changed` event. When OCR turns off while `mode` is `live` or `battle`, switch to `DEFAULT_MODE`. This extends the existing `!ocrSupported && mode === 'live'` rule at line 4206 to both live modes and to OCR being disabled.

- [ ] **Step 1: Write the failing test**

```jsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import App from '../../src/App.jsx';
test('app opens on Pokémon search inside the sidebar shell', () => {
  localStorage.setItem('theme', 'white');
  render(<App />);
  expect(screen.getByRole('button', { name: 'Pokémon' }).getAttribute('aria-current')).toBe('page');
  expect(document.documentElement.className).not.toMatch(/theme-/);
  expect(document.body.className).not.toMatch(/theme-/);
  expect(screen.queryByText('Pokemon Search')).toBeNull(); // old segmented button gone
});
```

If `App` needs browser APIs jsdom lacks (`window.app` bridge, `matchMedia`, image loading), stub them in a `tests/setup/jsdom.js` registered as `setupFiles` for jsdom tests. Don't change App behaviour to suit the test.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/components/appShell.test.jsx`
Expected: FAIL (old layout, no sidebar).

- [ ] **Step 3: Implement** the changes listed under Files and Interfaces.

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 5: Look at it**

Launch the app with `npm run electron:dev` (needs `DOTNET_ROOT` and `PATH` set to `%LOCALAPPDATA%\Programs\dotnet10`), then capture screenshots at 1440×920 and 760×920. One way: start it with `--remote-debugging-port=9333` and run `Page.captureScreenshot` over CDP.

Check:
- nothing pinned to the window edges
- every sidebar item opens its screen or window
- the narrow layout shows the menu button with no sideways scroll

- [ ] **Step 6: Commit**

```bash
git add -A src/App.jsx src/components/HomeScreen.jsx tests/components/appShell.test.jsx tests/setup vitest.config.js
git commit -m "Move the app into the sidebar shell; drop the home screen and edge buttons"
```

---

### Task 8: Pokémon profile page in style C

**Files:**
- Create: `src/components/pokemon/`, one file per component, moved verbatim from `App.jsx` with their module-level dependencies: `TypePill`, `AbilityPill` (with `useAbilityDesc`), `StatsRow`, `NatureSelect`, `EvolutionChain`, `MovesTable` (with `MoveRow`, `CategoryPill`), `MethodPill`, `RarityPill`, `BallSelect`, `DelayedTooltip`, `PokeballIcon`, `Sprite` (`App.jsx:811`). Shared constants and helpers they need (`ITEM_INDEX`, `ITEM_ICON_BASE`, `titleCase`, `formatHeight`, …) go to `src/lib/` modules. App.jsx imports everything back.
- Create: `src/pages/PokemonProfile.jsx`, `src/pages/profile.css`
- Modify: `src/App.jsx:5769-6179` (the profile block becomes `<PokemonProfile … />`); `src/index.css` (delete the `profile-*` rules and `--profile-hero-accent-*` once unused)
- Test: `tests/components/profile.test.jsx`

**Interfaces:**

```
PokemonProfile({
  mon,                    // the `resolved` object App builds today
  spriteMon,              // App's `selected`
  caught: { isCaught: bool, toggle() },
  alpha:  { eligible: bool, isCaught: bool, toggle() },
  shiny:  { on: bool, toggle() },
  build:  { value, set, override, underline, setters, natureList },
  catchInfo: { ballKey, setBallKey, percent: number|null, oneHp: bool, setOneHp, status, toggleStatus },
  locations,              // App's `byRegion`
  onClose(), onCompare(), onTypeClick(type), onSelectMon(mon), onOpenArea(region, mapName)
})
```

- App renders it with `key={mon.id}`. The Locations, Recommended sets and Moves open/closed state moves inside the component, so it resets per Pokémon. That replaces App's `setShowSmogonSets(false); setShowMoveset(false)` on evolution select.
- **Layout** (mockup `direction.html` option C):
  - **Header:**
    - Background `headerBackground(mon.types)` (Task 2).
    - Sprite 96 px, pixelated, with the shiny toggle.
    - Name in `var(--f-display)` 800, 44 px. `#209` in `var(--f-num)`.
    - Type chips: `rgba(0,0,0,.22)` pill, clicking calls `onTypeClick`.
    - Facts grid in `var(--f-num)`: Egg group, Catch rate, EV yield, Gender, Exp, Height, Weight, Obtainable.
    - Actions on the right: Compare, caught ball, alpha (only when `alpha.eligible`), close (×).
  - **Body:** two columns, collapsing to one below 900 px.
    - **Left:** Base stats (`StatsRow`, restyled to thin bars in `var(--accent)` on a `var(--c-line)` track, with nature and the IV/EV inputs kept), Type matchups (type chips grouped under "4× weak", "2× weak", "Resists", "Immune"), Evolution.
    - **Right:** Abilities (rows: name left, "1" / "2" / "Hidden" right, divided by `var(--c-line)`), Held items, Catch (ball select, percent, the 1 HP and status buttons).
  - **Below:** Locations, Recommended sets and Moves as collapsible sections. Heading rows show "▸" / "▾".
  - **Cards:** no boxes inside boxes. Sections are separated by spacing and a heading, not by bordered cards.
- **Missing data** shows "None" (lists) or "—" (single values). Never `undefined`, `null` or `NaN`.

- [ ] **Step 1: Write the failing test**

```jsx
// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import PokemonProfile from '../../src/pages/PokemonProfile.jsx';
import { headerBackground } from '../../src/lib/typeColors.js';

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
  expect(screen.getByText('Snubbull')).toBeTruthy();
  expect(screen.getByText('#209')).toBeTruthy();
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
```

Change the fixture's field names to match the real `resolved` shape if they differ. The assertions stay the same.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/components/profile.test.jsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Move the leaf components** into `src/components/pokemon/`, then run `npm test && npm run build`. Expected: PASS, with no visual change yet. Commit it on its own: `git commit -m "Move shared Pokémon components out of App.jsx"`.

- [ ] **Step 4: Implement `PokemonProfile`** and `profile.css`, and replace the App.jsx block with it.

- [ ] **Step 5: Run tests and build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 6: Look at it**

Screenshot the profiles of Snubbull (Normal), Charizard (Fire/Flying), Pikachu (Electric, a light colour) and an event Pokémon (ID ≥ 650), at 1440 and 760 px wide. Check them against `direction.html` option C.

- [ ] **Step 7: Commit**

```bash
git add -A src/pages src/components/pokemon src/lib src/App.jsx src/index.css tests/components/profile.test.jsx
git commit -m "Rebuild the Pokémon profile page in style C"
```

---

### Task 9: Stage check and PR

**Files:** none new.

- [ ] **Step 1:** Run `npm test && npm run build`. Expected: all pass.
- [ ] **Step 2:** Walk every sidebar entry in the running app at 1440 px and 760 px wide, with Options → UI scale at its default and at a larger value.
  - Confirm each screen opens and keeps its features: caught toggles, compare, team builder, daycare, market, OCR settings, colour picker, patch notes.
  - Confirm no horizontal scroll.
- [ ] **Step 3:** Push `desktop-redesign` to `origin` and open a PR against `main` titled "Desktop redesign, stage 1: sidebar shell and Pokémon profile". The PR body lists what Austin should try. End it with the attribution line from the session's system reminder; no Co-Authored-By.
- [ ] **Step 4:** Check CI with `gh pr checks <n> --repo avershave/3s-PokeMMO-Tool` before handing back. Expected: Build renderer and both OCR helper builds pass.
