# PokeMMO Android Overlay: Design

Date: 2026-11-09
Status: Ready for Austin's review

## Intent

The desktop app (Electron + React, this repo) helps PokeMMO players on PC. Austin plays PokeMMO on an Android phone and wants that help on the phone, drawn on top of the running game.

There are two jobs:

1. **Live route and battle info.** When the player steps onto a route, show what spawns there. When a battle starts, show what they're fighting. This works like the desktop app's Live Route and Live Battle views.
2. **"Is it worth catching?"** For every spawn, say whether it has value and why: PvP, story team, utility (Pay Day, Pickup, Synchronize…), EV training, and later GTM resale. Austin wants quick lookups, and also to *learn the game's meta* as he plays. The reasons matter as much as the labels.

"Progress" in the original ask means sizing up each route ("what's here and is any of it worth anything?"). It does not mean a caught-list checklist.

## Goals

- An overlay over PokeMMO on Android that updates itself as the player changes route and enters or leaves battle. No manual route picking needed.
- A slim **top strip** for route spawns (layout chosen from mockups, described below).
- A **live battle view** in the first version, showing the same information as the desktop Live Battle panel.
- **Value tags with reasons** on every spawn, short by default and expandable on request.
- Built for Austin's own phone first, but release-ready: shipped as an APK on GitHub Releases of **Austin's fork, `avershave/3s-PokeMMO-Tool`** (decided by Austin). It moves upstream to `muphy09/3s-PokeMMO-Tool` only if that maintainer wants it. A Play Store listing may come later.

## Non-goals (first version)

- **GTM entirely.** That means no GTM tag, no demand list, and no price guide. Austin decided to wait on GTM because it was getting too complicated. See the GTM section for the research to pick up later.
- Caught-list or account-progress tracking.
- Team builder, breeding, daycare, horde search and the other desktop pages. The Android app is an overlay, not a port of the full app.
- iOS.

## Anti-goals (would make it a failure even if it works)

- **Anything that breaks PokeMMO's rules.** That means no reading game memory, no network interception, and no automated input or auto-scrolling. The Code of Conduct bans these, and they risk the player's account. Only read pixels that are already on the screen.
- Covering so much of the game that it's annoying to play with. That is why the strip was chosen over a side drawer.
- Bare labels with no explanation. Austin said "Story" alone is useless.
- Walls of text by default. Explanations must be opt-in.
- Presenting guesses as facts. Smogon tiers must be labeled as Smogon, not PokeMMO.

## What the player sees

Mockups from the brainstorming session are in `.superpowers/brainstorm/1817-1794241924/content/`. The chosen ones are `overlay-layout-v2.html` (option B) and `strip-detail-card-v2.html`.

### Route strip (decided)

- A slim bar centered along the top edge of the screen, always visible while active.
- It shows the route name and every spawn's sprite.
- Spawns with any value tag get a colored outline. Spawns with none are dimmed.
- It overflows into "+N" when there are too many sprites to fit. Tapping "+N" reveals the rest.
- Tapping a sprite opens the **detail card**.

### Detail card (decided)

- **Header:** sprite, name, rarity, encounter method, and types.
- **One row per value tag:** a colored tag, a few words of summary (e.g. "Story · Alakazam: fast, hits hard"), and a ▸ chevron.
- **Expansion:** tapping a row expands *only that row* into a 2–4 sentence explanation, with a "More about X ▸" link to a longer meta explainer. The collapsed state is the default every time.
- **Catching tip:** an optional line like "Abra teleports on turn 1, so lead with Sleep", shown when present in the data.

### Battle view (decided: match desktop)

- When a battle is detected, the strip switches to the opponent(s), including all members of a horde. When the battle ends, it switches back to the route.
- For each opponent, show what the desktop `LiveBattlePanel` (`src/App.jsx`, ~line 4059) shows:
  - types
  - 4× and 2× weaknesses
  - catch rate
  - whether it's caught
- Each opponent also gets the same value tags, and tapping one opens the same detail card.
- Laying out a 5-Pokémon horde within the strip is left to the builder.
- **Caught status.** *Claude's call.* Read the game's own caught marker, the Poké Ball icon after the gender symbol in wild battle name boxes (confirmed in screenshots). The phone keeps no caught list.

### Value tags

| Tag | Meaning | Source (first version) |
|---|---|---|
| PvP | Used on competitive teams | Smogon Gen 5 sets/tiers, already fetched by `src/services/smogonService.js`. Labeled "Smogon Gen 5, PokeMMO may differ". Later: PokeMMO's own tier list (`monsters.json` has a `tiers` field, but it's all "Untiered" today). |
| Story | Good pick for a playthrough team | Hand-curated shortlist, ~100–150 Pokémon across 5 regions, each with a one-line reason. Claude drafts it; **Austin reviews.** |
| Utility | Useful job outside battle strength | Generated by rules from abilities and moves in `data/monsters.json`, e.g. Pickup, Synchronize, Pay Day, False Swipe, Thief, Sweet Scent, Compound Eyes. Each utility has one shared explanation, roughly 20–30 written in total. |
| EV | EV yield for training | Generated from `yields` in `data/monsters.json`. One shared explanation. |
| ~~GTM $~~ | Sells well | **Not in the first version.** Reserved for later. |

Explanations are written **once per reason, not once per Pokémon**. That keeps about 650 Pokémon manageable.

**Tag and outline rules (agreed with Austin):**

- **EV** shows on the detail card but does **not** count toward the strip's colored outline. Nearly every Pokémon has an EV yield, so counting it would light up everything.
- **PvP** means a Smogon Gen 5 set in **OU, UU, RU or NU** only. LC, ZU, PU, Ubers, 1v1, Monotype, CAP, VGC and Doubles don't count.
- **Utility** counts **abilities and level-up moves only**, not TM or tutor moves. Otherwise moves like Thief are on almost everything.
- **Tags carry down evolution lines, labeled.** A Pokémon earns the tags of what it evolves into, shown with the source, e.g. Abra: "PvP (as Alakazam)", "Story (as Alakazam)". The Pokémon's own tags show without a label.
- A spawn gets the colored outline if it has any PvP, Story or Utility tag, its own or carried down.

## Data

- **Existing data, reused:** spawns per area (`public/data/areas_index.json`, `public/data/pokemmo_locations.json`), Pokédex and moves/abilities/yields/held items (`data/monsters.json`), catch rates (`data/catch-rates.json`), and Smogon sets (fetched at runtime by the desktop app). Both apps must keep reading the same source files so they don't drift apart.
- **New: a tag data file.** It lives in this repo. It holds:
  - the tag rules and per-Pokémon tag overrides
  - the story shortlist with reasons
  - all explanation text and catching tips

  It is shaped so the desktop app could adopt it later.
- **Updates without app updates:** the Android app ships with a bundled copy of all data, and on launch it checks for a newer tag file at a fixed raw GitHub URL on the fork's `main` branch (`avershave/3s-PokeMMO-Tool`). A meta change means editing the file and pushing, nothing more. Players can propose corrections through GitHub issues.
- The schema should leave room for a GTM tag and a future price source to plug in later. That source will be per species, possibly with IV and nature detail. Don't build any of it now.

## How it gets built (Claude's calls unless noted)

- **Native Android app in Kotlin.** *Claude's call.* An overlay over another app needs native Android APIs:
  - the "display over other apps" permission, for drawing the strip and card
  - the screen-capture permission (MediaProjection) with a foreground service, for reading the route name and battle names off the screen
- **On-device OCR.** *Claude's call; the specific library is the builder's.* Nothing leaves the phone. This mirrors what `LiveRouteOCR/` (C#, Tesseract) does on desktop: crop fixed screen regions, read text, fuzzy-match against known area and Pokémon names.
- **Code location:** an `android/` folder in this repo. *Claude's call.* The build copies the shared JSON data in from the existing paths.
- **Release:** an APK attached to GitHub Releases on the fork (`avershave/3s-PokeMMO-Tool`), built in CI there.

## GTM: research findings (deferred, for later)

Findings (web research, 2026-11-09):

- PokeMMO has no official data feed.
- The in-game market is officially the "GTL".
- The only live price source is PokeMMO Hub's community API (`apis.fiereu.de/pokemmoprices/v1`). It covers **items only**, not Pokémon. Its owners have objected to third-party use (pokemmo.info removed prices at their request).
- No source anywhere covers Pokémon listings by species, IVs or nature.

Options for when GTM is picked back up, as a separate design:

- A hand-made "sells well" list, drafted by Claude, reviewed by Austin, and labeled "community estimate". A general IV and nature price guide could go with it (rough tiers per pikammo.fr: 1×31 ≈ 5k up to 5×31 ≈ 900k+, right nature 2–3×).
- A "GTM reader". While the player browses the GTM themselves, the overlay reads the listings they scroll past with OCR and builds a local price history. Before releasing it to others, ask PokeMMO staff whether it's allowed. Sharing prices across players would need a server.
- Ask the PokeMMO Hub team for permission to use their item prices. This would let the card show what a wild Pokémon's held items sell for, useful for Thief and Pickup farming.

Austin sees GTM as a big feature. It's deferred because of complexity, not because it's unimportant.

## Left to the builder

- OCR library and approach, capture frequency, battery and performance tuning.
- How route and battle text regions are located on the mobile UI. They will differ from desktop. This needs real phone screenshots, see open items.
- The exact tag data file schema and where the rules engine lives.
- The strip's handling of hordes and overflow, its drag and position, and how to pause or hide it.
- Exact wording of explanations, apart from the story list, which Austin reviews.
- Minimum Android version.
- Route names that exist in more than one region (desktop asks the player to pick one), and cleanup of bad rows in `areas_index.json` such as `"Horde)"` and `"And Chinchou"`.
- Whether sprites and Smogon data are bundled or fetched.

## What the mobile screen looks like (from public screenshots)

These are reference screenshots of the new mobile UI (late Oct 2026), taken by other players on 20:9 phones. They're in `.superpowers/screenshots/`. The source URLs are on forums.pokemmo.com.

- **Location name:** large white text in the top-left, e.g. "Ecruteak City CITY · CH 1" or "Vermilion City INSIDE · CH 1". The day, time, season and weather sit under it. This is a clean OCR target. Old-UI screenshots (pre-Oct 2026) show no location name at all, so only the new UI is supported.
- **Battle name boxes:** "Name Lv. N ♀/♂" plus an HP bar. A single opponent's box is top-left. In a horde, the boxes form 2 rows (3 + 2) across the top-center.
- **Caught marker:** a Poké Ball icon after the gender symbol, shown in wild battles for species already caught. Read it from the screen. The "mark caught" fallback isn't needed.
- **Language:** the level label is localized (Spanish "Nv." vs English "Lv."), and other client languages may localize Pokémon names. The first version supports English; other languages are not ruled out.
- **Busy areas:** the top-right has the game's status bar and menu. The right edge has the party column. The bottom-center has the hotbar. In battle, the bottom corners have the action buttons.
- **Placement conflict (resolved below):** a top-center strip fits the overworld, but in a horde battle it would cover the name boxes. Android screen capture also records overlays, so the strip would block the text the OCR needs to read.

### Placement (decided with Austin, from the real-screenshot mockup `placement-real.html`)

- **Overworld:** the strip sits top-center, between the game's route name (top-left) and its status and menu panel (top-right). It doesn't overlap either.
- **Battle:** the overlay moves to the empty space on the left, below the name boxes and above the Fight button. It slides back to the top when the battle ends.
- **Horde of one species:** collapses to one entry, "Ursaring ×5", with EV shown per Pokémon and per horde ("+2 Atk each, +10 per horde"). A mixed horde lists each species.
- **Rule:** the overlay never sits over an area it reads with OCR.

## Open items

- Screenshots from Austin's own Pixel 9 Pro XL, in English, are still wanted to confirm positions at his UI scale. Wild single battle and outdoor route shots in the new UI are the main gaps.
- The story shortlist needs Austin's review once drafted.
