# Implementation Notes

These notes convert the product feedback into engineering constraints for a Chrome/Chromium extension.

## Browser API Reality

Chrome's history API can read local browser history that Chrome still has available. It should not be marketed as a way to recover history Chrome already deleted.

Product copy should say:

- "Keeps unlimited history from now on."
- "Import older data from Google Takeout or previous extension exports."
- "Imported archive data is searchable in BrowseVault, but may not appear in Chrome's native history page."

## Manifest V3 Constraints

Likely extension pieces:

- background service worker for visit capture and scheduled tasks;
- history/search page;
- popup or side panel for quick access;
- command palette;
- options/settings page;
- offscreen document or worker for heavy import/export tasks if needed.

Important concerns:

- service workers are not always alive, so capture logic must be event-driven and resilient;
- long imports and indexing should not depend on a service worker staying alive;
- UI thread must not scan or sort huge datasets synchronously;
- large exports should stream or chunk work where possible.

## Default History Replacement

Replacing Chrome's history page usually relies on `chrome_url_overrides` in the manifest. This is not a normal per-user runtime toggle.

Design options:

- avoid default replacement by default and provide a keyboard command/toolbar/popup;
- offer a separate build or install option for users who want history override;
- if overriding, include a visible "Open native Chrome history" escape hatch where possible;
- document the tradeoff clearly during onboarding.

## Storage Design

Use two layers:

1. Append-only event log for durability.
2. Derived search/index tables for speed.

This reduces the blast radius of index corruption because the product can rebuild indexes from the append-only log.

Suggested entities:

- `visits`: visit id, url id, title at visit time, visit time, transition type, source browser/profile, created at.
- `urls`: canonical URL, raw URL, domain, host, path, normalized search key, favicon key.
- `titles`: optional title history if title changes need explicit tracking.
- `deletions`: tombstones for archive deletion, Chrome deletion, and undo windows.
- `backups`: metadata about backup files, counts, hash, status, timestamp.
- `imports`: source type, row count, duplicate count, warnings, created at.
- `rules`: whitelist, blacklist, retention policies, category rules.

## Search Indexing

Search should be treated as product-critical infrastructure.

Required behavior:

- title and URL full-text search;
- domain/site filtering;
- negative terms;
- date range filtering;
- exact phrase mode;
- CJK-compatible search;
- optional regex mode;
- highlighting;
- stable sorting by recency/relevance.

Implementation options:

- IndexedDB with Dexie for storage and app-managed indexes.
- FlexSearch or MiniSearch for client-side search if dataset size stays manageable.
- SQLite WASM can be powerful but needs careful OPFS reliability testing because competitor reviews mention SQLite/OPFS corruption/errors.
- Maintain an index rebuild path from append-only data.

## Backup and Restore

Backup must be designed as a first-class workflow, not just an export button.

Recommended features:

- manual backup;
- scheduled backup;
- backup record count;
- backup hash/checksum;
- schema version;
- restore preview;
- dry-run restore into temporary database;
- duplicate detection;
- clear warnings for partial imports.

Avoid:

- silently downloading files on every browser restart;
- forcing "Save As" prompts without clear settings;
- ambiguous backup success states.

Potential backup destinations:

- local download file;
- browser file system access API where available;
- WebDAV/user-owned storage as premium/advanced feature;
- user-supplied cloud folder if technically feasible;
- encrypted archive with passphrase.

## Import/Export Schema

Native archive should be versioned and lossless:

- metadata: app version, schema version, created at, source profile, record counts, hash;
- storage self-check metadata: last successful vault metadata read/write check;
- visits: URL, title, timestamp, transition, visit count/source when available;
- visit rows ordered newest first with deterministic tie-breakers;
- rules: optional whitelist/blacklist/category rules;
- backup metadata.

CSV export should include:

- ISO timestamp;
- locale-friendly date;
- locale-friendly time;
- URL;
- domain;
- title;
- visit id;
- source;
- tags/categories if present.
- spreadsheet formula neutralization for text cells that begin with `=`, `+`, `-`, `@`, tab, or whitespace before a formula trigger.

HTML export should produce clickable links, exact timestamps, summary metrics, in-file filtering, sortable columns, and safe handling for unsupported URL schemes.

Secondary archive insights should stay local, compact, and non-decorative:

- top domains by active visit count;
- busiest local days;
- active-day count and average visits per active day;
- oldest-to-newest local date range.

## Bulk Actions

Bulk actions must be transaction-like:

- preview affected count;
- select all filtered results;
- range select with Shift;
- invert selection;
- delete selected;
- export selected;
- undo tombstone for archive deletion;
- separate action for deleting from Chrome native history, because users are surprised by both behaviors.

## Permission UX

Permissions that may be needed:

- history;
- tabs;
- bookmarks;
- downloads;
- storage;
- sessions;
- optional host permissions only if page metadata/snippets are captured.

Guidelines:

- ask for the smallest initial set;
- explain why each permission is needed;
- avoid requesting all-sites access unless a feature truly needs it;
- do not nag for optional permissions on every site.

## Reliability Tests

Test with synthetic datasets:

- 10k visits;
- 100k visits;
- 1M visits if feasible;
- many visits to the same URL with changing titles;
- large CJK title dataset;
- many duplicate URLs;
- import with malformed rows;
- interrupted import;
- interrupted backup;
- restore after index corruption.

Performance checks:

- search latency;
- index build time;
- memory usage;
- UI responsiveness during import/export;
- service worker event capture reliability.

Regression checks:

- no network requests by default;
- no popups except user-initiated flows;
- no ad domains;
- no destructive action without explicit user intent;
- clear audit log for delete/import/restore actions.

## MVP Risk Register

Highest risks:

- losing user history or making backups that cannot restore;
- search results not matching user expectations;
- browser performance degradation with large histories;
- permission prompts causing friction;
- unclear limits around Chrome's native 90-day retention;
- default history override backlash;
- importing data but failing to preserve titles/timestamps.

Mitigations:

- append-only log plus index rebuild;
- restore test workflow;
- explicit query syntax and result highlighting;
- background workers for expensive work;
- honest onboarding copy;
- no default history override unless deliberately chosen;
- import validation report.
