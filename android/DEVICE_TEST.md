# On-device test checklist (Pixel 9 Pro XL)

## Install

1. Generate the overlay data (from the repo root):
   ```
   npm run overlay:build
   ```
2. Enable USB debugging on the phone and plug it in.
3. Confirm it is listed:
   ```
   adb devices
   ```
4. Install the debug APK (Git Bash, from `android/`):
   ```
   cd android
   JAVA_HOME="$LOCALAPPDATA/Programs/jdk-17" ./gradlew :app:installDebug
   ```

## What to tap, in order

1. Open **3s PokeMMO Overlay**.
2. Tap **Grant overlay permission**, enable "Display over other apps", go back. The overlay item should show a check mark.
3. Tap **Allow notifications** (Android 13+) and accept.
4. Tap **Start overlay**. On the consent screen choose **A single app → PokeMMO**. Sharing only PokeMMO keeps the overlay out of what it reads. (Entire screen also works; see the last checks.)
5. Open PokeMMO and play.
6. Tap **Stop overlay** in the app (or the notification) when done.

## Verify

The overlay icons come from your own Black ROM (`npm run overlay:icons`, committed under `art/overlay/`).

Drawer (top centre):
- [ ] The tab hangs from the top edge between the location name and the menu, and never covers either.
- [ ] On a route with worth-catching Pokémon the tab cycles them (about 1.5 s each) with the party bounce. In a town, or with nothing worth catching, it shows a still Poké Ball.
- [ ] Tapping the tab opens up to two rows of icons with catch marks under them (grass, wave, rod, cave, sparkle). Faded icons are not worth catching. No lure-only Pokémon appear.
- [ ] On a route with more than two rows, the last slot reads "+N"; tapping it shows all of them in a scrolling list.
- [ ] The drawer stays as it is (open or closed) across a route change.
- [ ] Oreburgh City and Mistralton City show "No wild Pokémon here" when opened, not Oreburgh Gate or Mistralton Cave.

Card:
- [ ] Tapping an icon opens the card directly under the drawer, with its left and right edges lined up and a small gap.
- [ ] It shows where to catch it with marks and "Level 30–35" (never "Lv"), and the footer names the location read, e.g. "Vermilion City · Kanto".
- [ ] Tapping a row expands only that row; tapping the same icon again, closing the drawer or changing route closes the card.

Battle:
- [ ] A wild battle hides the drawer and shows the panel on the left, below the name boxes and above Fight.
- [ ] The panel shows icon, name, ball (colour when caught, grey when not), type pills, CATCH, WEAK 4×/2×, and value rows that open inline.
- [ ] A 5-horde shows "×5" and EV "each · per horde"; a mixed horde stacks one block per species.
- [ ] After the battle the drawer comes back exactly as it was (open or closed), and any card is closed.

Everything else:
- [ ] Both landscape orientations (camera on the left and on the right) line up and cover nothing the game needs.
- [ ] Pressing Start while PokeMMO is already in landscape works.
- [ ] The **Background panel** switch on the main screen removes and restores the dark panels right away while the overlay runs.
- [ ] Sharing **Entire screen** with the drawer open: walking into a horde still detects the battle (the drawer hides as soon as a name line is read).
- [ ] The main screen re-checks permissions on return from settings, and Start is disabled until overlay permission is granted.

## Screenshot

```
android screen capture -o shot.png   # or: adb exec-out screencap -p > shot.png
```

## Tuning if positions are off

- `app/src/main/java/com/pokemmo/tool/overlay/capture/ScreenRegions.kt`: adjust the region constants against `shot.png`.
- `app/src/main/java/com/pokemmo/tool/overlay/battle/CaughtDetector.kt`: adjust the thresholds.
- Re-run the regions test: `JAVA_HOME="$LOCALAPPDATA/Programs/jdk-17" ./gradlew :app:testDebugUnitTest --tests '*ScreenRegionsTest'`
