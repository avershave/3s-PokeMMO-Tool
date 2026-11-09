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
4. Tap **Start overlay**. On the consent screen choose **PokeMMO** as the app to share (or the entire screen). Sharing only the PokeMMO window keeps the overlay out of the capture.
5. Open PokeMMO and play.
6. Tap **Stop overlay** in the app (or the notification) when done.

## Verify

- [ ] The strip shows the correct route within about 2 s of entering it.
- [ ] A wild battle swaps to the panel with correct weaknesses and catch rate, and caught matches the in-game ball.
- [ ] A 5-horde shows "x5", and a mixed horde shows each species with its own count.
- [ ] Standing still after a battle ends clears the panel and the strip returns.
- [ ] Pressing Start while PokeMMO is already in landscape works.
- [ ] Both landscape orientations work (camera on the left and on the right): the strip and panel line up with the game and do not cover the route name.
- [ ] Oreburgh City and Mistralton City show "No wild Pokémon here" with the right name, not Oreburgh Gate or Mistralton Cave.
- [ ] The panel returns to the strip after the battle.
- [ ] Nothing covers the route name or the opponent names.
- [ ] Tapping a sprite opens the card, and tapping a row expands only that row.
- [ ] Main screen re-checks permissions on return from settings, and Start is disabled until overlay permission is granted.

## Screenshot

```
adb exec-out screencap -p > shot.png
```

## Tuning if positions are off

- `app/src/main/java/com/pokemmo/tool/overlay/capture/ScreenRegions.kt`: adjust the region constants against `shot.png`.
- `app/src/main/java/com/pokemmo/tool/overlay/battle/CaughtDetector.kt`: adjust the thresholds.
- Re-run the regions test: `JAVA_HOME="$LOCALAPPDATA/Programs/jdk-17" ./gradlew :app:testDebugUnitTest --tests '*ScreenRegionsTest'`
