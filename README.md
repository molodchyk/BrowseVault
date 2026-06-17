# BrowseVault

**History Search & Backup**

BrowseVault is a local-first Chrome extension project for private browser history search, backup, export, and preservation.

The working Chrome Web Store title is:

```text
BrowseVault: History Search & Backup
```

The short positioning is:

```text
Search, back up, export, and preserve your browser history locally.
```

## Status

This repository contains a working Manifest V3 extension implementation. It includes:

- a loadable Chrome extension shell;
- a full-page BrowseVault app;
- a tabbed interface that keeps History results first and moves secondary tools out of the scroll path;
- local IndexedDB archive storage;
- background capture for new Chrome history visits;
- manual sync from currently available Chrome history, expanded to individual visits where Chrome exposes them;
- visible archive health for startup, Chrome sync, and live capture status;
- query syntax for site/host/domain, title, URL, source, transition, visit count, exact-day/date ranges, local-hour filters, exclusions, wildcards, phrases, and regex;
- bounded typo-tolerant matching for longer plain keyword searches;
- chunked local search scanning for large vaults, covered by synthetic large-history tests;
- bounded result retention for limited searches, covered by a 100k-record synthetic history test;
- one-click Today, Yesterday, 7 Days, 30 Days, and All Dates shortcuts that fill ISO-style date filters;
- saved searches for repeated local history queries and date/limit filter sets;
- highlighted matches in vault and Quick Open search results;
- keyboard-first search with autofocus, global query focus, Enter search, and debounced live refresh;
- keyboard navigation for visible history results with arrow keys, Enter-to-open, and Space-to-select;
- local-date grouped vault results for easier timeline scanning;
- Quick Open search across open tabs, bookmarks, downloads, recently closed tabs, and closed windows, with source-aware switch/open/open-in-background/restore actions, keyboard navigation, and readable source-unavailable warnings;
- toolbar and keyboard-command opening that reuses an already open BrowseVault tab;
- Settings escape hatch for opening Chrome's native history page without making BrowseVault a default-history override;
- JSON backup export and import;
- CSV export with ISO timestamp, local date/time, visit id, and Chrome id fields;
- HTML exports;
- visible backup status with freshness, format, record count, file size, backup self-test, and checksum details;
- recent activity log for completed backup, export, import, cleanup, delete, restore, rule, and reset operations;
- SHA-256 integrity metadata for JSON backups;
- staged import preview with valid row, duplicate row, existing visit, new visit, rule, and restore-check health status;
- imports preserve existing local vault tombstones and Chrome-deletion markers when matching visits are imported again;
- imports merge duplicate archive rows into unique restored records and report duplicate rows in the final status/activity log;
- JSON, CSV, TSV, Google Takeout Browser History, Google My Activity, and common competitor-export import handling;
- current filtered result-set JSON, CSV, and HTML export without manual selection;
- current filtered result-set vault deletion with confirmation and undo;
- selected-record JSON, CSV, and HTML export;
- selected-record URL copy;
- selected-record batch opening with a tab-flood safety cap;
- bulk deletion from the BrowseVault vault;
- selected-domain blacklisting for future archive capture;
- select visible, invert visible, or select all filtered vault results;
- sticky result controls with incremental Load More and one-click Show All for large result sets;
- undo for the last BrowseVault vault deletion;
- optional URL-level deletion from Chrome history for selected records;
- full local BrowseVault data reset without touching Chrome history;
- domain blacklist and whitelist rules;
- manual retention cleanup that previews old vault records and keeps whitelisted domains;
- duplicate cleanup that previews repeated active vault records and moves extras to undoable deletion;
- local preferences for system/light/dark theme, accent color, high contrast, text size, date format, default result limit, backup reminders, backup filename prefix, and backup filename template;
- backup reminder status follows the configured reminder interval and warns when the next reminder date is reached;
- exact ISO visit timestamps in history result metadata while visible rows follow the selected date format;
- in-app trust, permission, and product-limit disclosures;
- local-first privacy documentation;
- versioned release notes in [`CHANGELOG.md`](CHANGELOG.md), including trust-sensitive behavior changes;
- generated PNG extension icons;
- deterministic runtime-only local ZIP packaging that excludes repo research, tests, scripts, StorePilot files, and feature docs;
- copied research and product docs in [`docs/`](docs/);
- Chrome Web Store listing notes in [`store/listing.md`](store/listing.md);
- StorePilot-ready Chrome Web Store import files in [`store-listing/chrome-web-store/`](store-listing/chrome-web-store/);
- repository description and topic/tag metadata in [`package.json`](package.json).

## Project Structure

```text
.
├── docs/
│   ├── code-structure.md
│   └── extension-modularization-playbook.md
├── assets/
│   └── icons/
├── scripts/
│   ├── generate-icons.mjs
│   ├── package-extension.mjs
│   └── validate-extension.mjs
├── src/
│   ├── app.css
│   ├── app.html
│   ├── app.js
│   ├── background.js
│   ├── browser-memory.js
│   ├── export-format.js
│   ├── features/
│   │   ├── backup-import/
│   │   ├── display-preferences/
│   │   ├── history-export/
│   │   └── history-results/
│   ├── query.js
│   └── storage.js
├── store/
│   └── listing.md
├── store-listing/
│   └── chrome-web-store/
│       ├── listing/
│       │   └── en.md
│       └── media/
│           ├── icon-128.png
│           ├── promo/
│           └── screenshots/
├── test/
│   ├── features/
│   ├── platform/
│   ├── query/
│   └── storage/
├── manifest.json
├── package.json
├── PRIVACY.md
└── README.md
```

## Load Unpacked

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this repository folder.
5. Click the BrowseVault extension icon.

The manifest also registers `Ctrl+Shift+Y` / `Command+Shift+Y` as a suggested shortcut for opening BrowseVault.

## Development

This extension has no runtime dependencies.

```bash
npm run validate
npm run check
npm test
npm run icons
npm run package
```

`npm run validate` also enforces the current trust baseline: exact manifest permissions, no host permissions, no optional permission prompts, no content scripts, no web-accessible resources, no external extension messaging surface, no remote source URLs, no source-level network APIs or dynamic code loaders, and no default `chrome_url_overrides` replacement of Chrome history.

`npm run package` writes `dist/browsevault-0.1.0.zip`.

## Current Search Syntax

Examples:

```text
github site:github.com
host:www.github.com source:chrome-history
title:invoice after:2026-01-01
date:2026-06-16
date:2026-06-16 hour:14
hour:9-17
visits:>=10 transition:typed
hist* title:resear?
url:docs -youtube
"exact phrase"
regex:github|gitlab
```

The main vault search is used for archived history management. Quick Open uses the same query text to search current browser sources such as open tabs, bookmarks, downloads, recently closed tabs, and closed windows. Quick Open results are read-only and are not affected by vault delete/export actions. Longer plain keywords use a bounded fuzzy fallback, so common one-character typos such as `histroy` can still find `history`; short keywords, phrases, regex, and structured filters stay exact unless they include `*` or `?` wildcards. Wildcards work in plain keywords, exclusions, and `title:`, `url:`, `source:`, or `transition:` filters.

Date filters use `YYYY-MM-DD` text fields to avoid browser-specific date input formatting. Use `date:`, `day:`, or `on:` for one local calendar day, and `after:` / `before:` for ranges. Bare `after:YYYY-MM-DD` starts at local midnight, and bare `before:YYYY-MM-DD` includes the full local day. Use `hour:14` for one local hour or `hour:9-17` / `hour:9..17` for an inclusive local-hour range. Domain filters accept `site:`, `host:`, or `domain:`. Visit count filters accept exact values, comparisons such as `visits:>=10`, ranges such as `count:5..12`, and minimum shorthand such as `visits:7+`. Displayed dates can be switched between system locale, ISO, day/month/year, month/day/year, and year/month/day in Settings.

## Retention Cleanup

The Rules tab supports manual vault retention cleanup. Enter a number of days, preview how many old BrowseVault records would be cleaned up, then confirm the cleanup. Cleanup uses the same undoable vault deletion path as selected-record deletion and skips whitelisted domains.

The Rules tab also supports duplicate cleanup. It finds active vault records with the same URL and visit time, keeps the richest record, and moves extra duplicates to undoable deletion. It does not delete Chrome history.

The History tab also supports direct current-result deletion for targeted cleanup by query, domain, date, or hour. Enter a query or date filter first, then use Delete Results From Vault. This action only removes records from BrowseVault, does not delete Chrome history, and can be undone.

## Backup Filenames

Backup and export filenames use the configured prefix and template. The default template is `{prefix}-{kind}-{date}`. Templates are filename bases without the extension and can use `{prefix}`, `{kind}`, `{date}`, and `{time}` tokens. Browser download settings still control the destination folder.

## GitHub Description

```text
Private local-first browser history search, backup, export, and preservation extension.
```

## GitHub Topics

```text
chrome-extension, browser-history, history-search, history-backup, local-first, privacy-first, export-history, manifest-v3
```

## Product Notes

BrowseVault and Research Replay should stay separate products at the user-facing level:

- BrowseVault: preserve, search, back up, export, and clean browser history.
- Research Replay: preserve the reasoning trail behind explicit research sessions.

They may later share infrastructure such as URL normalization, local storage, search indexing, backup, and export.
