# Android overlay: visual redesign

Date: 2026-11-11
Status: Ready for Austin's review
Builds on: `2026-11-09-android-overlay-design.md`. Only the look and the placement change. What the overlay detects and which tags it shows stay the same.

## Why

The first on-device run on Austin's Pixel 9 Pro XL worked. Austin "REALLY" disliked the look:

- **The red outlines didn't make sense** and weren't clean.
- **The sprites were wrong.** They were the official artwork shrunk down, which clashes with the game's pixel art. He wants "the Pixel version", like the icons in his party column.
- **The card "didn't align with anything"** and was "very poorly placed".

He wants it minimal, consistent with the game's own UI, and lined up with what is already on screen.

The mockups he approved are in `.superpowers/brainstorm/857-1794402834/content/`:
- `strip-x-style.html` (catch marks, option X)
- `drawer.html` (closed and open)
- `tab-art.html` (option 4, cycling)
- `card.html`
- `battle.html`

## Goals

1. Every Pokémon image on the overlay is a Gen 5 pixel menu icon, the same kind as the party column, shown with nearest-neighbour scaling.
2. A route **drawer** at the top centre replaces the outlined strip.
3. Each icon shows **how you catch it**.
4. The **card** opens directly under the drawer and is aligned with it.
5. The **battle panel** gets the same visual language, with the same content as today.
6. An **app setting** turns the dark background panel on or off.

## Non-goals

- Changing detection, OCR, the state machine, tag rules or tag content.
- Changing what the battle panel shows. It stays "the same as the desktop app" (Austin, repeated): types, 4× and 2× weaknesses, catch rate, caught status, and value tags.
- Redesigning the main app screen, apart from adding the new setting.
- GTM (still deferred).

## Anti-goals

These would make the redesign a failure even if it works:

- **Borders or outlines** to mark value. Austin: "No border. Keep it minimal."
- **Official artwork** anywhere on the overlay.
- **Covering** the game's location name, its top-right menu, the battle name boxes, or the battle buttons.
- **The overlay's own text being read as game text.** See the constraints.
- **ROM files in git.** `roms/` and `*.nds` are already gitignored, and that has been checked. Icons *extracted* from the ROMs may be committed; see "Pixel art source".
- **Walls of text.** Explanations stay closed until tapped.

## The design (decided with Austin)

### Shared look

- **Background panel:** dark and see-through, styled like the game's top-right menu (about `rgba(28,32,42,0.82–0.86)`, rounded corners, no border). It is on by default.
- **The setting:** a switch in the app's settings turns the panel off. With it off, icons and text sit straight on the game with a soft drop shadow. This was mockup option C.
- **Text:** white, in the system sans-serif.
- **Value labels:** the PvP, Story, Utility and EV labels are coloured text (red, blue, green, grey), not boxes.
- **Types:** small solid pills in the usual type colours.

### Route drawer (top centre)

- **Position:** it hangs from the top edge, centred between the game's location name (top-left) and its menu (top-right).
- **No location name:** the game already shows it. Austin asked "Does it have to have the Location if the location is already there?"
- **Closed (the default, and kept across route changes):**
  - A small tab at the top edge.
  - The tab slowly cycles through the route's worth-catching Pokémon, about 1.5 s each.
  - Each icon bounces using its two animation frames, like the party column.
  - Austin rejected showing a number.
  - *Claude's call:* if a route has nothing worth catching, or no wild Pokémon at all, the tab shows a still Poké Ball.
- **Open:**
  - A tap on the tab opens the drawer: up to **two rows** of icons (Austin: "two rows is fine").
  - The tab stays underneath as the handle, and tapping it again closes the drawer.
  - The drawer does not open by itself on a route change (Austin: "Stay closed").
- **Icon size:** about 2.5% of the screen's long side (about 56 px on 2244 px), scaled by whole numbers if possible.
- **Not worth catching:** greyscale at about 35% opacity, with its marks dimmed too. "Worth catching" is the same `hasOutline` rule as today; only the way it is drawn changes.
- **Catch marks:** under each icon, one tiny pixel mark per way to catch it:

  | Mark | Methods it covers |
  |---|---|
  | Grass tuft | Grass, Dark Grass, Shadow (any time-of-day variant) |
  | Wave | Water, which means surfing (any variant) |
  | Rod | Old Rod, Good Rod, Super Rod, Fishing (any variant) |

  - *Claude's call, Austin did not object:* a **cave** mark for Cave, Inside and Dust Cloud. One shared **special** mark for Headbutt, Rocks and Honey Tree.
  - *Claude's call:* **lure-only** spawns (methods starting with `Lure`) are left off the drawer and the tab, because they need an item. They still appear on a card if they also spawn some other way.
  - The marks used in the mockups were drawn by hand. If the ROM has matching art (for example the rod item icons), use it instead.
- **Overflow:** *Claude's call.* If two rows are still not enough at the minimum icon size, the second row ends in "+N", and tapping it opens a scrollable full list in the card area.
- **Tapping an icon** opens the card and gives that icon a soft light highlight.

### Card

- **Position:** directly **under the drawer**, never overlapping it. Same width as the drawer, with its left and right edges lined up, and a small gap between them.
- **Header:**
  - the pixel icon, larger;
  - the name;
  - the type pills.
- **Where to catch it:** one line per method, with the same mark as the drawer, then rarity, horde size where there is one, and the level range. Levels are written **"Level 30–35"**, never "Lv"; see the constraints.
- **Value rows:**
  - one row per tag: a coloured label, a short summary, "as Slowbro" in grey when the tag comes from an evolution, and a ▸ that becomes ▾;
  - all rows are closed whenever the card opens;
  - tapping a row opens only that row, showing the 2–4 sentence explanation. This is unchanged from the first design.
- **Catching tip:** shown when present, as now.
- **Footer:** in small grey text, the location the overlay read, e.g. "Route 6 · Kanto", so a misread is visible. This replaces the location name that was on the strip.
- **Closing:** *Claude's call.* Tapping the same icon again, closing the drawer, or changing route closes the card.

### Battle panel (left side)

- **Placement is unchanged:** the left side, below the name boxes and above the Fight button.
- **Look:** the same panel, labels and type pills as the card.
- **Content per opponent block:**
  - the pixel icon, name, and "×N" for a horde of one species;
  - the caught marker, top right: the **Poké Ball item icon from the ROM** when caught, and the same icon grey and faint when not;
  - type pills and "CATCH 60";
  - a "WEAK 4×" line if there are any 4× weaknesses, then a "WEAK 2×" line;
  - value rows: closed, opening one at a time, with EV shown as "+2 Atk each · +10 per horde" for hordes.
- **Mixed hordes:** one block per species, stacked. If they don't fit, the panel scrolls.
- **Caught marker:** *Claude's call.* This is a visual change only; `CaughtDetector` and its true/false result stay as they are. Not caught and "couldn't tell" both show the grey ball.

### States and the setting (Claude's calls)

- **Battle round trip:** when a battle starts, the card closes. After the battle, the drawer comes back exactly as it was, open or closed.
- **Idle:** this means the overlay is running but no location has been read yet. The tab shows the still Poké Ball. The old "Looking for route…" text goes away.
- **Panel setting:**
  - It is saved on the phone (SharedPreferences or DataStore) and applies live to a running overlay.
  - It affects the drawer, the card and the battle panel together.

## Pixel art source

- **Where it comes from:** the art is taken from Austin's own Pokémon Black ROM. Extraction was checked in a spike (`.superpowers/spike/`).
- **Pokémon icons:**
  - NARC `a/0/0/7`. File 0 is the shared palette (`NCLR`, 3 palettes of 16 colours). Files `7 + 2·species` are the icons (`NCGR`, 32×64, 4bpp, 8×8 tiles in rows of 4, holding two 32×32 frames). The `8 + 2·species` files are female variants, usually empty.
  - Each icon needs a palette index. For species 1–493 this table is in **Platinum's ARM9 at file offset `0xF4781`**, one byte per species starting at species 1. It is checked visually against BW's icons and matches Austin's party.
  - Black stores its table some other way. A simple search and a fuzzy search did not find it. **Builder's task:** find the table for 494–649 in Black, or produce it another way, and check every icon visually.
- **Item icons:**
  - NARC `a/0/2/5`, in pairs (`NCGR`, `NCLR`), 32×32, each with its own palette. Icon `k` is files `2+2k` and `3+2k`.
  - The balls are at `k` = 0 Master, 1 Ultra, 2 Great, 3 Poké, 5 Net and 6 Dive.
  - Many slots don't fit the simple pairing; that is fine for the few icons needed.
- **The ROMs** live in `roms/`, which is gitignored. Paths and ROM names must never be committed in any way that ships ROM contents.
- **Extracted icons are committed** (Austin's decision: "I'm going to keep this as a personal project so I think C might be fine").
  - A re-runnable script extracts the icons from `roms/` into a committed folder of small PNGs: 649 Pokémon icons with both frames, plus the ball icons.
  - The Android build copies them into the app's assets the same way it copies the other overlay data, so CI and the GitHub release build work without ROMs.
  - The committed folder's location is the builder's call. It must be outside the gitignored `android/app/src/main/assets/overlay/`.
  - The old official-artwork sprites stop being bundled into the APK. The desktop app keeps its own.
- **What's on this machine:**
  - Austin's `roms/` holds Black, HeartGold, Platinum, FireRed and Emerald.
  - The spike scripts (`nds.mjs`, `render.mjs`, `items.mjs`, `find-*.mjs`) are in `.superpowers/spike/`, which is gitignored but on disk.
  - The builder works on this machine, so all of it is available. Turn the spike into a proper script; don't rebuild it from this text.

## Constraints

- **The overlay must never hide game text the OCR needs in the current state.** The open drawer and the card are taller than the old strip. They extend into `ScreenRegions.BATTLE` (y 0.08–0.28) while in the overworld.
  - That is allowed, because in the overworld there are no battle names there to hide.
  - The route name (`ScreenRegions.ROUTE`) must stay clear in every state.
  - The battle panel must stay clear of `BATTLE` in battle, as now.
  - Update `ScreenRegions` (the overlay areas) and its overlap tests per state: in the overworld, check only against `ROUTE`; in battle, check against `ROUTE` and `BATTLE`.
- **No battle-like text in the overworld.** If the player shares the **entire screen**, the overlay is in the capture, so its text can be read. No text drawn in the overworld may match the battle line pattern (`<name> Lv|Nv|Niv|Lvl <number>`). Hence "Level 30–35". Add a test.
- **Battle start with the drawer open:**
  - With entire-screen sharing, an open drawer or card can cover horde name boxes, which sit top-centre. That can delay or block battle detection.
  - *Claude's call:*
    - The setup screen keeps recommending **"A single app → PokeMMO"**. In that mode the overlay is not in the capture at all.
    - The drawer and card hide themselves at the first tick that parses any opponent line, without waiting for the 2-tick confirmation. They come back as they were if no battle is confirmed.
  - Verify both sharing modes on the device.
- **Phone:** Austin's Pixel runs at **2244×1008** in landscape (the "High" display setting, not full resolution). Layout must scale by fractions of the screen, as `ScreenRegions` already does.
- **Performance:** cycling, bouncing and opening the drawer must not noticeably raise CPU use. Use simple frame swaps, not per-frame redraws of large views.
- **Must keep working:**
  - the frame-reuse fix (the capture only gets frames when the screen changes);
  - the landscape-sized capture;
  - the dropped-dot route matching.

  These were found on the device on 2026-11-11 and are not committed yet. Commit them first, and remove the temporary debug logging and crop dumps or put them behind a debug flag.

## Left to the builder

- **Pipeline details:** the script's name and npm command, the committed folder, and how the generator copies icons into assets. The approach itself is decided: icons are committed.
- **Compose details:** animations, exact paddings and font sizes, matched to the mockups at the device's real resolution.
- **Mark art:** the cave and special marks.
- **Overflow:** the "+N" behaviour if needed.
- **Unova icons:** the palette indices for 494–649. *Claude's call:* this blocks release; wrong or missing Unova icons may not ship. If the table can't be found in Black, render every Unova icon in all 3 palettes and pick each one visually. That's 156 icons, and it's tedious but certain. Record the result as a small committed table of numbers, not art.
- **Tests:**
  - method-to-mark mapping;
  - lure filtering;
  - tab cycle contents;
  - no "Lv" text in overworld overlay strings;
  - region overlap.

## Open questions

None left.

## Decided after the builder check

- **The fade rule:** Austin confirmed 2026-11-11 that only Smogon OU and UU count as PvP value. That is the rule `hasOutline` already applies in JS and Kotlin (ruling R10 from the first build), so the code doesn't change. RU and NU still show on the card.
- **Later, not part of this redesign:**
  - PokeMMO's own tiers differ from Smogon's. For example, Ursaring was PokeMMO OU but is Smogon RU.
  - A future content change could tag by PokeMMO's tiers, using the in-game PvP statistics screen as the source. Austin would screenshot it.
