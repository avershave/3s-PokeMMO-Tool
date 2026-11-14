# Desktop app: redesign (style C) and live screens with Android parity

Date: 2026-11-13
Status: Draft for Austin's review
Base branch: `desktop-compiler-trim` (React Compiler + trimmed helper), or `main` once that branch is merged.

## Why

Austin finds the desktop app "plain and messy". On the current build:

- **Messy:** buttons are scattered around every edge of the window. The four dex buttons sit top centre, Patch Notes and Options top right, Theme and Sponsor bottom left, Feedback and the version bottom right. The main navigation is two pill rows ("Pokemon Search … Tools ▾", "Resources", "Live Route / Live Battle"). The dex windows open as pop-ups stacked over the app.
- **Plain:** dark cards on black, with large empty areas under the search bar. Only the Pokémon profile page has some character (a coloured header).

He also wants to play on PC without typing anything into the tool. The live screens should show "pretty much the same thing as if it was on the Android version".

## The approved look: style C, "type-coloured field guide"

The mockups Austin picked are in `.superpowers/brainstorm/166-1794627069/content/`:
- `direction.html`: option C (Snubbull profile)
- `live-battle.html`: the live battle screen

What defines it:

- **Layout:** a left sidebar holds all navigation; the page fills the rest.
- **Colour:** a calm dark base. Each Pokémon's own type colours its page header (tan for Normal, orange for Fire, and so on). Dual types blend the two colours in the header gradient (the builder's call). Pages that aren't about one Pokémon use a quiet neutral header.
- **Type:** Bricolage Grotesque (800) for big names and headings, Barlow for body text, Barlow Semi Condensed for numbers and facts. Load them from Google Fonts, or bundle the files locally so the app works offline (preferred; the builder's call).
- **Restraint:** the big bold name in the type-coloured header is the memorable element. Everything else stays quiet: thin row dividers instead of boxes inside boxes, and no decorative shadows or gradients outside the header.
- **Sprites:** pixel sprites, shown with `image-rendering: pixelated`.

Starting palette, taken from the mockups. The builder may tune it for contrast:

| Token | Hex | Use |
|---|---|---|
| bg | `#23262D` | page |
| sidebar | `#1C1F25` | sidebar |
| surface | `#2C3038` | raised items: ball boxes, selected nav row |
| line | `#353A44` | dividers, empty bar track |
| text | `#E9EAEE` | primary text |
| muted | `#8A8F9C` | labels, secondary text |
| live | `#7BD88F` | "reading PokeMMO" status, HP bar |

Type colours: use the standard 18 type colours. The app already has a set; reuse it if it exists.

## Navigation

```
┌────────────┬──────────────────────────────────────────┐
│ 3's Tool   │ ▓▓▓▓ type-colour header ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ Live       │ [sprite] Snubbull #209  Normal   facts…  │
│  Battle    ├──────────────────────────────────────────┤
│  Route     │ Base stats            Abilities          │
│ Look up    │ ███░░░ 60             Intimidate     1   │
│ ▌Pokémon   │ …                     …                  │
│  Areas     │                                          │
│  Hordes    │                                          │
│  TMs       │                                          │
│ My dex     │                                          │
│  Pokédex, Alpha, Event, Shiny                         │
│ Tools      │                                          │
│  Team, Items, Breeding, Daycare, Market, Type chart   │
│ ● Route 35 │  ← live status                           │
│ ⚙ Settings │                                          │
└────────────┴──────────────────────────────────────────┘
```

- **Sidebar groups:** Live, Look up, My dex, Tools. Every screen that exists today has a sidebar entry.
- **Bottom of the sidebar:**
  - **Live status:** whether the OCR helper is connected and reading, plus the current route. Clicking it opens Live Route.
  - **Settings:** holds what is now Options, Patch Notes, Resources, Sponsor, Feedback and the version.
- **Themes retired (Austin, "for now"):** the 11 themes (Classic, Neo, Red, Blue, Gold, Silver, Emerald, Diamond, Pearl, Black, White) and the Theme button go away, and style C is the only look.
  - Remove the `theme-*` classes and their CSS once no screen depends on them.
  - Ignore the saved `theme` value in localStorage.
  - The method and rarity colour customisation (`colorConfig.js`) is a separate feature and stays.
  - "For now" means: keep the colours as CSS variables in one place, so themes could come back later without touching every screen.
- **Dex pages:** Pokédex, Alpha Dex, Event Dex and Shiny Dex become normal pages instead of pop-up windows.
- **Live group:** shown only when OCR is supported and enabled (same rule as today's `ocrSupported` / `isOcrEnabled()`).
- **Window size:** the window can be narrow, for example docked beside the game. Below about 900 px wide, the sidebar collapses to icons or a menu button (the builder's call).

## Live screens (the hands-free part)

### Behaviour

- **Battle start:** when the helper reports a wild battle, the app switches to Live Battle by itself.
- **Battle end:** the app returns to the screen you were on before.
- **Route change:** walking onto a new route only updates the sidebar live status. The app doesn't switch screens.
- **Setting:** an option (on by default) turns automatic switching off.

### Live Battle content

Same as the Android battle panel:

- **Header** (type-coloured): sprite, name, type chips and the HP bar read from the game. A caught / not caught status sits on the right. The existing caught toggle stays reachable from here.
- **Catch chance:**
  - Poké, Great and Ultra Ball percentages, using the Pokémon's catch rate and current HP.
  - "Better here": known balls that beat the Ultra Ball, each with its condition (Quick Ball on turn 1, Dusk Ball at night or in caves, …).
  - "More balls ▸": the rest.
  - Port the Android logic and notes exactly: `android/.../battle/Catch.kt`, `Catch.view(...)`, the `Ball` list and the condition notes. Status conditions stay out, as on Android (Austin: "Don't worry about status for now").
- **Matchups:** 4× and 2× weaknesses and immunities.
- **Why keep it:** the PvP, Story, Utility and EV tags, in the Android order (EV last). The EV tag gives the EV yield. Austin asked for "IV", but neither the game nor Android shows a wild Pokémon's IVs, so EV yield stands in.
- **Hordes:** grouped like Android's `BattleParser.group`. Each species gets one block, stacked, showing the count ("×5"), the level range and the lowest HP in the group. That HP drives the catch chances. Blocks are more compact than a single battle, so a mixed horde fits without much scrolling.
- **Which battles:** any battle the helper detects, the same as Android. The helper can't tell wild, trainer and PvP battles apart, and this design doesn't add that.

### Live Route content

Same as the Android route drawer and card:
- the Pokémon on the current route, each with its pixel icon
- how you catch it (the encounter method / catch mark)
- whether you've caught it
- clicking one shows its tags; a link opens its full profile page

### What has to be built for this

- **Per-opponent reading in the PC helper.** `LiveRouteOCR` sends battle names only today (`SendAllFormats` in `Program.cs`, which sends four formats per message). Its battle loop also has limits:
  - It keeps at most 2 names.
  - It drops repeats (the `seen` set), so a horde of 5 Gloom becomes one "Gloom".
  - It strips "Lv N".
  - It reads one area of the screen without any per-name position.

  Change it to report every opponent, in on-screen order, each with:
  - **Name**, repeats kept.
  - **Level:** Nest Ball needs it, and Android uses "Lv N" to pick out name lines.
  - **HP fraction:** use the Android approach (`HpBar.kt`). Measure the green/yellow/red fill run under each name box, using Tesseract's line positions to find the boxes, then round to whole percent.

  Wire format:
  - Add the per-opponent data as a new field in the rich JSON message (`{"type":"battle","text":…,"raw":…,"conf":…}`), for example `"opponents":[{"name":"Gloom","lv":21,"hp":0.85},…]`.
  - Keep `text` and the other three formats as they are, so older renderers still work.
  - Linux shares this code through a partial class.
  - The battle screen area may need widening to cover a full horde (the builder's call).
- **PC HP calibration.** `HpBar.kt`'s bar width (12.34% of screen width) was measured on a phone. Work out the PC equivalent relative to the captured game window, so it holds across window sizes. Test against real PC battle captures:
  - Austin plays on PC, and the helper already saves its battle captures when `OCR_IMAGE_DEBUG` is on.
  - Collect captures of one wild Pokémon and of a horde, at two window sizes, as test fixtures.
  - **Gitignore the fixtures** the way the Android real-screenshot test does, and skip that test when they're absent, so CI still passes.
- **Catch maths in JS.** A renderer module ported from `Catch.kt`. Port the cases from `CatchTest.kt` too, so both apps give the same numbers.
- **Tag and dex data.** No new data pipeline is needed.
  - **Tags:** use the committed `public/data/overlay/tags.json`. It's the same file Android downloads, and `android.yml` checks it's up to date. Vite already copies it into every desktop build, so the tags ship in releases.
  - **Ball inputs** (catch rate, speed, Moon Stone, friendship): compute them in the app from the committed sources the build script uses (`src/lib/dex.js`, `data/catch-rates.json`).
  - **Hub-enriched data** (`.local/`, `android/app/src/debug/assets/`): the desktop app doesn't use it, so there's no way for it to end up in a desktop build.
- **Screen-capture protection:** call Electron `setContentProtection(true)` so the tool window never shows up in captures. This was the deferred upgrade item 1. Put it behind a setting, default on. Note in the setting that it also hides the window from Discord or OBS window capture.

## How it gets built: approaches

1. **Rebuild screen by screen inside a new shell.** Chosen by Austin.
   - First the new sidebar shell and the shared building blocks, with colours and fonts defined once as CSS variables.
   - Then each screen moves out of `App.jsx` into its own file and is restyled as it moves.
   - Screens not yet moved keep working inside the new shell.
2. **Restyle in place.** Fastest. But `App.jsx` has 276 inline `style={{…}}` blocks on top of a 1,768-line `index.css`, so a stylesheet change can't make it consistent, and the tangle stays.
3. **Rewrite from scratch.** Cleanest. But it risks losing features the app has gathered (caught lists, daycare manager, OCR settings, chat-log auto-catch), and nothing is usable until it's all done.

### Order

Each stage leaves the app working and gets tried by Austin before the next one starts.

1. **Shell and Pokémon profile:**
   - sidebar, Settings page, live status
   - design tokens and shared components (page header, panel, stat bar, type chip, row list)
   - the Pokémon search and profile page
2. **Live:**
   - helper HP reading
   - JS catch module
   - desktop tag data
   - Live Battle and Live Route screens
   - automatic switching
   - content protection
3. **Dex pages:** Pokédex, Alpha, Event and Shiny become pages.
4. **The rest:** Areas, Hordes, TMs, Team Builder, Items, Breeding, Daycare, Market, Type chart.

## Goals

1. Everything is reachable from one sidebar. Nothing is pinned to the window edges.
2. Every screen uses the style C tokens and shared components.
3. During play, the app shows the battle info, with catch chances from live HP, without any typing or clicking.
4. Catch percentages match the Android app for the same Pokémon and HP.

## Non-goals

- Changing what the search, dex, team, breeding, daycare or market features do. Only their look and placement change.
- Reading IVs (the game doesn't show them in battle).
- Status conditions in the catch maths.
- An always-on-top overlay over the game window (Austin: "It does not have to be on top of the game").
- Changing the Android app.

## Anti-goals

- **A half-redesigned app that's messier than today.** Every stage must look finished on the screens it touches.
- **Features lost in the move.** Caught, alpha and shiny tracking, settings, method and rarity colour customisation, chat-log auto-catch and update checks must all keep working.
- **Committing generated or Hub-derived data** (see `.gitignore`: `.local/`, `android/app/src/debug/assets/`, `android/app/src/main/assets/overlay/`).
- **Automated input of any kind to PokeMMO.** The helper only captures the screen.

## Constraints

- Electron + React 19 + Vite 8, with React Compiler on (from `desktop-compiler-trim`). New components must follow the rules of hooks: no hooks after an early return.
- The OCR helper is .NET 10 (`LiveRouteOCR`), published trimmed (`TrimMode=partial`). New code must survive trimming: no reflection-only JSON.
- CI (`ci.yml`) runs `npm test`, `npm run build` and the helper build on Ubuntu and Windows. All must pass.
- Commits carry no Co-Authored-By lines. Branches are pushed to `avershave/3s-PokeMMO-Tool`, with PRs against its `main`.

## Left to the builder

- File and component structure, CSS approach (plain CSS variables vs. modules), and routing (a `mode` state like today is fine).
- Exact spacing, sizes and the narrow-window behaviour.
- Bundling fonts locally vs. Google Fonts.
- How dual-type headers blend.
- Where the desktop copy of the generated data lives, provided it's gitignored.
