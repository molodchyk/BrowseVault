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

This repository is an early Manifest V3 scaffold. It includes:

- a loadable Chrome extension shell;
- a full-page BrowseVault app;
- local IndexedDB archive storage;
- background capture for new Chrome history visits;
- manual sync from currently available Chrome history, expanded to individual visits where Chrome exposes them;
- query syntax for domain, title, URL, dates, exclusions, phrases, and regex;
- JSON backup export and import;
- CSV and HTML exports;
- visible last-backup status;
- import confirmation with record count;
- JSON, CSV, TSV, and Google Takeout-style import handling;
- selected-record export;
- bulk deletion from the BrowseVault vault;
- undo for the last BrowseVault vault deletion;
- optional URL-level deletion from Chrome history for selected records;
- domain blacklist and whitelist rules;
- local-first privacy documentation;
- copied research and product docs in [`docs/`](docs/);
- Chrome Web Store listing notes in [`store/listing.md`](store/listing.md);
- repository description and topic/tag metadata in [`package.json`](package.json).

## Project Structure

```text
.
├── docs/
├── scripts/
│   └── validate-extension.mjs
├── src/
│   ├── app.css
│   ├── app.html
│   ├── app.js
│   ├── background.js
│   └── storage.js
├── store/
│   └── listing.md
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

## Development

This scaffold has no runtime dependencies.

```bash
npm run validate
npm run check
```

## Current Search Syntax

Examples:

```text
github site:github.com
title:invoice after:2026-01-01
url:docs -youtube
"exact phrase"
regex:github|gitlab
```

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
