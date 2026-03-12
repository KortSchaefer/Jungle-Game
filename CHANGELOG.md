# Changelog
All notable changes to this project are documented in this file.

The format is based on Keep a Changelog and this project uses semantic versioning.

## [1.2.1] - 2026-03-11
### Added
- Split the old Research Hut building into two separate upgrade tracks:
  - `Research Lab`: increases RP/sec.
  - `Finance Office`: reduces upgrade cash costs.
- Added schema migration to map legacy `researchHutLevel` into both new tracks for fair save continuity.
- Added stat-breakdown source visibility for:
  - Research Lab base RP generation rate.
  - Finance Office discount multiplier.

### Changed
- Building definitions updated:
  - Removed `research_hut`.
  - Added `research_lab` and `finance_office` with their own costs and levels.
- Trees/Farms Buildings UI now shows separate rows/buttons for Research Lab and Finance Office.
- Research discount pipeline now uses Finance Office only.
- Research point generation now uses Research Lab only.
- Prestige reset and state sanitization now reset/sanitize the two new building levels.
- Game state schema version bumped to `10`.

### Fixed
- Removed coupling where one building level controlled both RP gain and discount simultaneously.
- Preserved old saves without power loss by migrating legacy levels cleanly.
