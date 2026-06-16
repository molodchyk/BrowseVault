# BrowseVault Code Structure

BrowseVault follows the local `extension-modularization-playbook.md` gradually. The current migration rule is: keep runtime entry files stable, move pure product logic into feature-owned modules, and leave compatibility barrels for old import paths.

## Current Ownership

- `src/app.html`, `src/app.css`, and `src/app.js` own the extension page runtime shell while the UI is being split.
- `src/background.js` owns MV3 service worker listener wiring, extension-page opening, and startup/install metadata.
- `src/storage.js` owns IndexedDB vault records, import normalization, backup metadata, rules, and vault mutations.
- `src/browser-memory.js` owns read-only search over tabs, bookmarks, downloads, and recently closed sessions.
- `src/query.js` owns search parsing and matching.
- `src/features/backup-import/` owns archive file parsing plus import-preview display state and rendering for restore flows.
- `src/features/background-runtime/` owns background message routing, payload validation, privileged action dispatch, Chrome history bootstrap, archive filtering, live-visit capture, and native Chrome history removal reconciliation.
- `src/features/display-preferences/core/preferences.js` owns pure preference normalization, result-limit clamping, date/count formatting, and backup status summaries.
- `src/features/history-export/core/export-format.js` owns pure CSV and HTML export formatting.
- `src/features/history-results/core/results.js` owns pure result selection, URL/domain extraction, grouping, count labels, and load-more state.
- `src/features/history-results/ui/` owns history result DOM rendering and search-hit highlighting.
- `src/platform/chrome/` owns explicit wrappers around Chrome extension APIs as they are extracted from runtime and feature modules.
- `src/export-format.js` is a compatibility barrel for existing import paths.

## Next Split Candidates

- Move extension-page UI state and event wiring out of `src/app.js` into feature-owned modules.

## Rules For Future Edits

- Prefer a feature folder for new behavior instead of adding broad helpers to `src/app.js`.
- Keep pure logic free of `chrome`, `window`, and `document` access.
- Keep compatibility barrels export-only.
- Add or update focused tests when pure logic moves.
- Update this file when ownership changes.
