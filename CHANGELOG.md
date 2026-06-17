# Changelog

All notable BrowseVault changes should be documented here before packaging a release.

The changelog must call out trust-sensitive behavior changes: deletion behavior, backup and restore behavior, Chrome history replacement behavior, permissions, network behavior, and user-data handling.

## 0.1.0 - 2026-06-17

### Added

- Local BrowseVault history archive with background capture for new Chrome history visits.
- Manual sync from currently available Chrome history, expanded to individual visits where Chrome exposes them.
- Full-page tabbed app with History, Quick Open, Backup, Rules, and Settings areas.
- Advanced local search for site, host, domain, title, URL, source, transition, visit count, exact day, date range, local hour, exclusions, wildcards, phrases, and regex.
- Limited history searches keep only the top visible results while counting the full match set, reducing memory and sort work on large archives.
- One-click Today, Yesterday, 7 Days, 30 Days, and All Dates shortcuts using ISO-style date filters.
- Saved searches, match highlighting, local-date grouped results, sticky result controls, incremental loading, one-click Show All expansion, Top/Bottom result jumps, keyboard-first search focus, keyboard navigation for visible history rows, and mouse/keyboard range selection.
- Quick Open search across open tabs, bookmarks, downloads, recently closed tabs, and closed windows, with keyboard navigation for source results and readable source-unavailable warnings.
- Deterministic newest-first JSON, formula-safe CSV, and offline HTML export for all records, selected records, and current filtered results, with HTML summary metrics, exact timestamps, in-file filtering, sortable columns, and safer link handling.
- Bare `after:YYYY-MM-DD` and `before:YYYY-MM-DD` search filters use local calendar-day boundaries instead of browser-dependent UTC parsing.
- JSON backup integrity metadata and backup self-test before full JSON export.
- Backup reminder status follows the configured reminder interval and warns when the next reminder date is reached.
- History result rows expose exact ISO visit timestamps in their time metadata while preserving the selected visible date format.
- Import preview and import support for BrowseVault JSON, CSV, TSV, Google Takeout Browser History, Google My Activity, and common competitor history exports.
- Recent activity log for completed backup, export, import, cleanup, delete, restore, rule, and reset actions, plus vault health checks for malformed rows, tombstones, and duplicate active records.
- Domain blacklist and whitelist rules, selected-domain blacklisting, manual retention cleanup, duplicate cleanup, and full local vault reset.
- Settings for system, light, and dark themes, accent color, high contrast, text size, date format, default result limit, backup reminder cadence, backup filename prefix, and backup filename template.
- Feature-owned test folders and StorePilot-ready Chrome Web Store automation documents.

### Data Safety

- BrowseVault stores archive data locally in the browser profile.
- Vault deletion and Chrome history deletion are separate actions with separate button labels and confirmation prompts.
- Delete-from-vault actions use undoable tombstones where the vault can support restore.
- Delete-from-Chrome actions explicitly remove Chrome history by URL and then mark the selected BrowseVault records deleted.
- Reset Vault clears BrowseVault local archive data, rules, and backup metadata without deleting Chrome history.
- Imports are staged behind a preview with row counts, duplicate estimates, existing/new visit counts, rule counts, and checksum health where available.
- Imports merge with matching existing vault visits and preserve local vault deletion markers, Chrome-deletion markers, and original creation metadata.
- Imports merge duplicate archive rows into unique restored records and report duplicate rows in the final import status and activity log.
- Duplicate cleanup moves repeated active vault records with the same URL and visit time to undoable deletion while keeping the richest record.
- Backup status is updated only by the integrity-checked JSON archive export; CSV and HTML history exports are tracked as export activity instead of restorable backups.

### Trust And Permissions

- No default Chrome history replacement is enabled; BrowseVault opens through the toolbar action or keyboard command.
- Settings includes an escape hatch to open Chrome's native history page.
- No host permissions, content scripts, optional permission prompts, remote code, analytics, ads, tracking, or page-content capture are included.
- No network requests are expected by default; validation blocks source-level network APIs, remote URLs, and dynamic code loaders. Any future network-backed sync, backup destination, or remote feature must be explicit and documented here before release.
- Manifest permissions are limited to bookmarks, downloads, history, sessions, storage, and tabs for the product workflows described in the README and store-facing privacy form.
- Packaged extension ZIPs include only runtime extension assets and root user-facing docs; repo research, tests, scripts, StorePilot files, and feature docs are excluded.

### Known Limits

- BrowseVault cannot recover visits Chrome already deleted unless the user imports older data from another source.
- Browser APIs generally cannot write arbitrary old imported visits back into Chrome's native history.
- Mobile, account, synced-device, or other-profile history depends on what Chrome exposes locally or what the user imports.
- Backup destination control is limited by browser download behavior; BrowseVault supports local filename prefix and template control but does not yet provide WebDAV, cloud, or user-owned remote backup destinations.
