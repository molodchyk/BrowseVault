# Browser History Extension Research

Research date: 2026-06-13

Source basis: user-provided Chrome Web Store listing/review text from attachments and pasted content in the Codex thread. Review dates in the source run through 2026-06-07.

## Source Inventory

Raw source snapshots are preserved in [`raw-sources/`](raw-sources/) and indexed in [`source-inventory.md`](source-inventory.md).

## Competitor Snapshot

### Browser History Plus

- Rating/users: 4.2, 57 ratings, 60,000 users.
- Category: Privacy and Security.
- Positioning: replaces default browser history, calendar view, advanced search, cleanup of cache/history/downloads/cookies.
- Strengths users like: simple control over browsing data, clear cache/history cleanup, more usable than Chrome history for some workflows.
- Key complaints:
  - severe slowdown and Chrome crash after opening extension history page;
  - "doesn't work" or "Chrome killed it";
  - no `host:` or site-specific search;
  - no shift-click/multi-select/select range;
  - no keyboard shortcut/focus for search;
  - dark-only UI, missing light theme;
  - automatic removal ran even when "Automatic remove Data" was off.

### Better History

- Rating/users: 4.7, 1.5k ratings, 100,000 users.
- Version observed: 7.0.0, updated 2025-10-24.
- Positioning: history manager with advanced search, bulk export, custom deletion, filter by day/hour, domain blocking, smart cleanup, whitelist, CSV/HTML export, device tabs, light/dark modes.
- Strengths users like:
  - far better than Chrome's default history;
  - useful date/hour filtering;
  - good UI;
  - blacklist and whitelist features;
  - Ctrl+H reassignment appreciated by some users;
  - cross-browser usefulness.
- Key complaints:
  - permission prompts on every new site are annoying;
  - review-nag popup reduces trust;
  - some history entries not deleted while extension is enabled;
  - search misses results visible in default view;
  - search may not find older keyword results;
  - request for negative match/exclusion;
  - request for "select all" in search/filter results;
  - "only keeps 3 months" complaint from users expecting unlimited local retention;
  - broken/no history reports;
  - repeated "Sorry, no visits found" per empty day instead of compact range messaging.

### History Plus

- Rating/users: 4.3, 62 ratings, 8,000 users.
- Version observed: 2.0.8, updated 2024-11-21.
- Positioning: better browsing history, save history beyond 90 days, advanced search, autobackup, import/export, pins, automatic categories, quick filtering, top visits.
- Strengths users like:
  - unlimited history beyond Chrome/Edge retention;
  - Chinese search support;
  - compatible import from History Trends Unlimited;
  - automatic incremental backup;
  - categories and organization;
  - simple/direct UI.
- Key complaints:
  - one-tab limitation;
  - imported or historical titles become "untitle";
  - old icons disappear after 90 days;
  - large import quality problems, such as 90k imported with around 20k untitled;
  - title preservation problem when same URL later changes title;
  - backups failed for at least one user after data loss;
  - export format confusion and missing date/time in export;
  - import is visible in the extension but not in Chrome itself;
  - auto-categorization inaccurate;
  - users want custom categories/rules;
  - users want closed window/session history;
  - default history replacement is polarizing;
  - users want WebDAV or configurable backup destination;
  - users want page jumps, better pagination, current result export, range selection, and selected-item export;
  - users want open source/GitHub availability.

### Export Chrome History

- Rating/users: 4.5, 57 ratings, 100,000 users.
- Version observed: 1.0.2.0, updated 2022-06-09.
- Positioning: minimal export of Chrome history to CSV or JSON.
- Strengths users like:
  - simple and clean;
  - CSV/JSON is useful for spreadsheet workflows;
  - solves documentation/recovery use cases;
  - low permission surface.
- Key complaints:
  - only exports recent/local history, often perceived as 90 days;
  - no import feature;
  - incomplete export for some users;
  - only current device, no mobile/Google account history;
  - date format not Excel-friendly for some locales;
  - incorrect titles/URLs in some exports;
  - month button or time range bugs;
  - desire for settings and filters.

### History Trends Unlimited

- Rating/users: 4.5, 471 ratings, 60,000 users.
- Version observed: 1.8.9, updated 2026-05-23.
- Positioning: unlimited local history with search, charts/stats, raw data export, and transfer to new computer.
- Strengths users like:
  - keeps years of history;
  - local-only storage;
  - export is valuable;
  - can find pages from years ago;
  - advanced search/wildcards/exclusion are appreciated;
  - "invisible when not needed" and simple when needed.
- Key complaints:
  - search quality problems, especially partial words and Chinese/CJK phrases;
  - request for regex and better wildcard behavior;
  - database corruption and data loss, including SQLite/OPFS errors;
  - backups/download notifications are annoying;
  - users want backup path and filename template settings;
  - users want duplicate removal and a way to ignore domains;
  - some users still do not understand or trust whether it can go beyond 90 days;
  - old-looking UI/icon feedback.

### Recent History

- Rating/users: 4.2, 559 ratings, 40,000 users.
- Version observed: 26.4.4, updated 2026-04-04.
- Positioning: popup for recent history, recently closed tabs, most visited pages, and recent bookmarks.
- Strengths users like:
  - useful quick popup;
  - recent/closed-tab recovery;
  - better than Chrome default for quick access;
  - simple batch deletion use case.
- Key complaints:
  - slow reload/loading forever;
  - only 3 months;
  - search barely works or only searches current day;
  - no backups;
  - random popup ads or ad tabs;
  - spyware/malware suspicion;
  - surprise new tabs without permission;
  - history disappeared after update;
  - dark mode requested;
  - small/invisible toolbar icon;
  - popup closes when clicking an item;
  - open in background does not work;
  - calendar day-of-week bug.

### letmefix browser

- Rating/users: 5.0, 4 ratings, 265 users.
- Version observed: 0.1.1, updated 2025-04-02.
- Positioning: Spotlight-style command/search interface for tabs, bookmarks, history, app shortcuts, calculator, and browser actions.
- Strengths users like:
  - command palette concept resonates with power users;
  - tab switching plus history/bookmark search is a strong combined workflow;
  - low review count but strong positive language.
- Key risk:
  - too little review volume to prove broad-market demand or reliability.

## Market Gap

Existing products cover pieces of the job:

- simple export;
- recent history popup;
- unlimited local history;
- charts and analytics;
- advanced deletion and cleanup;
- Spotlight-like tab/history/bookmark search.

The gap is a product that combines these without breaking trust:

- fast search that actually finds the target;
- unlimited local retention from install onward;
- safe backup/restore that users believe;
- precise bulk cleanup;
- no ads, no hidden behavior, no surprise hijacking;
- transparent import/export and migration.
