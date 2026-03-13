# Jungle Game

`Jungle Game` is an Electron idle / incremental game built around interactive tree harvesting, workers, exports, research, prestige, and ascension challenges.

The app uses an Electron shell for desktop packaging and a Vite-powered renderer. The current release line is `1.3.1`.

## What Is In The Game

- Interactive banana tree harvesting with clickable spawned bananas
- Worker and orchard automation that visibly harvests from the tree
- Export buyers, shipping lanes, cooldowns, contracts, and reputation
- Research tree, achievements, prestige (`PIP`), and ascension challenges
- Weird Science late-game layer with antimatter progression
- Local save slots, import/export saves, offline progress, and optional leaderboard integration

## Tech Stack

- Electron
- Vite
- Plain renderer-side JavaScript for core game systems
- Optional Fastify + PostgreSQL backend for the leaderboard

## Project Structure

```text
src/
  main/        Electron main process
  renderer/    Game engine, UI, assets, systems
backend/       Optional leaderboard API
docs/          Scaling and progression notes
scripts/       Release and graphics utility scripts
```

## Local Development

Install dependencies:

```powershell
npm install
```

Run the desktop app in development:

```powershell
npm run dev
```

This starts:

- the Vite renderer dev server
- Electron pointed at the local renderer URL

If you only want a production renderer build:

```powershell
npm run build:renderer
```

Run the packaged Electron app against the built renderer:

```powershell
npm start
```

## Packaging

Create a Windows installer:

```powershell
npm run dist
```

Useful build commands:

```powershell
npm run pack
npm run dist
npm run dist:publish
```

Output is written to `release/`.

Common outputs:

- `release/win-unpacked/`
- `release/Jungle Game Setup <version>.exe`

## Saves

The game supports:

- 3 save slots
- local save persistence
- JSON import/export
- offline progress
- optional file-backed saves through Electron preload support

Save-related code lives primarily in [storage.js](c:\Users\Kingc\Documents\GitHub\Jungle Game\src\renderer\storage.js) and game-state migration logic lives in [gameEngine.js](c:\Users\Kingc\Documents\GitHub\Jungle Game\src\renderer\gameEngine.js).

Current game-state schema version:

- `10`

## Graphics

The project supports modern and legacy graphics modes.

Relevant assets/scripts:

- legacy icons/textures under `src/main/legacy graphics/`
- modern texture utilities via:

```powershell
npm run graphics:alpha
```

## Optional Leaderboard Backend

The desktop game can talk to an optional leaderboard API. The backend is in `backend/`.

Backend requirements:

- Node.js 18+
- PostgreSQL

Backend quick start:

```powershell
cd backend
npm install
npm run migrate
npm run dev
```

Default local backend URL:

- `http://localhost:8787`

Deployed leaderboard URL currently used by the project:

- `https://jungle-game.onrender.com`

More backend details are documented in [backend/README.md](c:\Users\Kingc\Documents\GitHub\Jungle Game\backend\README.md).

## Troubleshooting

### Windows packaging fails with a symlink privilege error

If you see a Windows symlink privilege error while packaging:

1. Enable Developer Mode in Windows
2. Or run PowerShell / terminal as Administrator
3. Run the packaging command again

### Blank installer build

If the installed app opens to a blank screen, the usual causes are:

- the renderer was not built into `dist/renderer`
- `electron-builder` did not include the expected files
- the packaged app is older than the code you expected to ship

Start by rebuilding the renderer and then packaging again:

```powershell
npm run build:renderer
npm run dist
```

## Notes For Contributors

- Prefer `rg` for searching through the project.
- The renderer contains most gameplay logic and UI updates.
- State migrations matter. Do not add new persistent fields without updating migration/sanitization paths.
- Avoid introducing heavy frontend dependencies unless there is a real need.

## Related Docs

- [CHANGELOG.md]
- [docs/game-scaling-reference.txt]
- [docs/suggested-scaling.txt]