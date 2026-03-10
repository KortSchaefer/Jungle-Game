# Changelog
All notable changes to this project are documented in this file.

The format is based on Keep a Changelog and this project uses semantic versioning.

## [1.1.6] - 2026-03-09
### Added
- Settings toggle for graphics mode (`Modern` / `Legacy`).
- Collapsible `PIP Shop` section with compact grid layout.
- Collapsible `Achievements` section with compact grid layout.
- Automated modern texture alpha conversion script:
  - `scripts/convert-modern-textures.ps1`
  - npm command: `npm run graphics:alpha`
- Shared leaderboard integration flow improvements and proof messaging.

### Changed
- Modern texture set now pulls from `src/main/graphics/new*.png`.
- Legacy texture set remains in `src/main/legacy graphics`.
- Banana texture selection now follows tree tier progression (tier 1 -> banana 1, tier 2 -> banana 2, etc., clamped by available textures).
- Tree spawn zone moved lower by roughly 34px for improved visual placement.
- Upgrades view navigation now uses a single `Back To Main` control path (top nav toggle button).

### Fixed
- Duplicate return-to-main control in Upgrades view.
- Modern/legacy texture mode switching now updates tree and banana visuals live.
- File-lock save issue in automated texture conversion script by using temp-file replacement.

### Notes
- The modern art pack currently includes 7 tree textures (`newTree1`..`newTree7`); tier 8 reuses `newTree7`.
- Backup copies from conversion are stored under `src/main/graphics/_backup-before-alpha`.

## [Unreleased]
### Added
- New `Customize` button in the HUD next to `Settings`.
- Dedicated Customize modal for player-facing UI personalization.
- Theme controls for:
  - Top bar (`Forest`, `Slate`, `Sunset`)
  - Body background (`Meadow`, `Dusk`, `Sand`)
- Icon customization scaffold section for future avatar/icon pack releases.
- Persistent UI settings fields for customization (`topBarTheme`, `bodyTheme`, `iconStyle`) with schema version bump to `4`.
- Release script Discord webhook integration for posting new version changelog notes:
  - `scripts/release.ps1`
  - uses `DISCORD_WEBHOOK_URL` env var

### Changed
- HUD/top bar visual treatment updated to a stronger differentiated theme.
- HUD card/button/ticker contrast adjusted to remove the washed "white film" appearance.
- Banana spawn zone moved lower (around +34px) for better on-tree placement.
- Research Hut discount pipeline now applies consistently to:
  - tree harvest upgrades
  - tree tier unlock cash cost
  - tree purchase (`Add Tree`) cash cost

### Fixed
- Top bar theme now cleanly overrides default card styling using more specific selectors.
- Removed duplicate return-to-main experience in upgrades flow (single nav path remains).
- Leaderboard anti-cheat now allows `totalBananasEarned` to decrease when prestige count increases between submissions (valid prestige reset path).

### Removed
- 
