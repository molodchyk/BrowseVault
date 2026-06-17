# Changelog

All notable BrowseVault changes should be documented here before packaging a release.

The changelog must call out trust-sensitive behavior changes: deletion behavior, backup and restore behavior, Chrome history replacement behavior, permissions, network behavior, and user-data handling.

## 0.1.0 - 2026-06-17

### Added

- Local BrowseVault history archive with background capture for new Chrome history visits.
- Manual sync from currently available Chrome history, expanded to individual visits where Chrome exposes them.
- Full-page tabbed app with History, Quick Open, Backup, Rules, and Settings areas.
- Advanced local search for site, host, domain, title, URL, source, transition, visit count, exact day, date range, local hour, exclusions, wildcards, phrases, and regex.
- One-click Today, Yesterday, 7 Days, 30 Days, and All Dates shortcuts using ISO-style date filters.
- Saved searches, match highlighting, local-date grouped results, incremental loading, and keyboard-first search focus.
- Quick Open search across open tabs, bookmarks, downloads, and recently closed tabs.
- JSON, CSV, and HTML export for all records, selected records, and current filtered results.
- JSON backup integrity metadata and backup self-test before full JSON export.
- Import preview and import support for BrowseVault JSON, CSV, TSV, Google Takeout Browser History, Google My Activity, and common competitor history exports.
- Recent activity log for completed backup, export, import, cleanup, delete, restore, rule, and reset actions.
- Domain blacklist and whitelist rules, selected-domain blacklisting, manual retention cleanup, and full local vault reset.
- Settings for system, light, and dark themes, accent color, date format, default result limit, backup reminder cadence, and backup filename prefix.

### Data Safety

- BrowseVault stores archive data locally in the browser profile.
- Vault deletion and Chrome history deletion are separate actions with separate button labels and confirmation prompts.
- Delete-from-vault actions use undoable tombstones where the vault can support restore.
- Delete-from-Chrome actions explicitly remove Chrome history by URL and then mark the selected BrowseVault records deleted.
- Reset Vault clears BrowseVault local archive data, rules, and backup metadata without deleting Chrome history.
- Imports are staged behind a preview with row counts, duplicate estimates, existing/new visit counts, rule counts, and checksum health where available.
- Imports merge with matching existing vault visits and preserve local vault deletion markers, Chrome-deletion markers, and original creation metadata.

### Trust And Permissions

- No default Chrome history replacement is enabled; BrowseVault opens through the toolbar action or keyboard command.
- Settings includes an escape hatch to open Chrome's native history page.
- No host permissions, content scripts, optional permission prompts, remote code, analytics, ads, tracking, or page-content capture are included.
- No network requests are expected by default. Any future network-backed sync, backup destination, or remote feature must be explicit and documented here before release.
- Manifest permissions are limited to bookmarks, downloads, history, sessions, storage, and tabs for the product workflows described in the README and store-facing privacy form.

### Known Limits

- BrowseVault cannot recover visits Chrome already deleted unless the user imports older data from another source.
- Browser APIs generally cannot write arbitrary old imported visits back into Chrome's native history.
- Mobile, account, synced-device, or other-profile history depends on what Chrome exposes locally or what the user imports.
- Backup destination control is limited by browser download behavior; BrowseVault supports local filename prefix control but does not yet provide WebDAV, cloud, or user-owned remote backup destinations.
