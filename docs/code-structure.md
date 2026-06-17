# BrowseVault Code Structure

BrowseVault follows the local `extension-modularization-playbook.md` gradually. The current migration rule is: keep runtime entry files stable, move pure product logic into feature-owned modules, and leave compatibility barrels for old import paths.

## Current Ownership

- `src/app.html`, `src/app.css`, and `src/app.js` own the extension page runtime shell while the UI is being split.
- `src/background.js` owns MV3 service worker listener wiring, extension-page opening, and startup/install metadata.
- `src/storage.js` owns IndexedDB vault records, import normalization, backup metadata, rules, and vault mutations.
- `src/browser-memory.js` owns read-only search over tabs, bookmarks, downloads, and recently closed sessions.
- `src/query.js` owns search parsing and matching.
- `src/features/app-shell/` owns extension-page shell state, element collection, tab navigation/focus helpers, shared search scheduling, event wiring, and shared shell UI behavior.
- `src/features/backup-import/` owns archive import/export actions, file parsing, integrity metadata, import-preview display state, and restore-flow rendering.
- `src/features/background-runtime/` owns background message routing, payload validation, privileged action dispatch, Chrome history bootstrap, archive filtering, live-visit capture, native Chrome history removal reconciliation, and extension-page actions that coordinate with background runtime messages.
- `src/features/browser-memory/` owns extension-page quick-open rendering and actions for tabs, bookmarks, downloads, and recently closed sessions.
- `src/features/display-preferences/` owns preference normalization, result-limit clamping, date/count formatting, backup status summaries, settings persistence orchestration, and extension-page preference/stat rendering.
- `src/features/history-export/core/export-format.js` owns pure CSV and HTML export formatting.
- `src/features/history-results/core/` owns pure result selection, URL/domain extraction, grouping, count labels, load-more state, and search form query composition.
- `src/features/history-results/ui/` owns search form field state, local history search/load-more orchestration, selected-record lookup, history result DOM rendering, rendering orchestration, search-hit highlighting, and selected-result bulk actions.
- `src/features/vault-management/` owns extension-page vault deletion, Chrome-history deletion requests, undo, reset, and domain-rule actions.
- `src/platform/` owns explicit wrappers around browser/platform APIs, including Chrome extension APIs and clipboard copy behavior.
- `src/export-format.js` is a compatibility barrel for existing import paths.

## Next Split Candidates

- Move remaining app composition/bootstrap glue out of `src/app.js` only when a clearer owner emerges.

## Rules For Future Edits

- Prefer a feature folder for new behavior instead of adding broad helpers to `src/app.js`.
- Keep pure logic free of `chrome`, `window`, and `document` access.
- Keep compatibility barrels export-only.
- Add or update focused tests when pure logic moves.
- Update this file when ownership changes.
