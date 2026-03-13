# Changelog
All notable changes to this project are documented in this file.

The format is based on Keep a Changelog and this project uses semantic versioning.

## [1.3.0] - 2026-03-13
### Added
- Added a new top-level `Casino` view beside `Main` and `Upgrades`.
- Added the `Card Shark License` PIP upgrade to unlock the casino for `20 PIP`.
- Added a dedicated blackjack system with persistent casino state and save migration support.
- Added full blackjack table actions:
  - Hit
  - Stand
  - Double Down
  - Split
  - Insurance
  - Surrender
  - Cancel Round
- Added persistent blackjack and casino stat tracking, including wagers, wins, losses, pushes, blackjacks, doubles, splits, insurance usage, and streaks.
- Added real card texture support using the imported PNG card set and monkey card back.
- Added a collapsible `Player Stats` grid below the blackjack table.

### Changed
- Reworked renderer view switching to support `Main`, `Upgrades`, and `Casino` without routing.
- Moved blackjack into its own casino screen built as a reusable foundation for future casino games.
- Updated the casino layout so the dealer and player hand sections fill the left play area more cleanly.
- Reduced excess spacing in blackjack hand panels and tightened text layout inside the casino table.
- Removed artificial card framing so the imported card PNGs define the visual card shape directly.
- Adjusted card rendering to preserve the PNG aspect ratio without stretching.
- Reduced overall blackjack table vertical footprint while keeping the play area readable.
- Moved blackjack stats out of the side rail and into a dropdown below the table to keep the action area cleaner.

### Fixed
- Fixed casino view persistence to work with the newer top-view UI settings model.
- Fixed card image stretching caused by forcing textures into a boxed card frame.
- Fixed unnecessary vertical gaps between dealer/player labels, totals, and hand summaries.
- Fixed casino unlock visibility so the tab stays hidden until the PIP unlock is purchased.
- Fixed challenge and prestige transitions to safely cancel unresolved casino rounds without corrupting meta progress.

### Notes
- The casino currently ships with blackjack only, but the screen and state model are structured for future games.
- Card textures are loaded from `src/main/PNG-cards-1.3`.
- Save schema was extended to include persistent casino and blackjack state.
