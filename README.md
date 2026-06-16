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
- query syntax for site/host/domain, title, URL, source, transition, visit count, exact-day/date ranges, exclusions, phrases, and regex;
- highlighted matches in vault and Quick Open search results;
- keyboard-first search with autofocus, global query focus, Enter search, and debounced live refresh;
- local-date grouped vault results for easier timeline scanning;
- Quick Open search across open tabs, bookmarks, downloads, and recently closed tabs, with source-aware switch/open/restore actions;
- a keyboard command for opening BrowseVault;
- JSON backup export and import;
- CSV export with ISO timestamp, local date/time, visit id, and Chrome id fields;
- HTML exports;
- visible backup status with freshness, format, record count, and checksum details;
- SHA-256 integrity metadata for JSON backups;
- staged import preview with valid row, duplicate row, existing visit, new visit, rule, and restore-check health status;
- JSON, CSV, TSV, and Google Takeout-style import handling;
- selected-record JSON, CSV, and HTML export;
- selected-record URL copy;
- selected-record batch opening with a tab-flood safety cap;
- bulk deletion from the BrowseVault vault;
- selected-domain blacklisting for future archive capture;
- select visible, invert visible, or select all filtered vault results;
- incremental Load More control for large result sets;
- undo for the last BrowseVault vault deletion;
- optional URL-level deletion from Chrome history for selected records;
- full local BrowseVault data reset without touching Chrome history;
- domain blacklist and whitelist rules;
- local display preferences for system/light/dark theme, accent color, date format, and default result limit;
- local-first privacy documentation;
- generated PNG extension icons;
- deterministic local ZIP packaging;
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
│           └── icon-128.png
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

`npm run package` writes `dist/browsevault-0.1.0.zip`.

## Current Search Syntax

Examples:

```text
github site:github.com
host:www.github.com source:chrome-history
title:invoice after:2026-01-01
date:2026-06-16
visits:>=10 transition:typed
url:docs -youtube
"exact phrase"
regex:github|gitlab
```

The main vault search is used for archived history management. Quick Open uses the same query text to search current browser sources such as open tabs, bookmarks, downloads, and recently closed tabs. Quick Open results are read-only and are not affected by vault delete/export actions.

Date filters use `YYYY-MM-DD` text fields to avoid browser-specific date input formatting. Use `date:`, `day:`, or `on:` for one local calendar day, and `after:` / `before:` for ranges. Domain filters accept `site:`, `host:`, or `domain:`. Visit count filters accept exact values, comparisons such as `visits:>=10`, ranges such as `count:5..12`, and minimum shorthand such as `visits:7+`. Displayed dates can be switched between system locale, ISO, day/month/year, month/day/year, and year/month/day in Settings.

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
