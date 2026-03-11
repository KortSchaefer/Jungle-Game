# Changelog
All notable changes to this project are documented in this file.

The format is based on Keep a Changelog and this project uses semantic versioning.

## [1.2.0] - 2026-03-11
### Added
- Ascension challenge UX overhaul:
  - Pinned compact challenge HUD strip with live status/timer/objective count.
  - Challenge start confirmation flow with clear temporary-rule warning.
  - Improved challenge state presentation (`Locked`, `Available`, `Active`, `Failed`, `Completed`).
- First Ascension challenge content pack (7 playable challenges) covering:
  - click-focused play
  - export-focused play
  - anti-automation constraints
  - timed efficiency runs
  - late-game/prestige-era challenge flow
- Expanded ascension reward catalog with additional permanent boosts, utility unlocks, badges, and titles.
- Challenge reward previews by rank now display owned vs unowned rewards in the challenge hub.
- Challenge result summaries now include newly earned reward names.

### Changed
- Upgrades view layout cleanup:
  - Ascension Challenges moved to the bottom and converted to a collapsible dropdown panel.
  - Removed `CEO Emails` card from Upgrades.
  - Removed `Upgrade Name Catalog` card from Upgrades.
- Main page `Tree Harvest Upgrades` section is now collapsible via dropdown.
- Challenge cards and objective trackers now use incremental DOM updates instead of full section HTML rebuilds each render cycle.
- Documentation refreshed for challenge/reward progression:
  - `docs/game-scaling-reference.txt`
  - `docs/suggested-scaling.txt`

### Fixed
- Eliminated stale challenge reward UI references by fully using rank-based reward previews.
- Improved challenge flow clarity around abandon/complete states and active run visibility.

### Removed
- Legacy changelog history entries from this file to start a clean 1.2.0 release baseline.
