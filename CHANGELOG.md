# Changelog
All notable changes to this project are documented in this file.

The format is based on Keep a Changelog and this project uses semantic versioning.

## [1.3.2] - 2026-03-14
### Added
- Added a permanent account progression system that does not reset on prestige.
- Added lifetime stat tracking for long-term progress metrics including bananas, cash, clicks, shipments, contracts, PIP, research, achievements, antimatter, Weird Science structure builds, and highest tree tier reached.
- Added account titles, profile stars, XP progress, and next reward preview to the account sidebar.
- Added an `Account XP Breakdown` panel showing how each tracked metric contributes to account XP.
- Added account-level-gated cosmetic unlocks for top bar themes, body themes, and icon styles.

### Changed
- Replaced the old banana-only CEO level display with a permanent account level system based on weighted multi-metric lifetime progress.
- Account milestone rewards now provide small permanent bonuses every 5 levels, rotating between production, export price, and click yield.
- Customize modal options are now data-driven and visibly locked until the required account level is reached.
- Sidebar player stats now focus on lifetime progression totals instead of only current-run totals.

### Fixed
- Fixed progression so prestige resets no longer erase level growth.
- Fixed customization flow so newly unlocked cosmetic options become selectable as soon as the required account level is reached.

### Notes
- Save schema was bumped to `15`.
- Older saves now seed permanent account progression from existing historical progress where possible.
