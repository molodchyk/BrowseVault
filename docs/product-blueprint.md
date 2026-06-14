# Product Blueprint

Working name: BrowseVault

One-line positioning:

Private, unlimited browser memory with fast search, safe cleanup, and reliable backup.

## Target Users

- Researchers who need to recover pages from weeks, months, or years ago.
- Knowledge workers who use history for time tracking, documentation, and "what was I working on?" recovery.
- Power users with many tabs, bookmarks, and browser profiles.
- Privacy-conscious users who want local-only data and precise cleanup.
- Users burned by Chrome's 90-day local history retention and unreliable extension backups.

## Product Promise

- Never lose a page again from the point of installation onward.
- Find anything instantly across history, tabs, bookmarks, downloads, and closed tabs.
- Clean or export exactly the items you intend.
- Keep data local unless the user explicitly configures a backup/sync destination.

## MVP Scope

### Local History Archive

- Record visits from installation onward.
- Store visit timestamp, URL, title at time of visit, typed/link/reload transition where available, visit count, domain, normalized URL, favicon reference, and browser/profile source metadata where available.
- Preserve title per visit so later page title changes do not overwrite old meaning.

### Search

Support:

- keyword search over title and URL;
- `site:example.com`;
- `domain:example.com`;
- `title:invoice`;
- `url:github`;
- quoted exact phrases;
- `-exclude`;
- date ranges;
- regex mode for advanced users;
- CJK substring/token support;
- live search with debounce;
- search input autofocus and keyboard navigation.

### Unified Command Palette

Include:

- open tab search;
- bookmark search;
- local history search;
- downloads search;
- recently closed tabs/windows where the browser API supports it;
- actions: open, open in background, copy URL, delete, export selected, blacklist domain.

### Bulk Actions

Include:

- checkbox selection;
- shift-click range selection;
- select all visible;
- select all filtered;
- invert selection;
- delete selected;
- export selected;
- undo last destructive action where possible;
- separate "delete from archive" and "delete from Chrome history" actions if both are available.

### Backup and Restore

Include:

- manual backup;
- scheduled local backup;
- visible backup status;
- restore wizard;
- import preview with row counts and duplicate estimate;
- native archive format with schema version;
- CSV/JSON/HTML export.

### Import

Prioritize:

- Google Takeout browser/activity exports where feasible;
- History Trends Unlimited exports;
- History Plus exports;
- Better History exports;
- simple CSV/JSON URL-title-timestamp formats.

### Trust Baseline

Non-negotiables:

- no ads;
- no surprise popups;
- no review nags;
- no network calls by default;
- no analytics without explicit opt-in;
- human-readable export format;
- clear permission explanations.

## Differentiators

### 1. Backup Integrity as a Feature

Most competitors say they back up history. The product should prove it:

- last backup time;
- last restore test result;
- backup file size and record count;
- warnings if backup has not succeeded recently;
- ability to restore into a separate test archive before replacing current data.

### 2. Search That Actually Matches User Mental Models

Search should feel closer to a developer search tool plus browser command palette:

- domain filters;
- title filters;
- URL filters;
- negative filters;
- fuzzy typo correction;
- CJK search;
- saved searches;
- search result highlighting.

### 3. Precise Cleanup

Users want privacy cleanup but fear accidental deletion. Provide:

- preview before deletion;
- undo;
- whitelist/blacklist;
- delete by domain/query/date;
- "delete from now on" blacklisting;
- "keep these domains forever" retention rules.

### 4. Honest Limitations

The product should clearly say:

- it keeps unlimited local history from installation onward;
- it cannot recover history Chrome already deleted unless imported;
- imported archive data may live in BrowseVault even if Chrome native history does not show it;
- browser APIs may limit mobile/account/device history access.

## UX Principles

- First screen should be the usable history/search interface, not a marketing page.
- Search input focused by default.
- Timeline and result list should be dense and scannable.
- Use light and dark themes from day one.
- Make backup status visible but not noisy.
- Avoid charts in the primary workflow; keep analytics secondary.
- Never surprise users with default history replacement or destructive cleanup.

## Monetization Direction

The review data shows users are sensitive to ads and hidden business models. Avoid ad monetization entirely.

Possible paid features:

- encrypted user-owned sync;
- AI semantic search over local archive;
- cross-browser/profile consolidation;
- advanced export/reporting;
- team/compliance features for work logs.

Free tier should still include:

- local unlimited capture;
- basic search;
- manual export;
- manual backup;
- no ads.

## Suggested Build Order

1. Local capture and durable storage.
2. Search index and results UI.
3. Backup/export/import integrity.
4. Bulk selection and deletion.
5. Command palette for tabs/bookmarks/history/downloads.
6. Whitelist/blacklist and retention rules.
7. Analytics and optional AI search.

## Success Metrics

Activation:

- user can find a prior page within 10 seconds after opening the extension;
- backup is configured or manually created within first session.

Retention:

- weekly search usage;
- successful backups over time;
- import/export usage;
- fewer support cases for "lost history" and "search does not find it."

Quality:

- search latency under 100 ms for common queries on a 100k-record archive;
- no UI-thread stalls over 50 ms during import/search;
- backup restore test passes for generated archives;
- zero network requests unless an explicit sync/import destination is configured.

