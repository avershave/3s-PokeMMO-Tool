# 3s-PokeMMO-Tool

Pokemmo Tool is a desktop companion app for **PokéMMO** that enhances your gameplay with live route tracking, encounter data, and a full Pokédex.
It is designed for **Generations 1–5 only**, matching PokéMMO’s supported regions.

---

## 🚀 Features
- 📍 **Live Route & Battle Tracking** – See what Pokémon can be found on your current route in real time, and check the Pokémon you're battling!. (Windows & Linux; works best with high UI scaling in game)
- 📊 **Complete Pokédex** – Catch rates, moves, methods, held items, base stats, and locations for every Gen 1–5 Pokémon. Instantly filter by Kanto, Johto, Hoenn, Sinnoh, or Unova.
- 🧭 **Deep Filtering Search** – Filter Pokémon by type, egg group, abilities, moves, region, and held items. Search Locations, Areas, Hordes, TMs & more!
- 🕹️ **Caught List & Encounter Methods** – Mark Pokémon you've caught inside a Caught List and filter encounter methods for easier hunting! (Lure, Cave, Horde, Grass, etc)
- 🎨 **Custom Color Schemes** – Choose your own colors for rarity and encounter methods.
- 🪄 **Team Builder** – Quickly assemble & save your team to view weak areas - Save important teams for reference.
- 🌍 **Horde Search** – Detailed Horde Search page brings Horde locations for every region. Filter by EV yield, encounter method, horde size, 
- 🔄 **Auto-Updater** – Stay up to date by using the .exe installer on the initial download (.exe installer enables auto-update).
- ⚙️ **UI Scaling** – Adjust the app's interface scale from the Options menu.

---

## 📥 Installation
1. Go to the [Releases](https://github.com/muphy09/3s-PokeMMO-Tool/releases) page.
2. Download the build for your OS:
   - **Windows** – `.exe` installer (includes Live Route & Live Battle)
   - **Linux** – `.AppImage` bundle (includes Live Route & Live Battle with bundled OCR assets)
   - **macOS** – `.dmg` installer (no Live Route & Live Battle)
3. Run the app

> ⚠️ Windows may show a security prompt for unsigned executables. This is normal and safe to continue.

---

## 📱 Android overlay

A phone companion that shows tags for the Pokémon you are battling as an overlay on top of PokéMMO.

**Install**
1. Download `3s-PokeMMO-Overlay-<version>.apk` from the [Releases](https://github.com/avershave/3s-PokeMMO-Tool/releases) page.
2. Allow installing from unknown sources when Android asks, then open the APK.

**Permissions**
- Display over other apps (draws the overlay)
- Notifications (keeps the overlay service running)
- Screen capture (choose **PokéMMO** when asked)

**Privacy:** Screen text is read on your phone only. The only network request is downloading tag updates from GitHub.

**Suggest a tag fix:** open an issue at [avershave/3s-PokeMMO-Tool/issues](https://github.com/avershave/3s-PokeMMO-Tool/issues).

Device testing notes: [android/DEVICE_TEST.md](android/DEVICE_TEST.md)

---

## 📊 Install telemetry

The desktop app now records an anonymous install identifier the first time it is launched. On startup the Electron main process sends a single POST request containing:

- A random install ID (stable per machine)
- App version (e.g. `3.2.5`)
- OS platform (`windows`, `mac`, or `linux`) and CPU architecture
- Timestamps for when the install was first seen and last reported

Each successful POST is persisted so the app only reports a given version/OS combo once per device.

### Telemetry endpoints

- **Install reports:** `https://telemetry.pokemmo-tool.app/install`
- **Aggregated stats:** `https://telemetry.pokemmo-tool.app/stats`

Both routes accept an optional bearer token via the `Authorization` header. When the
`POKEMMO_TOOL_TELEMETRY_KEY` environment variable is populated the desktop app includes
the token automatically.
