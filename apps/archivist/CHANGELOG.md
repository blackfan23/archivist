# Archivist Changelog

## [2.1.0]

### Fixed

- **Directory-First Grouping**: Completely rebuilt the series matching architecture to group files by their physical directory structure first. This perfectly handles nested episode folders (like `.ACED` or `.GERMAN` releases) and prevents duplicate "Missing" and "Found" entries for the same episode.
- **Multi-Episode Files**: Added proper detection and tracking for multi-episode files (e.g., `S01E01E02`), preventing secondary episodes from being falsely flagged as missing.
- **Robust Regexes**: `NxNN` matching now supports spaces (e.g., `01 x 01`), and `SxxExx` scanner matching now supports dots and spaces in folder names.
- **Normalization**: Unified show title normalization across the scanner and TMDB matching to prevent subtle split-batch bugs.

## [2.0.16]

### Added

- Changelog
- Added cleaning of sample files
- Instructions on how to use Ollama

## [2.0.15]

### Added

- Automated GitHub Actions Release Pipeline
- Multi-OS Native Installers (.exe, .dmg, .AppImage)
- Auto-extracting dependencies via bun extraction script
