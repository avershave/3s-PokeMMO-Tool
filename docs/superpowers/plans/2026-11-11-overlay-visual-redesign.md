# Overlay Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the outlined strip, misplaced card and old battle panel with the approved minimal pixel-art design: Gen 5 menu icons from Austin's Black ROM, a top-centre drawer with a cycling tab and catch marks, a card aligned under the drawer, a restyled battle panel, and a panel on/off setting.

**Architecture:**
- **Icons:** a Node script extracts the Pokémon and ball icons from `roms/` into committed PNGs under `art/overlay/`. The existing generator copies them into the app's assets.
- **Kotlin, pure models:** catch marks, the drawer, the card's "where" lines, and the visibility rules. These are unit-tested on the JVM.
- **Kotlin, Compose:** the views consume those models. `OverlayWindows` places the drawer, card and panel as windows sized in fractions of the screen.

**Tech Stack:**
- Node with Vitest and sharp
- Kotlin with Jetpack Compose (BOM 2025.12.01) and JUnit4
- The Android CLI (`android preview render`, `android run`, `android screen capture`) for visual checks

**Spec:** `docs/superpowers/specs/2026-11-11-overlay-visual-redesign-design.md`. Read it first. The approved mockups it cites are in `.superpowers/brainstorm/857-1794402834/content/` (local only, gitignored).

**Shell notes:**
- Gradle runs with `JAVA_HOME="$LOCALAPPDATA/Programs/jdk-17"`, from `android/`.
- The Android CLI is `"$LOCALAPPDATA/Android/Sdk/cmdline-tools/latest/bin/android.exe"`.
- The ROM paths are in `roms/`. Black is `roms/Pokemon - Black Version (USA, Europe) (NDSi Enhanced).nds`.

## Global Constraints

- Never commit anything in `roms/` or any `*.nds`/`*.gba` file. Extracted PNGs under `art/overlay/` may be committed (Austin's decision).
- No borders or outlines anywhere on the overlay to mark value. Value is shown only by fading: greyscale at alpha 0.35, with its marks at alpha 0.45.
- "Worth catching" is `OverlayRepository.hasOutline(tags)`, unchanged: PvP counts only for OU or UU, and Story and Utility count. Austin confirmed this on 2026-11-11.
- No official artwork on the overlay. `assets/overlay/sprites/*.webp` is removed from the APK.
- No overworld overlay string may match `(?i)\b(Lv|Nv|Niv|Lvl)\.?\s*\d`. Levels are written `Level 30–35` (en dash) or `Level 38`.
- **Panel colour:** `0xDB1C202A`, which is rgba(28,32,42,0.86).
- **Text:** `0xFFFFFFFF`, with muted text `0xFFCFD6E4` and grey `0xFF8F99AB`.
- **Label colours:** PvP `0xFFFF8A7A`, Story `0xFF7FB8FF`, Utility `0xFF8FE08F`, EV `0xFFAAB3C2`.
- Every pixel image is drawn with `FilterQuality.None`.
- All sizes are fractions of the screen (real metrics). There are no fixed dp layouts for the drawer, card or panel.
- Do not change OCR, the state machine thresholds, the tag rules or tag content.
- Commit messages have no Co-Authored-By lines.
- Work on branch `android-overlay`.

## Review Focus

1. **A route whose spawns are all lure-only.** Expect the same still Poké Ball tab and "No wild Pokémon here" as an empty area. The test is in Task 5.
2. **A method string not in the known list** (a future data change). Expect the SPECIAL mark, with no crash or omission. The test is in Task 4.
3. **An encounter with a null `min` or `max`, or `min == max`.** Expect no level text, or `Level 38`. It must never read `Level null`. The test is in Task 6.
4. **An id with no committed icon file.** Expect an empty box the size of the icon, with no crash. The test checks that every id 1..649 has an icon (Task 3), and `IconCache` returns null safely (Task 8).
5. **Opening the drawer, then rotating 180° or entering battle and leaving.** Expect the drawer to come back open and exactly where it was, and the card to be closed. The tests are in Task 7 (visibility rules), plus a device check in Task 13.

---

### Task 1: Commit the device-test fixes

These uncommitted changes from the 2026-11-11 phone test must land before anything else:
- `CaptureService.kt`: landscape-sized capture, frame reuse (`lastReading`), and debug logging.
- `CaptureGeometry.kt`: `landscapeWidth` and `landscapeHeight`.
- `RouteMatcher.kt`: dropped-dot channel marker.
- Their tests.

**Files:**
- Modify: `android/app/src/main/java/com/pokemmo/tool/overlay/capture/CaptureService.kt`

- [ ] **Step 1: Remove the crop dump.** Delete `saveDebugCrops`, `lastDebugSave` and its call. Keep `debugLog { … }` and `debuggable`. Logging is already limited to debuggable builds, which the spec allows.
- [ ] **Step 2: Run all unit tests.** Run `./gradlew :app:testDebugUnitTest`. Expected: BUILD SUCCESSFUL, 84 tests, 0 failures.
- [ ] **Step 3: Commit.**

```bash
git add android/app/src/main/java/com/pokemmo/tool/overlay/capture android/app/src/main/java/com/pokemmo/tool/overlay/match android/app/src/test
git commit -m "Fix capture on rotation and idle screens, match dropped channel dot"
```

### Task 2: Icon extractor and the 1–493 palette table

**Files:**
- Create: `scripts/overlay/nds.js`: ROM and NARC reader, the Nitro section finder, `bgr555ToRgba`, and `decodeTiles4bpp`. Port these from `.superpowers/spike/nds.mjs` and `render.mjs`.
- Create: `scripts/overlay/extract-icons.mjs`: the CLI, run with `npm run overlay:icons`.
- Create: `scripts/overlay/icon-palettes.json`: an array of 650 integers, where index = species and `[0] = 0`. Each value is 0, 1 or 2.
- Create: `tests/overlay/nds.test.js`
- Modify: `package.json`. Add `"overlay:icons": "node scripts/overlay/extract-icons.mjs"`.

**Interfaces:**
- Produces:
  - `openRom(buf: Buffer) -> { files: Map<string, number>, file(path): Buffer, arm9(): Buffer }`
  - `narc(buf) -> Buffer[]`
  - `section(buf, magic) -> Buffer|null`
  - `bgr555ToRgba(u16) -> [r,g,b,a]`
  - `decodeTiles4bpp(data: Buffer, widthPx, heightPx, palette: number[][]) -> Buffer` (RGBA, 8×8 tiles, row-major, low nibble first; index 0 is transparent)
  - **Output layout:**
    - `art/overlay/pokemon/{id}.png`: 32×64 RGBA, frame 0 on top and frame 1 below, for ids 1..649.
    - `art/overlay/items/ball-poke.png`: 32×32, item icon k=3.

- [ ] **Step 1: Write failing tests** in `tests/overlay/nds.test.js`, using synthetic buffers so they don't need ROMs:
  - `bgr555ToRgba(0x7FFF)` equals `[255,255,255,255]`, and `bgr555ToRgba(0x001F)` equals `[255,0,0,255]`.
  - `decodeTiles4bpp` turns one 8×8 tile with every byte `0x21` into pixels alternating palette 1 and palette 2, starting with 1 at x=0. Index 0 gives alpha 0.
  - `narc()` on a hand-built NARC with 2 files returns both payloads in order.
  - `icon-palettes.json` has length 650, every entry is in {0,1,2}, and entries 1..12 equal `[1,1,1,0,0,0,0,2,2,1,1,0]`.
- [ ] **Step 2: Run** `npx vitest run tests/overlay/nds.test.js`. Expected: FAIL, because the module is missing.
- [ ] **Step 3: Implement** `nds.js` by porting the spike.
- [ ] **Step 4: Write the 1–493 palette table.** Generate `icon-palettes.json` once from Platinum. The ARM9 file offset `0xF4781` holds one byte per species, starting at species 1. For now, set 494..649 to 0; Task 3 fills them in. Write the one-off code as a `--from-platinum <rom>` mode of `extract-icons.mjs`, so the table can be regenerated.
- [ ] **Step 5: Implement `extract-icons.mjs`.**
  - Arguments: `--black <rom>` (defaults to the Black path above) and `--out art/overlay`.
  - Pokémon icons: NARC `a/0/0/7`. The palette is the `TTLP` of file 0 (3×16 colours). The icon for species `s` is file `7 + 2s`, a 32×64 `RGCN`. Write the 32×64 PNG with sharp.
  - Item icons: NARC `a/0/2/5`, item k = files `2+2k` (`RGCN`) and `3+2k` (`RLCN`).
  - Exit non-zero if any species 1..649 is missing.
- [ ] **Step 6: Run the tests and the extractor.** Run `npx vitest run tests/overlay/nds.test.js`, then `npm run overlay:icons`. Expected: tests PASS, and 649 Pokémon PNGs plus `items/ball-poke.png` are written.
- [ ] **Step 7: Check visually.** Render a contact sheet of species 1–24 (the spike's `test-table.mjs` approach) and view it. Bulbasaur must be green, Charmander orange and Squirtle light blue.
- [ ] **Step 8: Commit.** Do not commit `art/overlay/pokemon/494-649` yet; Task 3 regenerates them.

```bash
git add scripts/overlay/nds.js scripts/overlay/extract-icons.mjs scripts/overlay/icon-palettes.json tests/overlay/nds.test.js package.json art/overlay
git commit -m "Extract Gen 5 menu and ball icons from the user's Black ROM"
```

### Task 3: Unova palette indices (494–649)

**Files:**
- Modify: `scripts/overlay/icon-palettes.json` (entries 494..649)
- Modify: `art/overlay/pokemon/494.png` … `649.png`
- Modify: `tests/overlay/nds.test.js`

- [ ] **Step 1: Write the failing test.** Every id 1..649 has `art/overlay/pokemon/{id}.png` at 32×64, and `icon-palettes.json` entries 494..649 are not all 0.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Find the table.**
  - Search Black's ARM9 and overlays, both raw and BLZ-decompressed (the spike's `blz` in `find-bw.mjs`). Look for byte runs in {0,1,2} of length at least 156 whose first values agree with a visual check of 494–499 (Victini, Snivy, Servine, Serperior, Tepig, Pignite).
  - Also try stride 2 (a male/female interleave) and offsets just after a 493-long run.
  - If found, write it with a `--from-black-table <offset>` mode.
- [ ] **Step 4: Fall back to choosing by eye if Step 3 fails.**
  - Render a sheet with one row per species 494..649 and the three palettes side by side, labelled.
  - View it in chunks of 26 and pick the palette whose colours match the Pokémon's known colouring. Record the picks in `icon-palettes.json`.
  - This is tedious but required: the spec says wrong Unova icons may not ship.
- [ ] **Step 5: Regenerate and check.** Run `npm run overlay:icons`, then view a contact sheet of 494–649.
- [ ] **Step 6: Run** `npx vitest run tests/overlay`. Expected: PASS.
- [ ] **Step 7: Commit.**

```bash
git add scripts/overlay/icon-palettes.json art/overlay tests/overlay/nds.test.js scripts/overlay/extract-icons.mjs
git commit -m "Add Unova icon palettes"
```

### Task 4: Ship the icons in the app, drop official sprites

**Files:**
- Modify: `scripts/overlay/build-overlay-data.mjs:155-171`
- Modify: `tests/overlay/build.test.js`
- Modify: `android/app/build.gradle.kts:87-96`
- Modify: `.github/workflows/android.yml` (path filters)

**Interfaces:**
- Produces:
  - `assets/overlay/icons/{id}.png` (32×64)
  - `assets/overlay/items/ball-poke.png`
  - No `assets/overlay/sprites/` folder.

- [ ] **Step 1: Write the failing test.** Extract the copy into an exported function `copyIcons(root, assetsDir) -> { icons: number, missing: number[] }`. Test it in `build.test.js` against a temp dir holding two fake PNGs: it returns `{ icons: 2, missing: [] }`, the files land in `icons/`, and any old `sprites/` folder is removed.
- [ ] **Step 2: Run** `npx vitest run tests/overlay/build.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Replace the sharp sprite loop with `copyIcons`, which copies `art/overlay/pokemon/*.png` into `icons/` and `art/overlay/items/*.png` into `items/`.
  - Push a warning for each id in `pokemon.json` without an icon.
  - `checkOverlayAssets` must also fail if `icons/1.png` is missing.
  - Add `art/overlay/**` to the workflow's path filters.
- [ ] **Step 4: Run** `npm test && npm run overlay:build`. Expected: PASS, and `icons: 649`.
- [ ] **Step 5: Commit.**

```bash
git add scripts/overlay/build-overlay-data.mjs tests/overlay/build.test.js android/app/build.gradle.kts .github/workflows/android.yml
git commit -m "Bundle ROM icons instead of official artwork"
```

### Task 5: Catch marks

**Files:**
- Create: `android/app/src/main/java/com/pokemmo/tool/overlay/ui/CatchMarks.kt`
- Test: `android/app/src/test/java/com/pokemmo/tool/overlay/ui/CatchMarksTest.kt`

**Interfaces:**
- Produces:
  - `enum class CatchMark { GRASS, SURF, ROD, CAVE, SPECIAL }`, in this display order.
  - `fun markOf(method: String): CatchMark?`, which returns null for lures.
  - `fun marksFor(spawn: Spawn): List<CatchMark>`: distinct and in enum order.
  - `fun isLureOnly(spawn: Spawn): Boolean`

- [ ] **Step 1: Write the failing tests.** The input is everything before any ` (`, so variants like "Grass (Night)" map the same as their base:

  | Method strings | Expected |
  |---|---|
  | "Grass", "Grass (Night)", "Dark Grass (Morning/Day)", "Shadow" | GRASS |
  | "Water", "Water (Night)" | SURF |
  | "Old Rod", "Good Rod (Night)", "Super Rod", "Fishing" | ROD |
  | "Cave", "Cave (Day)", "Inside", "Dust Cloud" | CAVE |
  | "Headbutt (Night)", "Rocks", "Honey Tree" | SPECIAL |
  | "Lure (Water)", "Lure (Grass/Cave)" | null |
  | "Sky Battle" (unknown) | SPECIAL |

  Also:
  - Psyduck with Grass, Water and Super Rod gives `[GRASS, SURF, ROD]`.
  - A spawn with only Lure encounters gives `isLureOnly == true`.
- [ ] **Step 2: Run** `./gradlew :app:testDebugUnitTest --tests '*CatchMarksTest'`. Expected: FAIL.
- [ ] **Step 3: Implement** `CatchMarks.kt`.
- [ ] **Step 4: Run the test again.** Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git commit -am "Map encounter methods to catch marks"
```

### Task 6: Drawer and card models

**Files:**
- Modify: `android/app/src/main/java/com/pokemmo/tool/overlay/ui/StripModel.kt`. Rename it to `OverlayModels.kt` with `git mv`.
- Modify: `android/app/src/test/java/com/pokemmo/tool/overlay/ui/StripModelTest.kt`. Rename it to `OverlayModelsTest.kt`.

**Interfaces:**
- Consumes (from Task 5): `marksFor` and `isLureOnly`.
- Produces:
  - **Drawer item:** `data class DrawerItem(val id: Int, val name: String, val marks: List<CatchMark>, val worth: Boolean)`
  - **Drawer:** `data class DrawerModel(val items: List<DrawerItem>, val cycle: List<Int>, val empty: Boolean)`. `cycle` holds the ids of worth items in item order. `empty` is true when `items` is empty.
  - **Building the drawer:** `fun buildDrawer(area: Area?, repo: OverlayRepository): DrawerModel`.
    - Items keep the spawn order of `area.spawns`, deduplicated by id, with lure-only spawns removed.
    - A null area gives `DrawerModel(emptyList(), emptyList(), true)`.
  - **Where lines:** `data class WhereLine(val mark: CatchMark, val text: String)`
  - **Level text:** `fun levelText(min: Int?, max: Int?): String?` returns `"Level 30–35"`, or `"Level 38"`, or null.
  - **Method names:** `fun methodName(method: String): String`. "Water…" becomes "Surfing", and anything else stays as is.
  - **Line text:** `fun whereText(e: Encounter): String` joins its parts with `" · "`:
    1. method name;
    2. the first rarity in sentence case ("Very common");
    3. `"Hordes of N"` if `hordeSize` is set, or `"Hordes"` if the rarities contain "Horde";
    4. the level text.
  - **Card:** `Card(name, types: List<String>, where: List<WhereLine>, rows: List<CardRow>, tip: String?, footer: String?)`. `footer` is `"${area.name} · ${area.region}"`.
  - **Card row:** `CardRow(kind, summary, via: String?, body, more)`.
  - **Building the card:** `fun buildCard(id: Int, repo: OverlayRepository, spawn: Spawn?, area: Area?, hordeCount: Int?): Card`.
  - **Horde EV text:** `evSummaryForHorde` now joins with `" · "` and gives `"+2 Atk each · +10 per horde"`.
  - **Removed:** `buildStrip`, `StripModel`, `StripItem`, `outlineKind`, `OpponentTags` and `TagChip`. Fix callers in Tasks 9–11.
- [ ] **Step 1: Rewrite the tests.**
  - `buildDrawer` on Kanto Route 6:
    - item 0 is Pidgey (16) with marks `[GRASS]` and `worth == false`;
    - Psyduck (54) has `[GRASS, SURF, ROD]`;
    - Politoed (186, lure only) and Smeargle (235) are absent;
    - `cycle` starts with 37 (Vulpix).
  - `buildDrawer(null, repo).empty`, and a lure-only area is empty too.
  - **Level text:**
    - `levelText(30,35) == "Level 30–35"`
    - `levelText(38,38) == "Level 38"`
    - `levelText(null,40) == null`
  - **Where text:** Slowpoke's Route 6 Water encounter gives `"Surfing · Very common · Hordes of 5 · Level 30–35"`.
  - **No battle-like text:**
    - Build a card for every spawn of every area.
    - Join all strings: where text, summaries and footer.
    - Assert that none matches `Regex("(?i)\\b(Lv|Nv|Niv|Lvl)\\.?\\s*\\d")`.
  - The EV horde string is updated as above.
  - Keep the existing card-row tests, adapted to `via`.
- [ ] **Step 2: Run** `./gradlew :app:testDebugUnitTest --tests '*OverlayModelsTest'`. Expected: FAIL.
- [ ] **Step 3: Implement.** Callers will not compile until Tasks 9–11. Keep the old view files compiling by deleting their bodies, or leave the app unbuildable between tasks 6 and 11 on purpose. Prefer the first option.
- [ ] **Step 4: Run** `./gradlew :app:testDebugUnitTest`. Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git commit -am "Drawer and card models with catch marks and level text"
```

### Task 7: Visibility rules and region constants

**Files:**
- Create: `android/app/src/main/java/com/pokemmo/tool/overlay/ui/Visibility.kt`
- Modify: `android/app/src/main/java/com/pokemmo/tool/overlay/capture/ScreenRegions.kt`
- Modify: `android/app/src/main/java/com/pokemmo/tool/overlay/state/OverlayStateBus.kt`
- Modify: `android/app/src/main/java/com/pokemmo/tool/overlay/capture/CaptureService.kt` (publish the suspicion)
- Test: `android/app/src/test/java/com/pokemmo/tool/overlay/ui/VisibilityTest.kt`
- Test: `android/app/src/test/java/com/pokemmo/tool/overlay/capture/ScreenRegionsTest.kt`

**Interfaces:**
- **Visibility:**
  - `data class Visible(val drawer: Boolean, val card: Boolean, val panel: Boolean)`
  - `fun visibility(state: ScreenState, battleSuspected: Boolean, drawerOpen: Boolean, cardOpen: Boolean): Visible`
    - The drawer (tab included) shows only when the state is not Battle and no battle is suspected.
    - The card shows only when the drawer shows, the drawer is open, and a card is open.
    - The panel shows only when the state is Battle.
- **Bus:** `OverlayStateBus.battleSuspected: StateFlow<Boolean>` and `fun setBattleSuspected(v: Boolean)`.
  - `CaptureService` sets it to `reading.groups.isNotEmpty()` every tick, and to false at shutdown.
- **Regions:** `ScreenRegions.DRAWER_AREA = FRect(0.28f, 0f, 0.72f, 0.42f)` replaces `STRIP_AREA`. Its width is the drawer and card width, and its bottom is the maximum card bottom.
- **Sizes:** `ScreenRegions.ICON_FRACTION = 0.025f`, applied to the long side.
- [ ] **Step 1: Write the failing tests.**
  - **Visibility:**
    - Overworld with no suspicion and the drawer open with a card gives (true, true, false).
    - Suspected gives (false, false, false).
    - Battle gives (false, false, true).
    - Idle with the drawer open gives a drawer but no card.
  - **Regions:**
    - `DRAWER_AREA` does not intersect `ROUTE`.
    - `BATTLE_PANEL` does not intersect `BATTLE` or `ROUTE`.
    - Remove the old `STRIP_AREA` assertion.
- [ ] **Step 2: Run** `./gradlew :app:testDebugUnitTest --tests '*VisibilityTest' --tests '*ScreenRegionsTest'`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run all unit tests.** Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git commit -am "Visibility rules, battle suspicion and drawer region"
```

### Task 8: Pixel primitives and theme

**Files:**
- Create: `android/app/src/main/java/com/pokemmo/tool/overlay/ui/Theme.kt`: colours from Global Constraints, `typeColor(type: String): Color`, `TagKind.labelColor()` and `TagKind.label()`.
- Create: `android/app/src/main/java/com/pokemmo/tool/overlay/ui/Pixel.kt`:
  - `class IconCache(context)`: loads `overlay/icons/{id}.png` and `overlay/items/{name}.png`, using an LRU of 96. It returns `IconFrames(frame0, frame1)?`, or null when the asset is missing.
  - `@Composable PixelIcon(cache, id, size: Dp, frame: Int = 0, modifier)`: draws an empty `Box` when the icon is null.
  - `@Composable BallIcon(cache, caught: Boolean, size)`
  - `@Composable CatchMarkIcon(mark, size)`: an 8×8 grid drawn on a Canvas with crisp rectangles.
    - Copy GRASS, SURF and ROD exactly from `G` in `.superpowers/brainstorm/857-1794402834/content/strip-x-style.html`.
    - Design CAVE (a dark arch) and SPECIAL (a small star or rock) on the same 8×8 grid, in matching style.
  - `@Composable TypePill(type)`
- Modify: `android/app/build.gradle.kts`. Add `implementation("androidx.compose.ui:ui-tooling-preview")` and `debugImplementation("androidx.compose.ui:ui-tooling")`.
- Delete: the `SpriteCache` and `Sprite` composables in `Strip.kt`.

**Type colours** (exact):

| Type | Colour | Type | Colour | Type | Colour |
|---|---|---|---|---|---|
| Normal | 9A9A6E | Fire | E8742C | Water | 4F8FE0 |
| Electric | E8C42C | Grass | 5FAF4A | Ice | 6CC8C8 |
| Fighting | C03028 | Poison | 9A4A9A | Ground | C9A752 |
| Flying | 8F7FE0 | Psychic | E0507F | Bug | 9AAA2A |
| Rock | A8913A | Ghost | 6A5A92 | Dragon | 6A3AE8 |
| Dark | 6B5A4F | Steel | A8A8C0 | Unknown | 777777 |

- [ ] **Step 1: Write the failing test.** `ThemeTest`: `typeColor("Water") == Color(0xFF4F8FE0)`, `typeColor("water")` gives the same, and `typeColor("???")` gives grey `0xFF777777`.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement**, and add a `@Preview` (debug source set) showing all 5 marks, 3 icons (16, 79, 130) and the type pills.
- [ ] **Step 4: Render the preview.** Run `android preview render`. Expected: the PNG shows crisp, unblurred pixels, with Bulbasaur-style colours correct.
- [ ] **Step 5: Commit.**

```bash
git commit -am "Pixel icon, catch mark and type pill primitives"
```

### Task 9: Drawer view and placement

**Files:**
- Rewrite: `android/app/src/main/java/com/pokemmo/tool/overlay/ui/Strip.kt` as `Drawer.kt` (`git mv`)
- Modify: `android/app/src/main/java/com/pokemmo/tool/overlay/ui/OverlayWindows.kt`

**Interfaces:**
- Consumes: `buildDrawer`, `visibility`, `IconCache`, `PixelIcon`, `CatchMarkIcon` and `DRAWER_AREA`.
- Produces: `@Composable DrawerView(model: DrawerModel, open: Boolean, selectedId: Int?, panel: Boolean, iconSize: Dp, maxWidth: Dp, onTab: () -> Unit, onItem: (Int) -> Unit, onOverflow: () -> Unit)`.
- **Tab:**
  - It hangs from the top edge, with only its bottom corners rounded.
  - **Closed:** if `model.cycle` is non-empty, show one icon at a time, advancing every 1500 ms. The shown icon swaps frames every 500 ms (the party bounce). If the cycle is empty, show a still Poké Ball (`BallIcon(icons, caught = true, iconSize)`).
  - **Open:** show a pixel up-chevron. The chevron pixels are `up` in `drawer.html` of the mockups.
  - Use a `LaunchedEffect` with `delay`, and no per-frame animation.
- **Open body:**
  - It sits above the tab, at most `maxWidth` wide, in two rows (`FlowRow`, `maxLines = 2`).
  - Each slot is the icon with a row of marks under it, each mark `iconSize * 0.34`.
  - Faded per Global Constraints when `!worth`. A selected slot gets a `0x29FFFFFF` rounded background.
  - When `model.empty`, show the text "No wild Pokémon here".
  - When the items exceed two rows, the last slot becomes "+N" and calls `onOverflow`.
    - That sets `drawerShowAll = true` in `OverlayWindows`: the row limit is lifted and the body scrolls vertically, down to at most the bottom of `DRAWER_AREA` (the card area). Any open card closes.
    - `drawerShowAll` resets to false when the drawer closes or the route changes.
- **Window:**
  - Its x is centred on `DRAWER_AREA` and its y is 0.
  - The icon size in px is `ICON_FRACTION * max(w, h)`, rounded down to a multiple of 32 if that is at least 32, otherwise left exact.
  - `drawerOpen` lives in `OverlayWindows`. It starts false and is **never reset** on route or state changes.
  - Remove `stripExpanded`, the "Looking for route…" text and the route title.
- [ ] **Step 1: Add a `@Preview`** of Route 6 open and closed (fixed data), then run `android preview render`. Expected: it matches `drawer.html`: no borders, a faded Pidgey, three marks under Psyduck.
- [ ] **Step 2: Wire it into `OverlayWindows`.** Use `visibility(...)`, collect `battleSuspected`, and call `buildDrawer(area, repo)`.
- [ ] **Step 3: Build and install.** Run `./gradlew :app:assembleDebug`, then `android run --apks=app/build/outputs/apk/debug/app-debug.apk`.
- [ ] **Step 4: Ask Austin to start the overlay and stand in Vermilion City.** Run `android screen capture -o .superpowers/screenshots/pixel/redesign-drawer.png` and view it. Expected:
  - the tab is centred and cycling;
  - opened, it shows the icons with marks;
  - nothing covers the location name or the menu.
- [ ] **Step 5: Commit.**

```bash
git commit -am "Route drawer with cycling tab and catch marks"
```

### Task 10: Card view under the drawer

**Files:**
- Rewrite: `android/app/src/main/java/com/pokemmo/tool/overlay/ui/DetailCard.kt`
- Modify: `android/app/src/main/java/com/pokemmo/tool/overlay/ui/OverlayWindows.kt` (`renderCard`, `onStripItem`)

**Interfaces:**
- Consumes: `buildCard`, `Card`, `WhereLine`, `CardRow`, `TypePill`, `CatchMarkIcon`, `PixelIcon` and `labelColor`.
- Produces: `@Composable DetailCardView(card: Card, id: Int, icons: IconCache, panel: Boolean, width: Dp, maxHeight: Dp, expandedRow: Int?, onRow: (Int) -> Unit)`.
- **Layout:** follow `card.html`, top to bottom:
  1. Header: the icon at `iconSize * 1.3`, the name, and type pills.
  2. Where lines, each starting with its mark.
  3. The tip, when present.
  4. Rows: the label in its colour at a fixed label width, the summary, then "as X" in grey, then ▸ or ▾. Thin divider lines between rows, and no boxes.
  5. The footer, right-aligned in grey.
- **Rows behave as now:** all collapsed when the card opens, one open at a time, with "More about…".
- **Window:**
  - Its width equals the measured drawer window width, and its x equals the drawer window x.
  - Its y is the drawer window bottom plus `0.005 * height`.
  - Its max height runs to the bottom of `DRAWER_AREA`, and it scrolls if longer.
- **Closing:** tapping the same icon again, closing the drawer, a route change, or a confirmed battle (state becomes `Battle`) closes the card.
  - A battle *suspicion* only hides it through `visibility(...)`. If no battle is confirmed, the card comes back with the same row open.
  - Keep `openCard` and the expanded-row index in `OverlayWindows` state, not in `remember`, so they survive the window being hidden.
- Remove `fromBattle` and the battle-card path; the battle panel expands its rows inline (Task 11).
- [ ] **Step 1: Render a `@Preview`** of the Slowpoke card collapsed and with Story open, and compare it with `card.html`.
- [ ] **Step 2: Wire the placement and closing rules.**
- [ ] **Step 3: Check on the device.** Tap Magikarp in Vermilion City, then capture the screen. Expected:
  - the card's left and right edges line up with the drawer;
  - it doesn't overlap the drawer;
  - the footer reads "Vermilion City · Kanto".
- [ ] **Step 4: Commit.**

```bash
git commit -am "Card aligned under the drawer"
```

### Task 11: Battle panel restyle

**Files:**
- Rewrite: `android/app/src/main/java/com/pokemmo/tool/overlay/ui/BattlePanel.kt`
- Modify: `OverlayWindows.kt` (panel call; `onBattleGroup` removed)

**Interfaces:**
- Produces: `@Composable BattlePanelView(groups: List<OpponentGroup>, repo: OverlayRepository, icons: IconCache, panel: Boolean, width: Dp, maxHeight: Dp)`.
- **Each group block** follows `battle.html`:
  - the header: icon, name, `×N` when `count > 1`, and `BallIcon(caught = g.caught)` at the top right;
  - the line of type pills plus `CATCH n`;
  - the `WEAK 4×` line, only if `weak4` is non-empty;
  - the `WEAK 2×` line;
  - value rows from `buildCard(id, repo, null, null, g.count).rows`. They expand inline, one at a time across the whole panel.
- **Panel:** a scrolling column with width `BATTLE_PANEL` and blocks stacked for mixed hordes.
- [ ] **Step 1: Render a `@Preview`** of an Ursaring ×5 (caught) and a Houndour (not caught), and compare it with `battle.html`.
- [ ] **Step 2: Wire the panel into `OverlayWindows`.**
- [ ] **Step 3: Run** `./gradlew :app:testDebugUnitTest :app:assembleDebug`. Expected: PASS.
- [ ] **Step 4: Commit.**

```bash
git commit -am "Restyled battle panel with inline value rows"
```

### Task 12: Panel background setting

**Files:**
- Create: `android/app/src/main/java/com/pokemmo/tool/overlay/OverlaySettings.kt`
- Modify: `MainActivity.kt`, `OverlayWindows.kt`, `Drawer.kt`, `DetailCard.kt`, `BattlePanel.kt`
- Test: `android/app/src/test/java/com/pokemmo/tool/overlay/OverlaySettingsTest.kt`

**Interfaces:**
- **Storage:** `interface KeyValue { fun getBoolean(k: String, d: Boolean): Boolean; fun putBoolean(k: String, v: Boolean) }`, with the production implementation backed by SharedPreferences `"overlay"`.
- **Settings:** `object OverlaySettings` with:
  - `fun init(store: KeyValue)`, called from `Application`, or lazily from `MainActivity` and `CaptureService`;
  - `val panelBackground: StateFlow<Boolean>`;
  - `fun setPanelBackground(v: Boolean)`.
- **Key:** `"panel_background"`, default `true`.
- **Panel off:** each view draws no background. Text and icons get a drop shadow (`Shadow(Color(0xCC000000), Offset(0, 1.5dp), 3dp)`), and icons get the same shadow via a `graphicsLayer`/`drawBehind` blur-free offset copy.
- **Live:** `OverlayWindows` collects the flow and re-renders.
- **Main screen:**
  - Add a `Switch` row labelled "Background panel" under the Start/Stop buttons.
  - Reword the sharing hint to: "When asked what to share, choose A single app → PokeMMO. Sharing only PokeMMO keeps the overlay out of what it reads."
- [ ] **Step 1: Write the failing tests** with a fake `KeyValue`:
  - the default is true;
  - `setPanelBackground(false)` updates the flow and the store;
  - a new `init` on the same store reads false.
- [ ] **Step 2: Run** `./gradlew :app:testDebugUnitTest --tests '*OverlaySettingsTest'`. Expected: FAIL.
- [ ] **Step 3: Implement** and wire it in.
- [ ] **Step 4: Check on the device.** Toggle the switch while the overlay runs. Expected: the drawer, card and panel lose their backgrounds right away.
- [ ] **Step 5: Commit.**

```bash
git commit -am "Background panel setting"
```

### Task 13: Device pass and checklist

**Files:**
- Modify: `android/DEVICE_TEST.md`

- [ ] **Step 1: Rewrite the Verify list** to cover:
  - the tab cycles (or shows a still ball in a town);
  - the drawer stays closed across a route change;
  - a two-row open drawer with marks;
  - the card aligned under the drawer;
  - the battle panel with ball, CATCH and WEAK lines and inline rows;
  - a horde ×5;
  - the drawer comes back as it was after a battle;
  - both landscape orientations;
  - the panel switch;
  - both sharing modes (single app, and entire screen with the drawer open when a horde starts).
- [ ] **Step 2: Run the list with Austin on the Pixel.** Capture each check with `android screen capture` into `.superpowers/screenshots/pixel/` and view it. Fix any misalignment in the owning task's code, with a test where the cause is in a pure function.
- [ ] **Step 3: Run the full suites.** Run `npm test` and `./gradlew :app:testDebugUnitTest :app:assembleDebug`. Expected: all PASS.
- [ ] **Step 4: Commit.**

```bash
git commit -am "Device checklist for the redesigned overlay"
```
