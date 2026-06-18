# Storage Ownership

This document maps BrowseVault's persistent and cross-tab storage contracts to owners. It implements the storage ownership rule from the extension modularization playbook: every storage key needs an owner, shape, migration path, retention policy, and quota-risk note.

## IndexedDB Vault

Database: `browsevault`

Version: `1`

Owner: `src/storage.js` with IndexedDB primitives in `src/platform/indexed-db/vault-db.js`.

Migration path: schema changes must bump `DB_VERSION`, update `openVaultDb()`, add migration tests, and update this document before release. Store or key renames are not safe without migration coverage.

| Store or key | Owner | Shape | Retention and pruning | Quota risk |
| --- | --- | --- | --- | --- |
| `visits` store | `src/storage.js`; record shape from `src/features/vault-management/core/history-records.js` | One normalized visit per `id`, including URL, title, domain, visit time, source, transition metadata, optional `deletedAt`, and optional `chromeDeletedAt`. Indexes: `url`, `domain`, `visitTime`, `deletedAt`. | Preserved until explicit vault deletion, retention cleanup, duplicate cleanup, import merge, or Reset Vault. Deleted records become tombstones when possible so imports and Chrome-deletion markers are not lost. | High. This is the main user data set and can grow with browsing volume. Large search/export paths are chunked and package checks keep runtime code local. |
| `rules` store | `src/storage.js`; normalization in `src/features/vault-management/core/domain-rules.js` | Domain rule records keyed by `category:<domain>`, `blacklist:<domain>`, or `whitelist:<domain>`, with `type`, `value`, optional `category`, and `createdAt`. | Preserved until the user removes a rule, imports a replacement rule, or uses Reset Vault. | Low. User-created rule lists are small. |
| `meta.activityLog` | `src/features/activity-log/` | Array of normalized activity events with id, type, label, detail, count, and `occurredAt`. | Capped to `MAX_ACTIVITY_EVENTS` so it remains a lightweight trust/status surface. Reset Vault clears it. | Low because it is capped. |
| `meta.installedAt` | `src/background.js` | ISO timestamp string. | Written at install. Reset Vault clears it. | Low. |
| `meta.lastBackup` | `src/features/backup-import/ui/actions.js` | JSON-backup metadata: exported timestamp, format, record count, file size, backup self-test result, and SHA-256 checksum. | Replaced only by an integrity-checked JSON archive backup. Reset Vault clears it. | Low. |
| `meta.lastChromeSync` | `src/storage.js`; fallback writer in `src/features/background-runtime/background/chrome-history-sync.js` | Chrome sync summary with scanned, stored, total, reason, and `syncedAt`. | Replaced on startup/install/manual sync. Reset Vault clears it. | Low. |
| `meta.lastImport` | `src/storage.js` import plan writer | Import metadata with imported timestamp, imported visit count, duplicate row count, and rule count. | Replaced on confirmed archive import. Reset Vault clears it. | Low. |
| `meta.lastLiveCapture` | `src/storage.js`; fallback writer in `src/features/background-runtime/background/chrome-history-sync.js` | Latest captured visit summary with captured timestamp, title, and URL. | Replaced on each archived live visit. Reset Vault clears it. | Low. |
| `meta.lastNativeHistoryClear` | `src/features/background-runtime/background/chrome-history-removal.js` | Timestamp for a native Chrome all-history clear event observed through the history API. | Replaced when Chrome reports all history cleared. Reset Vault clears it. | Low. |
| `meta.lastStartedAt` | `src/background.js` | ISO timestamp string for the latest service-worker startup path. | Replaced on startup. Reset Vault clears it. | Low. |
| `meta.lastStorageSelfCheck` | `src/storage.js` | Last storage self-check result with checked timestamp, status, and nonce. | Replaced when the storage self-check runs. Reset Vault clears it. | Low. |
| `meta.lastVaultDelete` | `src/storage.js` | Last undoable vault deletion summary with deleted timestamp, count, and visit ids. | Replaced on selected/current-result/cleanup deletion. Used by Undo. Reset Vault clears it. | Medium when a very large delete stores many ids; bounded by explicit user action. |
| `meta.lastVaultRestore` | `src/storage.js` | Last restore summary with restored timestamp, count, and visit ids. | Replaced on Undo restore. Reset Vault clears it. | Medium when restoring a very large delete; bounded by explicit user action. |
| `meta.savedSearches` | `src/features/history-results/core/saved-searches.js` | Normalized saved search objects with query, filters, limit, sort order, and label/id fields. | Preserved until user deletes a saved search or uses Reset Vault. | Low. |

## Chrome Local Extension Storage

Storage area: `chrome.storage.local`

Owner: platform wrapper `src/platform/chrome/storage.js`; feature owners call it through injected services where practical.

Fallback: `browseVault.localPreviewStorage` is a local preview/test fallback only when Chrome local storage is unavailable. It is not a packaged Chrome storage key and should not become product state.

| Key | Owner | Shape | Retention and pruning | Quota risk |
| --- | --- | --- | --- | --- |
| `browseVault.preferences` | `src/features/display-preferences/` | Normalized preferences: theme, accent, contrast, text size, date format, default result limit, backup reminder days, backup save mode, backup filename prefix, and backup filename template. | Replaced when the user saves settings. It is intentionally outside the vault reset path so display defaults can survive data resets unless a future explicit settings reset is added. | Low. Small configuration object. |
| `browseVault.vaultInvalidation` | `src/features/app-shell/core/vault-invalidation.js` | Last cross-tab vault-change message with message type, source id, reason, sent timestamp, and change id. | Replaced on vault-changing actions. It is a notification fallback for tabs that miss BroadcastChannel delivery. | Low. Single small message. |

## Review Rules

- New persistent data must name its storage area and owning feature here in the same change. The playbook compliance validator derives known metadata and Chrome local-storage keys from source files and rejects undocumented keys.
- New IndexedDB stores or indexes require migration tests and a `DB_VERSION` bump.
- New Chrome local storage keys require privacy review to confirm they are local extension storage, not sync/session/managed storage.
- User history, rules, backups, and metadata must not move to sync storage without a separate privacy and quota decision record.
