# Changelog
All notable changes to this project are documented in this file.

The format is based on Keep a Changelog and this project uses semantic versioning.

## [1.3.1] - 2026-03-13
### Added
- Added `Mississippi Stud` as a second casino game with persistent state, stats, paytable display, and full renderer integration.
- Added `Baccarat` as a third casino game with Player / Banker / Tie bets, banker commission handling, persistent state, and tracked baccarat statistics.
- Added separate casino PIP unlocks:
  - `Riverboat License` for `Mississippi Stud` (`20 PIP`)
  - `High Roller License` for `Baccarat` (`20 PIP`)
- Added a dedicated stable casino card DOM renderer for keyed card-slot updates instead of repeated casino card-strip HTML replacement.

### Changed
- Reworked casino card rendering to use stable mounted card slots with reveal-state updates instead of rebuilding visible card subsets.
- Reworked first-pass casino suspense animations to use renderer-local reveal state and stable DOM transitions.
- Updated casino navigation so each game is gated independently while still sharing the same casino shell.
- Updated blackjack, Mississippi Stud, and Baccarat card presentation to use shared stable card-slot behavior.

### Fixed
- Fixed repeated looping and jittering casino card animations caused by repeated card-strip remounts.
- Fixed cards disappearing during blackjack, Mississippi Stud, and Baccarat reveals by syncing reveal counts back to full real hand state after the animation window closes.
- Fixed casino animation behavior so cards no longer constantly reanimate during normal render updates.
- Removed the stray `BACK` fallback text artifact from the casino card renderer.
- Fixed Baccarat and Mississippi Stud game buttons so they remain disabled and hidden correctly until their PIP unlocks are purchased.

### Notes
- Save schema was extended again to support Baccarat state and stats.
- Casino animations are now renderer-local only and are not persisted across reloads.
