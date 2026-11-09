# PokeMMO Android Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Android app that draws a live route strip and battle panel over PokeMMO, tagging every spawn with *why* it's worth catching.

**Architecture:**
- **Node, at build time:** a generator reuses the desktop app's data and area logic. That logic is extracted from `src/App.jsx` into `src/lib/` and runs unchanged. The generator writes compact JSON: `pokemon.json`, `areas.json` and `tags.json`, plus downscaled sprites for the Android app.
- **The Kotlin app:**
  1. Captures the screen with MediaProjection.
  2. Reads two fixed screen regions with on-device ML Kit OCR.
  3. Feeds a pure-Kotlin parser and state machine.
  4. Draws Compose views in `TYPE_APPLICATION_OVERLAY` windows.
- **Remote updates:** only `tags.json` is fetched remotely, from the fork's `main`.

**Tech Stack:**
- Node 24, Vitest and vite-node, sharp for sprites.
- Kotlin 2.x, Android Gradle Plugin 8.x and JDK 17.
- Jetpack Compose, kotlinx.serialization, ML Kit Text Recognition (bundled Latin model), OkHttp.
- JUnit 4 and OkHttp MockWebServer for tests.
- GitHub Actions for CI.

**Spec:** `docs/superpowers/specs/2026-11-09-android-overlay-design.md` (approved 2026-11-09)

## Global Constraints

**Platform, rules and privacy**
- Only read pixels already on screen. No reading game memory, no network interception, no automated input or auto-scrolling.
- The overlay never sits over a region it reads with OCR (`ScreenRegions.ROUTE`, `ScreenRegions.BATTLE`).
- The only network call the app makes is fetching `tags.json`. No screenshots or text leave the phone.
- Supports the **new mobile UI** (late Oct 2026) and English. Spanish level labels ("Nv.") are also accepted in battle parsing.
- `minSdk 29`. `compileSdk` and `targetSdk` are the latest stable. Package `com.pokemmo.tool.overlay`, app name "3s PokeMMO Overlay".

**Tag rules**
- Tags in the first version: **PvP, Story, Utility, EV**. No GTM tag, list or price guide. Leave room in the schema (`kind` is an open string).
- Outline rule: a spawn is outlined if it has a PvP, Story or Utility tag (its own or carried down). **EV never counts toward the outline.**
- PvP means a Smogon Gen 5 set in **OU, UU, RU or NU** only. Every PvP summary/body states "Smogon Gen 5 — PokeMMO may differ".
- Utility comes from **abilities and level-up moves only** (`moves[].type === "level"`). Never TM, tutor or egg moves.
- Tags carry down evolution lines, labeled "(as X)". *Plan decision:* only **PvP and Story** carry down. Utility and EV describe the Pokémon you'd catch right now.

**Data and release**
- Remote tag URL: `https://raw.githubusercontent.com/avershave/3s-PokeMMO-Tool/main/public/data/overlay/tags.json`
- Releases go on the fork `avershave/3s-PokeMMO-Tool`, tag pattern `android-v*`. This must never trigger the desktop `v*` release workflow.
- Commits: plain messages, **no Co-Authored-By lines**. Austin pushes. The agent shell has no GitHub credentials.

## Review Focus

1. **Partial or noisy route OCR.** Examples: half a name, a chat bubble over the text, or "CITY · CH 1" suffixes. The strip should keep the last confirmed route rather than jump to a wrong one. Pinned in Task 7 (`returns null for low-confidence text`) and Task 9 (`route change needs two agreeing ticks`).
2. **Route names that exist in several regions** (Route 1 is in Kanto, Johto, Hoenn and Unova). The strip should stay in the region the player is already in. Pinned in Task 7 (`prefers current region`).
3. **Battle start, end and transition frames** (fades, text boxes, menus). The overlay should not flicker between the route strip and the battle panel. Pinned in Task 9 (`battle exit needs three empty ticks`).
4. **`tags.json` that's offline, malformed or a newer schema.** Fall back silently to the bundled or last-good copy. Pinned in Task 11.
5. **A horde where some boxes are unreadable or mixed species.** Group what was read and show species counts from readable boxes only. Pinned in Task 8 (`groups mixed horde, skips unreadable lines`).

---

## File Structure

```
src/lib/areas.js                 # extracted from App.jsx: area/encounter helpers (pure)
src/lib/typeChart.js             # extracted from App.jsx: TYPE_CHART, computeWeakness, titleCase
src/App.jsx                      # modified: imports the above instead of defining them
tests/lib/areas.test.js
tests/lib/typeChart.test.js
tests/overlay/tags.test.js
tests/overlay/build.test.js
tags/smogon-gen5.json            # snapshot {ou,uu,ru,nu: [species]} (committed, refreshed by script)
tags/utility-rules.json          # utility catalogue (content)
tags/explanations.json           # shared explanation text (content)
tags/story.json                  # story shortlist (content, Austin reviews)
tags/tips.json                   # catching tips (content, optional entries)
scripts/overlay/fetch-smogon.mjs
scripts/overlay/tags.js          # pure tag engine
scripts/overlay/build-overlay-data.mjs
public/data/overlay/tags.json    # generated, committed, served remotely
android/                         # Gradle project, single :app module
  app/src/main/java/com/pokemmo/tool/overlay/
    data/Models.kt  data/OverlayRepository.kt  data/TagUpdater.kt
    match/AliasKey.kt  match/RouteMatcher.kt
    battle/BattleParser.kt  battle/CaughtDetector.kt
    capture/ScreenRegions.kt  capture/CaptureService.kt  capture/OcrEngine.kt
    state/ScreenStateMachine.kt
    ui/StripModel.kt  ui/OverlayWindows.kt  ui/Strip.kt  ui/DetailCard.kt  ui/BattlePanel.kt
    MainActivity.kt
  app/src/test/...               # JVM unit tests, one per class above
  app/src/test/resources/alias-fixtures.json   # generated, committed
  app/src/main/assets/overlay/   # generated, gitignored
.github/workflows/android.yml
```

---

### Task 1: Extract desktop area and type helpers into `src/lib`

Purpose: the generator needs the desktop's exact area grouping and matching without importing React. The desktop behavior must not change.

**Files:**
- Create: `src/lib/areas.js`, `src/lib/typeChart.js`, `tests/lib/areas.test.js`, `tests/lib/typeChart.test.js`, `vitest.config.js`
- Modify: `src/App.jsx` (delete the moved definitions, add imports), `package.json` (devDeps `vitest`, script `"test": "vitest run"`)

**Interfaces:**
- Produces, from `src/lib/areas.js`, the existing functions with identical bodies:
  - `normalizeAreaName`, `stripSeason`, `normalizeTimeTag`, `cleanMethodLabel`, `cleanAreaMethod`, `selectRarest`
  - `groupEntriesByMon`, `normalizeMapForGrouping`, `extractTimeTag`, `stripTimeTag`, `mapNameMatches`
  - `simplifyName`, `tokenizeName`, `aliasKey`, `scoreNames`, `findBestMapName`, `findBestMapInText`
  - `listRegionCandidates`, `buildGroupedEntries`, `lookupRarity`, and the constant `LIVE_ALIASES`
- Produces two new builders made from hook bodies:
  - `buildHordeSizeMap(hordeRegions) -> map` and `getHordeSize(sizeMap, region, area, name)`. *Signature change:* the map is now passed in. Update the App.jsx call sites.
  - `buildAreasIndex(dexList, sizeMap) -> {[region]: {[map]: Entry[]}}`, the body of `useAreasDbCleaned`.
  - `buildLocationsIndex(dexList) -> {[normalizedName]: {locations}}`, the body of `useLocationsDb`. The hooks become `useMemo(() => buildX(...), [])`.
- Produces, from `src/lib/typeChart.js`: `TYPE_CHART`, `titleCase(s)`, and `computeWeakness(types) -> {x4, x2, x0_5, x0_25, x0}`, with names title-cased as today.
- Helpers they depend on (`normalizeKey`, `normalizeRegion`, `titleCase`) move along or are imported. App.jsx keeps a single definition of each.

- [ ] **Step 1: Add vitest.** Run `npm i -D vitest`. Add `"test": "vitest run"`. Add `vitest.config.js` with `test.include: ['tests/**/*.test.js']`.
- [ ] **Step 2: Write failing tests**

```js
// tests/lib/typeChart.test.js
import { computeWeakness } from '../../src/lib/typeChart.js';
test('normal is weak to fighting, immune to ghost', () => {
  const w = computeWeakness(['NORMAL','NORMAL']);
  expect(w.x2).toEqual(['Fighting']); expect(w.x0).toEqual(['Ghost']);
});
test('grass/poison has no 4x and is 2x weak to fire, ice, flying, psychic', () => {
  expect(computeWeakness(['grass','poison']).x2.sort()).toEqual(['Fire','Flying','Ice','Psychic']);
});

// tests/lib/areas.test.js
import { aliasKey, normalizeMapForGrouping, mapNameMatches, buildAreasIndex, buildHordeSizeMap,
         buildLocationsIndex, buildGroupedEntries } from '../../src/lib/areas.js';
import { DEX_LIST } from '../../src/lib/dex.js';
import hordeRegions from '../../horderegiondata.json';
test('aliasKey strips suffixes and channel', () => {
  expect(aliasKey('Ecruteak City Ch 1')).toBe('ecruteak');
  expect(aliasKey('Mt. Coronet')).toBe('mountcoronet');
});
test('split routes merge', () => expect(normalizeMapForGrouping('Sinnoh','Route 212 (North)')).toBe('Route 212'));
test('route numbers match exactly', () => {
  expect(mapNameMatches('Route 5', 'Route 5')).toBe(true);
  expect(mapNameMatches('Route 50', 'Route 5')).toBe(false);
});
test('Kanto Route 5 contains Meowth (Grass) and Abra', () => {
  const idx = buildAreasIndex(DEX_LIST, buildHordeSizeMap(hordeRegions));
  const loc = buildLocationsIndex(DEX_LIST);
  const g = buildGroupedEntries(idx, 'ROUTE 5', 'Kanto', loc);
  const names = g.map(x => x.monName);
  expect(names).toContain('Meowth'); expect(names).toContain('Abra');
  expect(g.find(x => x.monName === 'Meowth').encounters.some(e => /grass/i.test(e.method))).toBe(true);
});
```

- [ ] **Step 3: Run `npm test`.** Expected: FAIL, modules not found.
- [ ] **Step 4: Move the definitions** from `src/App.jsx` into the two lib files, unchanged apart from the `getHordeSize` signature. Add `export`. Replace them in App.jsx with imports.
- [ ] **Step 5: Run `npm test` and `npm run build`.** Expected: tests PASS, and the Vite build succeeds with no new warnings about missing identifiers.
- [ ] **Step 6: Manual check.** Run `npm run electron:dev`, open Live Route and the Areas search for "Route 5". The results are unchanged.
- [ ] **Step 7: Commit:** `git add src/lib tests/lib vitest.config.js package.json package-lock.json src/App.jsx` then `git commit -m "Extract area and type helpers into src/lib"`.

---

### Task 2: Tag engine and content catalogue

**Files:**
- Create: `scripts/overlay/tags.js`, `scripts/overlay/fetch-smogon.mjs`, `tags/smogon-gen5.json`, `tags/utility-rules.json`, `tags/explanations.json`, `tags/story.json` (as `{"entries": []}` for now), `tags/tips.json` (as `{}`), `tests/overlay/tags.test.js`
- Modify: `package.json` (script `"overlay:smogon": "node scripts/overlay/fetch-smogon.mjs"`)

**Interfaces:**
- `fetch-smogon.mjs` fetches `https://data.pkmn.cc/sets/gen5{ou,uu,ru,nu}.json`, following redirects. The top-level keys are species names. It writes `tags/smogon-gen5.json` as `{"fetchedAt": ISO, "ou": [...], "uu": [...], "ru": [...], "nu": [...]}`, sorted. A species appears only in its highest tier.
- `tags/utility-rules.json`: `[{ "key": "utility.pickup", "ability": "Pickup" } | { "key": "utility.payday", "levelMove": "Pay Day" }]`.
  - The minimum catalogue is: Pickup, Synchronize, Compound Eyes, Frisk (abilities); Pay Day, Thief, Covet, False Swipe, Sweet Scent, Spore (level-up moves).
  - Add others only with an explanation of what they do *in PokeMMO*.
- `tags/explanations.json`: `{ "<key>": { "title", "summary", "body", "more"? } }`.
  - It needs a key for every utility rule, plus `pvp.smogon` and `ev`.
  - `summary` is at most 5 words, e.g. "Nature hunting lead". `body` is 2–4 sentences, and `more` is an optional longer meta explainer.
- `tags/story.json`: `{ "entries": [{ "id": 65, "summary": "Fast, hits hard", "body": "..." }] }`. Entries are listed on the Pokémon worth using, usually the final form, and carry down automatically.
- `tags/tips.json`: `{ "<id>": "Catching tip sentence" }`.
- `scripts/overlay/tags.js` exports:
  - `buildTags({ dex, smogon, utilityRules, explanations, story, tips }) -> { pokemon: {[id]: Tag[]}, tips }`
  - `type Tag = { kind: 'pvp'|'story'|'utility'|'ev', key: string, summary: string, body?: string, via?: number, viaName?: string }`
  - `hasOutline(tags: Tag[]) -> boolean` (pvp/story/utility present)
  - `descendants(dexById, id) -> number[]` (transitive `evolutions[].id`, cycle-safe)
- Engine rules:
  - **Own utility:** an ability in slots 0–1 → summary from explanations. Slot 2, the hidden ability → summary + " (Hidden Ability)". A level-up move only matches when `type === "level"`.
  - **EV:** from `yields.ev_*`, e.g. "+2 Atk", "+1 HP, +1 Sp. Def". Labels are HP, Atk, Def, Sp. Atk, Sp. Def, Spe. Omitted when all are zero.
  - **PvP:** a summary like `Smogon Gen 5 UU`. If the Pokémon has none of its own, use the highest-tier descendant with `via`/`viaName`. Ties go to the first descendant found.
  - **Story:** own entry, else the first descendant with an entry. Carried tags get `via`.
  - **One tag per kind** for PvP and Story. Multiple utility tags are allowed.
  - **Order:** pvp, story, utility (catalogue order), ev.
  - Species names from Smogon are matched to dex names case- and punctuation-insensitively. Unmatched names are returned in `warnings[]`, never thrown.

- [ ] **Step 1: Write failing tests** (`tests/overlay/tags.test.js`, using a small inline dex fixture plus one real-data test):

```js
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
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement `tags.js`, the fetch script and the content files.**
  - Run `npm run overlay:smogon` once and commit the snapshot.
  - Write the explanation texts in the voice of the mockup ("Put it first in your party and wild Pokémon have a 50% chance to share its nature…"). Every `pvp.smogon` text says it's Smogon Gen 5 and PokeMMO may differ.
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "Add overlay tag engine and content catalogue"` (files above).

---

### Task 3: Overlay data generator

**Files:**
- Create: `scripts/overlay/build-overlay-data.mjs`, `tests/overlay/build.test.js`
- Modify:
  - `package.json`: devDeps `sharp` and `vite-node`; script `"overlay:build": "vite-node scripts/overlay/build-overlay-data.mjs"`
  - `.gitignore`: `android/app/src/main/assets/overlay/`, `android/.gradle/`, `android/**/build/`, `android/local.properties`
- Generated: `public/data/overlay/tags.json` (committed), `android/app/src/test/resources/alias-fixtures.json` (committed)

**Interfaces:**
- The generator exports `buildOverlayData({ dexList, hordeRegions, catchRates, tagInputs }) -> { pokemon, areas, tags, aliasFixtures }`, which is pure. A `main()` writes the files when run directly.
- `pokemon.json`:

```json
{ "schemaVersion": 1,
  "pokemon": [{ "id": 63, "name": "Abra", "types": ["Psychic"], "catchRate": 200,
                "evYield": { "spa": 1 }, "weak4": [], "weak2": ["Bug","Ghost","Dark"], "heldItems": ["TwistedSpoon"] }] }
```

- `areas.json`:
  - Each area is a `(region, stripTimeTag(normalizeMapForGrouping(region, map)))` pair over `buildAreasIndex` keys. The source names are upper-case, like `ROUTE 5`.
  - `name` = `titleCase(...)` from `src/lib/typeChart.js` (`ROUTE 5` → `Route 5`), and `key` = `aliasKey(name)`.
  - Spawns come from `buildGroupedEntries(areasIndex, sourceName, region, locIndex)`.
  - Rows whose `monName` doesn't resolve to a dex id are dropped. This guards against junk like `"Horde)"` and `"And Chinchou"` from `public/data/areas_index.json`.

```json
{ "schemaVersion": 1,
  "areas": [{ "region": "Kanto", "name": "Route 5", "key": "route5",
              "spawns": [{ "id": 52, "name": "Meowth",
                           "encounters": [{ "method": "Grass", "rarities": ["Common"], "min": 12, "max": 14, "hordeSize": null }] }] }] }
```

- `tags.json`: `{ "schemaVersion": 1, "generatedAt": ISO, "explanations": {...}, "pokemon": {"63": Tag[]}, "tips": {...} }`. It is built with `generatedAt` from the newest mtime under `tags/`, so output is deterministic.
- `alias-fixtures.json`: `[{ "input": "...", "key": "..." }]`. It holds every area name, plus these OCR-like inputs: `"Ecruteak City CITY · CH 1"`, `"Vermilion City INSIDE · CH 1"`, `"Mt. Coronet 4F"`, `"Route 212 (North)"`.
- **Outputs and sprites.**
  - Sprites: `public/sprites/{id}.png` for ids 1–649 become `android/app/src/main/assets/overlay/sprites/{id}.webp`, 96×96, `kernel: 'nearest'`, lossless.
  - The three JSON files are copied into `android/app/src/main/assets/overlay/` as well.
  - `tags.json` is also written to `public/data/overlay/`.

- [ ] **Step 1: Write failing tests** (`tests/overlay/build.test.js`, calling `buildOverlayData` on real repo data):
  - `Kanto/Route 5` exists with key `route5` and includes ids 52 and 63.
  - No spawn has a name starting "And " or containing ")".
  - Pokémon 217 (Ursaring) has `weak2: ["Fighting"]`, `catchRate: 60`, `evYield: { atk: 2 }`.
  - Every `aliasFixtures[i].key === aliasKey(input)`.
  - `tags.pokemon["63"]` has a pvp tag with `viaName: "Alakazam"`, if Alakazam is in the snapshot; otherwise skip with a note.
  - `JSON.stringify` of two runs is identical.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement the generator.** Run `npm run overlay:build`.
- [ ] **Step 4: Run `npm test`.** Expected: PASS. Then check that the sprites folder holds 649 `.webp` files totaling under 5 MB.
- [ ] **Step 5: Commit:** `git commit -m "Add overlay data generator"` (script, test, package files, `.gitignore`, `public/data/overlay/tags.json`, `alias-fixtures.json`).

---

### Task 4: Story shortlist and catching tips (content, Austin reviews)

**Files:** Modify `tags/story.json` and `tags/tips.json`, then regenerate `public/data/overlay/tags.json`.

- [ ] **Step 1: Draft 100–150 entries** across Kanto, Johto, Hoenn, Sinnoh and Unova.
  - Each entry: id (usually the final form), `summary` of at most 5 words, and `body` of 2–3 sentences on why it's good *for the story*: availability, speed or bulk, key moves, gym matchups.
  - Only include Pokémon obtainable in PokeMMO (`obtainable: true` in `UpdatedDex.json`).
- [ ] **Step 2: Draft tips** for 15–30 Pokémon with notable catching quirks: Abra (Teleport), Chansey/Blissey (rare, fragile), and similar.
- [ ] **Step 3: Add a test.** Every `story.entries[].id` and every tips key exists in the dex, and no `summary` is over 5 words. Run `npm test`. Expected: PASS.
- [ ] **Step 4: Regenerate.** Run `npm run overlay:build`, then commit: `git commit -m "Draft story shortlist and catching tips"`.
- [ ] **Step 5: STOP. Austin reviews `tags/story.json`.** Apply his edits, regenerate and commit. Android tasks can proceed in parallel. Only release (Task 13) is blocked on this review.

---

### Task 5: Android toolchain, project skeleton, models and repository

**Files:**
- Create: `android/settings.gradle.kts`, `android/build.gradle.kts`, `android/gradle/libs.versions.toml`, the Gradle wrapper, `android/app/build.gradle.kts`, `android/app/src/main/AndroidManifest.xml`
- Create: `data/Models.kt`, `data/OverlayRepository.kt`, `app/src/test/.../data/OverlayRepositoryTest.kt`

**Interfaces:**
- `Models.kt`, using `@Serializable` and mirroring Task 3 JSON exactly:
  - `PokemonData(id:Int, name:String, types:List<String>, catchRate:Int?, evYield:Map<String,Int>, weak4:List<String>, weak2:List<String>, heldItems:List<String>)`
  - `Encounter(method:String, rarities:List<String>, min:Int?, max:Int?, hordeSize:Int?)`
  - `Spawn(id:Int, name:String, encounters:List<Encounter>)`
  - `Area(region:String, name:String, key:String, spawns:List<Spawn>)`
  - `Tag(kind:String, key:String, summary:String, body:String?=null, via:Int?=null, viaName:String?=null)`
  - `Explanation(title:String, summary:String, body:String, more:String?=null)`
  - `TagsFile(schemaVersion:Int, generatedAt:String, explanations:Map<String,Explanation>, pokemon:Map<String,List<Tag>>, tips:Map<String,String>)`
- `OverlayRepository(pokemonJson:String, areasJson:String, tagsJson:String)`:
  - `pokemon(id:Int):PokemonData?`, `pokemonByName(normName:String):PokemonData?`
  - `areas:List<Area>`
  - `tags(id:Int):List<Tag>`, `explanation(key:String):Explanation?`, `tip(id:Int):String?`
  - `fun hasOutline(tags:List<Tag>):Boolean` (same rule as JS)
  - `fun withTags(tagsJson:String):OverlayRepository`, used by Task 11
- `OverlayRepository.fromAssets(context)` reads `assets/overlay/*.json`. JSON parsing uses `ignoreUnknownKeys = true`.

- [ ] **Step 1: Toolchain.** This machine has JDK 11 and no Android SDK.
  - Install Temurin 17: `winget install EclipseAdoptium.Temurin.17.JDK`.
  - Install Android command-line tools into `%LOCALAPPDATA%\Android\Sdk`.
  - Run `sdkmanager "platform-tools" "platforms;android-<latest>" "build-tools;<latest>"`.
  - Write `android/local.properties` with `sdk.dir`.
  - Create the wrapper with a one-off Gradle download: `gradle wrapper --gradle-version <latest 8.x>`.
- [ ] **Step 2: Write the failing test** `OverlayRepositoryTest`. Run `npm run overlay:build` first, since the assets are generated and gitignored. Load the real generated JSON from `../../android/app/src/main/assets/overlay/`; the test reads files by path relative to the module.
  - `areas` contains region "Kanto" and name "Route 5".
  - `pokemon(217)!!.weak2 == listOf("Fighting")`.
  - `hasOutline(tags(52))` is true, because Meowth has utility.
  - `hasOutline(listOf(Tag("ev","ev","+1 Spe")))` is false.
- [ ] **Step 3: Run `cd android && ./gradlew :app:testDebugUnitTest`.** Expected: FAIL to compile.
- [ ] **Step 4: Implement the skeleton, models and repository.** Add Compose, kotlinx.serialization, ML Kit `text-recognition` (bundled), OkHttp, and MockWebServer (test) to `libs.versions.toml`. Pin versions.
- [ ] **Step 5: Run the tests.** Expected: PASS. `./gradlew :app:assembleDebug` succeeds.
- [ ] **Step 6: Commit:** `git commit -m "Add Android project skeleton and data repository"`.

---

### Task 6: Kotlin `aliasKey` parity

**Files:** Create `match/AliasKey.kt` and `match/AliasKeyTest.kt`.

**Interfaces:** `object AliasKey { fun of(s:String):String }` is a line-for-line port of `simplifyName` + `LIVE_ALIASES` from `src/lib/areas.js`, keeping the same regex order.

- [ ] **Step 1: Failing test.** For every entry in `alias-fixtures.json` (test resource), `AliasKey.of(input) == key`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "Port aliasKey to Kotlin with JS parity fixtures"`.

---

### Task 7: Route matcher

**Files:** Create `match/RouteMatcher.kt` and `match/RouteMatcherTest.kt`.

**Interfaces:** `class RouteMatcher(areas: List<Area>)` with `fun match(ocrLine: String, currentRegion: String?): Area?`

Algorithm, decided:
1. Clean the line. Cut at the first `" · "`, then drop a trailing ALL-CAPS word of 3+ letters (CITY, TOWN, ROUTE, INSIDE, CAVE…) that follows mixed-case text.
2. `key = AliasKey.of(cleaned)`. If the text has "Route N", only areas with that route number are candidates.
3. Candidates are areas with `area.key == key`. If there are none, use areas with Levenshtein similarity ≥ 0.85 on keys, keeping the best score.
4. Choosing among candidates: prefer `currentRegion` if present; otherwise, if exactly one region, use it; otherwise use the first in region order Kanto, Johto, Hoenn, Sinnoh, Unova.
5. Return null when the cleaned text is under 3 alphanumerics or nothing passes.

- [ ] **Step 1: Failing tests:**
  - `matches new-UI town line`: "Ecruteak City CITY · CH 1" → Johto / Ecruteak City.
  - `matches route number exactly`: "Route 5" → Kanto Route 5 with currentRegion "Kanto". Never Route 50.
  - `prefers current region`: "Route 1" with currentRegion "Unova" → Unova.
  - `single region wins without current`: a name only in Sinnoh → Sinnoh even with currentRegion "Kanto".
  - `tolerates one OCR typo`: "Ecruteak Clty" → Ecruteak City.
  - `returns null for low-confidence text`: "", "Ro", "14,158", and "Fri 23:12 · Summer" → null.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement.** **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "Add route matcher"`.

---

### Task 8: Battle parser and caught detector

**Files:** Create `battle/BattleParser.kt`, `battle/CaughtDetector.kt`, and tests for both.

**Interfaces:**
- `data class OcrLine(text:String, left:Int, top:Int, right:Int, bottom:Int)`. This is the OCR-agnostic input; Task 9 maps ML Kit lines into it.
- `data class Opponent(pokemon: PokemonData, level:Int, box: OcrLine)`
- `data class OpponentGroup(pokemon: PokemonData, count:Int, minLevel:Int, maxLevel:Int, caught:Boolean)`
- `class BattleParser(repo: OverlayRepository)`:
  - `fun parse(lines: List<OcrLine>): List<Opponent>`
  - `fun group(opps: List<Opponent>, caught: (Opponent)->Boolean): List<OpponentGroup>`, in first-seen order
- Line regex, decided: `^(.+?)\s+(?:Lv|Nv|Niv|Lvl)\.?\s*(\d{1,3})\b`. Group 1 is normalized (letters only, lowercase, ♀/♂ preserved) and matched to a dex name, exactly or with Levenshtein ≤ 2 when the name is 5+ chars. Unmatched lines are skipped.
- `object CaughtDetector`:
  - `fun isCaught(argb: IntArray, width:Int, height:Int, line: OcrLine): Boolean`
  - It probes the box `[line.right, line.right + 3*h] × [line.top, line.bottom]`, where `h = line.bottom - line.top`, clamped to the image.
  - Caught when ≥ 8% of pixels in the top half are red (`r>170 && g<90 && b<90`) **and** ≥ 8% of pixels in the bottom half are white (`r,g,b > 200`).
  - Thresholds are constants for on-device tuning.

- [ ] **Step 1: Failing tests:**
  - `parses English and Spanish levels`: "Ursaring Nv. 58" → (217, 58); "Abra Lv. 12" → (63, 12).
  - `ignores non-battle text`: "0/7", "14,158", "LUCHA", "nito que se ve tesela :V" → empty.
  - `groups mixed horde, skips unreadable lines`: 3 Ursaring lines, 1 "Ursar1ng Nv. 6l", and 1 Teddiursa line → groups [Ursaring×3 (or ×4 if the typo resolves), Teddiursa×1]. Assert the counts sum to the matched lines and the order is first-seen.
  - `CaughtDetector true on synthetic ball`: draw red over white in the probe box of a synthetic image → true.
  - `CaughtDetector false on plain background` → false.
  - `CaughtDetector false when the probe box falls off-screen` → false.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement.** **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "Add battle parser and caught detector"`.

---

### Task 9: Screen state machine, capture service and OCR

**Files:**
- Create: `capture/ScreenRegions.kt`, `state/ScreenStateMachine.kt`, `state/ScreenStateMachineTest.kt`, `capture/OcrEngine.kt`, `capture/CaptureService.kt`
- Modify: `AndroidManifest.xml`, adding:
  - `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PROJECTION`, `POST_NOTIFICATIONS`, `SYSTEM_ALERT_WINDOW`, `INTERNET`
  - the service with `foregroundServiceType="mediaProjection"`

**Interfaces:**
- `ScreenRegions` holds fractions of the landscape screen, taken from the reference screenshots:
  - `ROUTE = RectF(0.03f, 0.00f, 0.26f, 0.055f)`
  - `BATTLE = RectF(0.00f, 0.08f, 0.86f, 0.28f)`
  - `STRIP_AREA = RectF(0.27f, 0.00f, 0.735f, 0.10f)`
  - `BATTLE_PANEL = RectF(0.01f, 0.29f, 0.205f, 0.71f)`
  - Test: `STRIP_AREA` and `BATTLE_PANEL` don't intersect `ROUTE` or `BATTLE`.
- `sealed interface ScreenState`: `Idle`, `Overworld(area: Area)`, `Battle(groups: List<OpponentGroup>, area: Area?)`.
- `class ScreenStateMachine` with `fun onTick(route: Area?, opponents: List<OpponentGroup>): ScreenState`:
  - Enter Battle after **2** consecutive ticks with non-empty opponents.
  - Leave Battle after **3** consecutive ticks with empty opponents.
  - Route changes only when the **same** new area is seen on **2** consecutive ticks.
  - A null route never clears a confirmed route.
  - `Battle.area` keeps the last overworld area.
- `OcrEngine` wraps the ML Kit `TextRecognition` client: `suspend fun read(bitmap: Bitmap): List<OcrLine>`. Coordinates are mapped back to full-screen pixels.
- `CaptureService` is a foreground service:
  1. Gets a `MediaProjection` from the consent intent.
  2. Creates a `VirtualDisplay` → `ImageReader` (RGBA_8888, full resolution).
  3. Every **700 ms**, crops `ROUTE` and `BATTLE`, runs OCR on both, and computes caught flags from the full frame.
  4. Feeds `ScreenStateMachine` and publishes `StateFlow<ScreenState>`.
- The notification has a "Stop" action. It stops cleanly on projection `onStop` (Android 14+ revokes per session).

- [ ] **Step 1: Failing tests** (`ScreenStateMachineTest`, plus the regions test):
  - `battle entry needs two ticks`.
  - `battle exit needs three empty ticks`: a 1–2 tick dropout mid-battle stays in Battle.
  - `route change needs two agreeing ticks`: A, B, A doesn't switch; B, B does.
  - `null route keeps last`.
  - `overlay regions never overlap OCR regions`.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement** the state machine and regions. **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Implement `OcrEngine` and `CaptureService`.** They're verified on device in Task 12. `./gradlew :app:assembleDebug` succeeds.
- [ ] **Step 6: Commit:** `git commit -m "Add screen state machine and capture service"`.

---

### Task 10: Overlay UI (strip, detail card, battle panel)

**Files:** Create `ui/StripModel.kt`, `ui/StripModelTest.kt`, `ui/OverlayWindows.kt`, `ui/Strip.kt`, `ui/DetailCard.kt`, `ui/BattlePanel.kt`.

**Interfaces:**
- `enum class TagKind { PVP, STORY, UTILITY, EV }`, mapped from `Tag.kind` ("pvp", "story", "utility", "ev"). Unknown kinds, like a future "gtm", are ignored, not crashed on. Colors: PvP `#C0392B`, Story `#2E6FD8`, Utility `#1F9D55`, EV `#555555`. Panel background `rgba(18,20,28,0.9)`.
- `data class StripItem(id:Int, name:String, outline:TagKind?, dimmed:Boolean)`
- `data class StripModel(title:String, region:String, items:List<StripItem>, overflow:Int, empty:Boolean)`
- `fun buildStrip(area: Area, repo: OverlayRepository, maxVisible:Int): StripModel`:
  - The outline uses the highest of PvP > Story > Utility.
  - Outlined items come first in that kind order, then by name; dimmed items follow, by name.
  - `overflow = max(0, n - maxVisible)`, and `empty = spawns.isEmpty()`. Empty shows "No wild Pokémon here".
- `data class CardRow(kind:TagKind, title:String, summary:String, body:String, more:String?)`. The title adds " (as X)" when `via != null`.
- `fun buildCard(id:Int, repo): Card(name, subtitle, rows:List<CardRow>, tip:String?)`:
  - Subtitle is "Rare · Grass · Psychic" style: rarest rarity, first method, then types.
  - Rows come in tag order. EV rows come last, are not outlined, and show "+N per horde" when opened from a horde group.
- `OverlayWindows` manages the `WindowManager` views:
  - Uses `TYPE_APPLICATION_OVERLAY`, `FLAG_NOT_FOCUSABLE`, and `FLAG_WATCH_OUTSIDE_TOUCH` on the card, so an outside tap closes it.
  - Hosts `ComposeView`s with a service-owned `LifecycleOwner` + `SavedStateRegistryOwner` set via `setViewTree*Owner`.
  - Observes `ScreenState`:
    - **Overworld:** the strip is centered in `STRIP_AREA`.
    - **Battle:** the strip is hidden and the battle panel shows in `BATTLE_PANEL`.
    - **Idle:** the strip shows "Looking for route…".
  - The detail card opens below the strip, or to the right of the battle panel, at most 40% of screen width. Rows are collapsed by default, and tapping a row expands only that row to show `body`. When `more` exists, an expanded row ends with "More about {title} ▸", which reveals `more` inline. "+N" on the strip reveals the rest of the sprites.
- The battle panel shows each `OpponentGroup`:
  - sprite, "Name ×N", caught dot, types, "Catch N", and weak 4×/2× chips;
  - EV with "+X each, +Y per horde";
  - a tap opens the detail card.
  - It matches the desktop Live Battle fields: types, weaknesses, catch rate, caught.

- [ ] **Step 1: Failing tests** (`StripModelTest`, with real repo data):
  - `Route 5 strip outlines Meowth and Abra, dims Rattata`.
  - `outlined first, PvP before Story before Utility`.
  - `overflow counts hidden sprites`.
  - `empty area shows empty flag`.
  - `card rows label carried tags`: Abra's PvP row title ends with "(as Alakazam)".
  - `EV never outlined`: a synthetic Pokémon with only EV gives `outline == null, dimmed == true`.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement** the models, then the Compose views and windows. **Step 4: Run.** Expected: PASS. `assembleDebug` succeeds.
- [ ] **Step 5: Commit:** `git commit -m "Add overlay strip, detail card and battle panel"`.

---

### Task 11: Remote tag updates

**Files:** Create `data/TagUpdater.kt` and `data/TagUpdaterTest.kt`.

**Interfaces:**
- `class TagUpdater(client: OkHttpClient, url: String, cacheFile: File, bundledTagsJson: String)`
- `suspend fun current(): String` returns the newest valid JSON among bundled, cached and remote.
- Remote is accepted only if it parses as `TagsFile`, has `schemaVersion == 1`, and its `generatedAt` is newer than the best local copy. Accepted remote is written to `cacheFile`.
- Any failure (network, HTTP ≠ 200, parse, schema) returns the best local copy and never throws. Timeout is 5 s.
- Called once at service start; `OverlayRepository.withTags(...)` swaps it in.

- [ ] **Step 1: Failing tests** with MockWebServer:
  - `newer remote wins and is cached`.
  - `older remote ignored`.
  - `malformed JSON falls back`.
  - `schemaVersion 2 falls back`.
  - `HTTP 500 falls back`.
  - `offline uses cache over bundled when cache is newer`.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement.** **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "Add remote tag updater"`.

---

### Task 12: Main screen, permissions and on-device check

**Files:** Create `MainActivity.kt`. Modify `AndroidManifest.xml`.

**Interfaces:**
- One Compose screen with a checklist:
  1. "Display over other apps", which opens `ACTION_MANAGE_OVERLAY_PERMISSION`.
  2. Notifications (Android 13+).
  3. **Start overlay**, which launches the `MediaProjectionManager.createScreenCaptureIntent()` consent and starts `CaptureService`.
  4. **Stop overlay**.
- The consent screen tells the user to choose **PokeMMO** as the app to share, or the entire screen. Sharing only the PokeMMO window keeps the overlay out of the capture.
- A one-line privacy note: "Screen text is read on your phone only."

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Install on Austin's Pixel 9 Pro XL.**
  - Run `./gradlew :app:installDebug`; `adb devices` must list the phone with USB debugging on.
  - Austin runs the checklist and opens PokeMMO.
- [ ] **Step 3: On-device verification.** Austin reports, and the agent records the results in the PR description. Checks:
  - The strip shows the correct route within about 2 s of entering it.
  - A wild battle swaps to the panel with correct weaknesses and catch rate, and caught matches the in-game ball.
  - A 5-horde shows "×5".
  - The panel returns to the strip after the battle.
  - Nothing covers the route name or the opponent names.
  - Tapping a sprite opens the card, and tapping a row expands only that row.
- [ ] **Step 4: Tune if positions are off.** Capture `adb exec-out screencap -p > shot.png` on the phone, adjust `ScreenRegions` and the `CaughtDetector` thresholds, and re-run the Task 9 regions test.
- [ ] **Step 5: Commit:** `git commit -m "Add main screen and tune regions on device"`.

---

### Task 13: CI and release

**Files:** Create `.github/workflows/android.yml`. Modify `android/app/build.gradle.kts` (release signing from env) and `README.md` (Android section: install, permissions, privacy, and "Suggest a tag fix" pointing to GitHub issues on the fork).

**Interfaces:**
- **Workflow triggers:** `pull_request` on paths `android/**`, `scripts/overlay/**`, `tags/**`, `src/lib/**`, `public/data/overlay/**`, `.github/workflows/android.yml`; `push` of tags `android-v*`; `workflow_dispatch`.
- **Job `data`** (ubuntu, Node 24):
  1. `npm ci && npm test && npm run overlay:build`
  2. `git diff --exit-code public/data/overlay/tags.json android/app/src/test/resources/alias-fixtures.json` (generated files are up to date)
  3. Upload `android/app/src/main/assets/overlay` as an artifact.
- **Job `android`** (needs `data`; ubuntu, JDK 17):
  1. Download the assets.
  2. `./gradlew :app:testDebugUnitTest :app:assembleDebug`
  3. On `android-v*` tags: `:app:assembleRelease`, signed from the secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`, then attach `3s-PokeMMO-Overlay-<version>.apk` to the GitHub Release with `softprops/action-gh-release`.
- `versionName` comes from the tag (`android-v0.1.0` → `0.1.0`), and `versionCode` from the run number.

- [ ] **Step 1: Write the workflow, signing config and README section.**
- [ ] **Step 2: Local check.** `./gradlew :app:assembleRelease` with a throwaway keystore in env vars produces a signed APK. `apksigner verify` passes.
- [ ] **Step 3: Austin's steps** (outward-facing, his account):
  - Create the real keystore with `keytool -genkeypair ...` and keep it safe; losing it blocks future updates.
  - Add the 4 secrets on `avershave/3s-PokeMMO-Tool`.
  - Push the branch and open a PR. CI must be green. The agent checks status with the public GitHub API.
- [ ] **Step 4: Commit:** `git commit -m "Add Android CI and release workflow"`.
- [ ] **Step 5: First release.** Blocked on the Task 4 story review and the Task 12 on-device check. After merge, Austin tags `android-v0.1.0` and pushes the tag.
