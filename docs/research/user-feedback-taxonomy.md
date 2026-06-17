# User Feedback Taxonomy

This file groups review feedback into actionable product needs. It focuses on complaints and demand signals that can guide a better implementation.

## 1. History Retention Pain

Users repeatedly discover that Chrome/Chromium-based browsers do not keep local browser history as long as they expected.

Observed language patterns:

- "only keeps 3 months";
- "can only search 3 months";
- "I wanted to go back to pages I saw years ago";
- "Chrome deletes your history every few months";
- "Why doesn't Chrome do this by default?"

Product implication:

- Preserve history locally from install onward.
- Be explicit that old history already deleted by Chrome cannot be recovered unless imported from another source.
- Make import from Google Takeout and competitor exports a core feature, not an afterthought.

## 2. Search Quality Complaints

Search is the most important day-to-day workflow after retention.

Common complaints:

- results visible in normal history do not show in extension search;
- search only works for current day or recent history;
- no host/site search like `site:google.com` or `host:google.com`;
- no negative match/exclusion;
- partial word search is weak;
- regex or wildcard behavior is missing or too limited;
- Chinese/CJK search is incomplete or broken;
- search input does not auto-focus;
- search requires pressing Enter when users expect live results.

Product implication:

- Build a real query parser and index instead of a simple text filter.
- Support URL, title, domain, date, visit count, and source filters.
- Include CJK tokenization and substring indexing.
- Add keyboard-first behavior: open, focus input, type, Enter.

## 3. Performance and Stability Complaints

Users punish extensions that affect Chrome performance.

Common complaints:

- opening the history page makes all tabs slow;
- Chrome crashes;
- loading takes forever;
- extension reload is slow;
- database errors break the product;
- extension stops recording history.

Product implication:

- Never scan huge datasets on the UI thread.
- Use incremental indexing.
- Use workers for expensive search/import/export.
- Add watchdog/status UI for recorder health.
- Add performance tests with large synthetic datasets.

## 4. Data Loss and Backup Trust

Data loss is the highest-severity failure in this category.

Common complaints:

- extension deleted all history;
- local database corrupted;
- backup files did not restore;
- automatic backups are confusing or annoying;
- users need monthly/manual backups because they do not trust the extension;
- backup destination and naming cannot be configured.

Product implication:

- Treat history as user-owned critical data.
- Use append-only event logs plus derived indexes.
- Keep restore tests in the product workflow.
- Show backup status, last successful backup, next backup, and restore confidence.
- Allow user-owned storage destinations where APIs permit it.

## 5. Bulk Selection and Cleanup Complaints

Users often want to delete or export many entries, but not all entries.

Common complaints:

- no shift-click range selection;
- no multi-select;
- no select all filtered results;
- too much one-by-one clicking;
- cannot export selected items;
- cannot delete 97 out of 100 quickly;
- deleting from the extension sometimes does or does not delete Chrome history, depending on product, which surprises users.

Product implication:

- Bulk actions are first-class.
- Every filtered result set should support select all, range select, invert selection, export selected, delete selected, and undo.
- Clearly distinguish "delete from app archive" vs "delete from Chrome history" where both are possible.

## 6. Import/Export Complaints

Users care about data portability.

Common complaints:

- only CSV/JSON export, no import;
- export misses data;
- date/time fields are not Excel-friendly;
- date selection or date display fails;
- times are hidden, truncated, or out of order;
- exported titles/URLs can be incorrect;
- import creates "untitle" titles;
- imported data appears in the extension but not Chrome;
- mobile history and Google account history are not included;
- users want cross-browser transfer.

Product implication:

- Support CSV, JSON, HTML, and a native archive format.
- Include schema versioning.
- Validate export row counts and import integrity.
- Treat date/time display as a first-class data-quality feature, not only a visual detail.
- Preserve title history by visit, not only by URL.
- Make limitations clear: browser APIs usually cannot write arbitrary old visits back into Chrome's native history in the way users imagine.

## 7. Trust and Privacy Complaints

Trust failures dominate negative reviews for some extensions.

Common complaints:

- random ad popups;
- extension opens new tabs without permission;
- spyware/malware accusations;
- review nag popup;
- surprise behavior after updates;
- suspicious permission prompts.

Product implication:

- No ads.
- No review nagging.
- No network by default.
- Local-first privacy messaging backed by implementation.
- Permission requests should be explained before they occur.
- Changelog should highlight behavior changes, especially deletion, default-history replacement, backup, and network features.

## 8. UI and Theme Complaints

UI feedback is lower risk than data loss but still repeated.

Common complaints:

- missing light mode;
- missing dark mode;
- dark-mode contrast bugs that make text unreadable;
- horizontal scrollbars on large screens;
- small/invisible icons;
- poor visual separation between sections;
- settings and "show all history" controls should be sticky;
- repeated empty-day messages create clutter;
- popup closes after opening an item.

Product implication:

- Ship light and dark themes from day one.
- Test theme contrast against real result rows, URLs, timestamps, and metadata.
- Keep core controls sticky.
- Use dense but clear layouts.
- Avoid decorative UI that slows scanning.
- Design empty states by range, not one message per day.

## 9. Default History Replacement Conflict

Some users want the extension to replace Chrome history. Others strongly dislike surprise hijacking.

Product implication:

- Do not surprise users.
- If using `chrome_url_overrides.history`, explain that the manifest-level override is not a normal runtime toggle.
- Consider a command shortcut and toolbar entry as the default path.
- If default replacement is offered, provide a clear way to access native Chrome history and document the limitation.

## 10. Positive Demand Signals

The strongest positive signals:

- users call good history tools "must-have";
- users install them across multiple browsers/profiles;
- people use exports for work logs, research recovery, and auditing;
- users value local-only storage;
- users want years of history;
- users appreciate simple UI when it is fast and reliable;
- command-palette tab/history/bookmark search has strong power-user appeal.

## Priority Ranking

P0:

- reliable local capture beyond Chrome retention;
- fast accurate search;
- no data loss;
- backup/restore integrity;
- no ads or surprise network behavior.

P1:

- bulk selection and cleanup;
- import/export;
- light/dark themes;
- keyboard shortcuts and search autofocus;
- clear permission/onboarding UX.

P2:

- analytics/charts;
- AI-assisted semantic search;
- custom categories/rules;
- cross-browser sync through user-owned storage;
- closed window/session history.
