# BrowseVault Code Structure

BrowseVault follows the local `extension-modularization-playbook.md` gradually. The current migration rule is: keep runtime entry files stable, move pure product logic into feature-owned modules, and leave compatibility barrels for old import paths.

## Current Ownership

- `src/app.html`, `src/app.css`, and `src/app.js` own the extension page runtime shell while the UI is being split.
- `src/background.js` owns MV3 service worker listeners, Chrome history capture, tab/session actions, and privileged message handling.
- `src/storage.js` owns IndexedDB vault records, import normalization, backup metadata, rules, and vault mutations.
- `src/browser-memory.js` owns read-only search over tabs, bookmarks, downloads, and recently closed sessions.
- `src/query.js` owns search parsing and matching.
- `src/features/backup-import/` owns import-preview display state and rendering for archive restore flows.
- `src/features/display-preferences/core/preferences.js` owns pure preference normalization, result-limit clamping, date/count formatting, and backup status summaries.
- `src/features/history-export/core/export-format.js` owns pure CSV and HTML export formatting.
- `src/features/history-results/core/results.js` owns pure result selection, URL/domain extraction, grouping, count labels, and load-more state.
- `src/features/history-results/ui/` owns history result DOM rendering and search-hit highlighting.
- `src/export-format.js` is a compatibility barrel for existing import paths.

## Next Split Candidates

- Move archive parsing/import file detection from `src/app.js` into the backup-import feature.
- Add platform wrappers before adding more direct `chrome.*` calls.

## Rules For Future Edits

- Prefer a feature folder for new behavior instead of adding broad helpers to `src/app.js`.
- Keep pure logic free of `chrome`, `window`, and `document` access.
- Keep compatibility barrels export-only.
- Add or update focused tests when pure logic moves.
- Update this file when ownership changes.
