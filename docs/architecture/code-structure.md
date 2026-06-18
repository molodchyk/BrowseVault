# BrowseVault Code Structure

BrowseVault follows the local `extension-modularization-playbook.md` gradually. This document is a current-tree ownership map and migration aid; it does not redefine the playbook's target architecture. The current migration rule is: keep runtime entry files stable, move pure product logic into feature-owned modules, and leave compatibility barrels for old import paths.

## Current Ownership

- `src/app.html`, `src/app.css`, and `src/app.js` own the extension page runtime shell; `src/app.css` and `src/app.js` are thin entrypoints.
- `src/styles/` owns surface-level extension page styles split into tokens, layout, backup/rules/trust, results, and responsive layers.
- `src/background.js` owns MV3 service worker listener wiring, extension-page opening, and startup/install metadata.
- `src/storage.js` owns vault repository operations, metadata persistence, rule persistence, vault mutations, and compatibility exports for storage-facing callers.
- `src/browser-memory.js` owns read-only search over tabs, bookmarks, downloads, and recently closed sessions.
- `src/query.js` is a compatibility barrel for existing query import paths.
- `src/features/activity-log/` owns recent activity event normalization and Backup-tab activity rendering for user-visible backup, export, import, cleanup, delete, restore, rule, and reset operations.
- `src/features/app-shell/` owns extension-page bootstrap composition, shell state, element collection, tab navigation/focus helpers, shared search scheduling, event wiring, static extension-page localization, and shared shell UI behavior.
- `src/features/backup-import/` owns archive import/export actions, localized export statuses, export download helpers, export filename rules, file parsing, import normalization, import planning, import summary logic, integrity metadata, import-preview display state, and restore-flow rendering.
- `src/features/background-runtime/` owns background message routing, payload validation, privileged action dispatch, Chrome history bootstrap, Chrome history sync planning, archive filtering, live-visit capture, native Chrome history removal reconciliation, localized status strings, and extension-page actions that coordinate with background runtime messages.
- `src/features/browser-memory/` owns extension-page quick-open rendering and actions for tabs, bookmarks, downloads, and recently closed sessions.
- `src/features/display-preferences/` owns preference normalization, result-limit clamping, display formatting, archive health/status summaries, backup reminder cadence, backup filename preferences, settings persistence orchestration, and extension-page preference/stat rendering.
- `src/features/history-export/core/` owns pure CSV export formatting, HTML report formatting, and shared chunk/date helpers.
- `src/features/history-results/core/` owns pure result selection, URL/domain extraction, grouping, count labels, load-more state, saved-search normalization, search form query composition, chunked local search scanning, query parsing, query matching, wildcard text matching, and fuzzy text matching.
- `src/features/history-results/ui/` owns search form field state, saved-search controls, local history search/load-more/show-all orchestration, selected-record lookup, history result DOM rendering, rendering orchestration, search-hit highlighting, result jump controls, and selected-result bulk actions.
- `src/features/vault-management/` owns extension-page vault deletion, Chrome-history deletion requests, undo, reset, domain/category-rule actions, localized vault-management action messages, localized rule-list rendering, rule normalization, vault record normalization, category decoration, vault health/insight summaries, export ordering, and dedicated retention/duplicate cleanup actions.
- `src/platform/` owns explicit wrappers around browser/platform APIs, including Chrome extension APIs, Chrome i18n lookup, IndexedDB vault database primitives, and clipboard copy behavior.
- `src/export-format.js` is a compatibility barrel for existing import paths.
- `test/features/` mirrors feature-owned tests by product area so no single flat test folder becomes a dumping ground.
- `test/platform/`, `test/query/`, and `test/storage/` own cross-feature platform, query compatibility, and storage tests.
- `test/scripts/` owns tests for repository and release guardrails such as manual browser QA release-readiness validation.
- `scripts/check-locales.mjs` verifies manifest `__MSG_*__` references, static extension-page localization bindings, dynamic activity-log label keys, dynamic Backup/Import export status keys, dynamic Quick Open keys, dynamic display-preference status and summary keys, dynamic history-result UI status keys, and dynamic vault-management action/rule UI keys against `_locales/en/messages.json`, then rejects unresolved or unused locale keys.
- `scripts/check-manifest-paths.mjs` verifies manifest-owned extension paths such as icons, service workers, popups, options pages, content scripts, and web-accessible resources.
- `scripts/check-privacy-permissions.mjs` verifies that manifest permissions, `PRIVACY.md`, and the StorePilot privacy form stay aligned.
- `scripts/playbook/check-reference-sync.mjs` verifies that workspace reference copies stay in sync with the browser-extension playbook, Defense against Distractions, and StorePilot when those sources are available.
- `scripts/playbook/check-store-metadata.mjs` verifies that the human store draft, StorePilot detailed description, localized manifest name/summary, package metadata, and repository metadata stay synchronized.
- `scripts/check-file-sizes.mjs` audits the file-size budgets from the modularization playbook for `src/`, `test/`, and `scripts/`, reports soft-budget warnings, and caps known hard-limit debt.
- `scripts/check-folder-density.mjs` enforces folder-density budgets for `src/`, `test/`, `scripts/`, and `docs/`.
- `scripts/qa/` is reserved for clone-safe QA helpers and currently documents that BrowseVault browser QA is manual in this workspace.
- `docs/architecture/storage-ownership.md` maps IndexedDB stores, metadata keys, Chrome local extension storage keys, owners, migration paths, retention/pruning, and quota risk. `scripts/playbook/validate-playbook-compliance.mjs` checks that known storage keys remain documented.

## Next Split Candidates

- There are no current file-size or folder-density warnings from `npm run check`. Future split candidates should come from new `npm run check` warnings or feature folders approaching the density budgets.

## Rules For Future Edits

- Prefer a feature folder for new behavior instead of adding broad helpers to `src/app.js`.
- Keep pure logic free of `chrome`, `window`, and `document` access.
- Keep compatibility barrels export-only.
- Add or update focused tests when pure logic moves.
- Keep test files grouped by feature or responsibility rather than adding new root-level `test/*.test.js` files.
- Run `npm run check` after structure changes; it fails when static JavaScript imports, stylesheet imports, extension-page module script or stylesheet paths, locale references, manifest-owned paths, privacy/permission disclosures, or Chrome QA profile-safety guardrails break, and when runtime/support/docs folders exceed 12 files or feature/test-feature folders exceed 15 files.
- Update this file when ownership changes.
