# Chrome Web Store Listing Draft

This is the human editing draft for store positioning, SEO, and repository metadata.

StorePilot-ready import values live in:

- `store-listing/chrome-web-store/listing/en.md` for the detailed description body only.
- `docs/chrome-web-store-additional-fields.md` for homepage/support/official URL and mature-content fields.
- `docs/chrome-web-store-category.md` for the selected Chrome Web Store category.
- `docs/chrome-web-store-privacy-form.md` for privacy and permission justifications.

StorePilot does not import Name or Short Description from `listing/en.md`; keep those aligned with `manifest.json` and the Chrome Web Store dashboard.

## Name

BrowseVault: History Search & Backup

## Short Description

Search, back up, export, and preserve your browser history locally.

## One-Line Positioning

Private browser history search with local backup and export.

## Longer Description Draft

BrowseVault lets you search, preserve, back up, export, and clean up your Chrome browsing history locally.

Chrome's built-in history is easy to lose, hard to search deeply, and awkward to export when you need to retrace work. BrowseVault creates a local history vault in your browser profile, captures new visits after installation, syncs the Chrome history that Chrome still exposes, and imports history files you choose.

Popular ways to use BrowseVault:

- Find a page again with `site:`, `host:`, `title:`, `url:`, `after:`, `before:`, `date:`, `hour:`, quoted phrase, wildcard, exclusion, or `regex:` search.
- Save repeated searches for projects, clients, research trails, or troubleshooting work.
- Export the current result set or selected records as JSON, CSV, or offline HTML.
- Back up the full local vault as checksum-protected JSON and review restore health before importing.
- Search open tabs, bookmarks, downloads, recently closed tabs, and closed windows from Quick Open.
- Clean up selected vault records, filtered result sets, duplicate rows, or old records while keeping whitelist rules.

Feature list:

- Local IndexedDB archive with background capture for new visits.
- Manual Chrome history sync for history Chrome still exposes.
- Fast local search with typo-tolerant keywords, operators, saved searches, date shortcuts, highlighted matches, newest/oldest sorting, and grouped results.
- Bulk selection with checkbox, Shift-click, Shift+Space, select visible, invert visible, and select all filtered results.
- JSON backup import/export with SHA-256 metadata, self-test status, staged preview, and duplicate/import health summaries.
- CSV and HTML exports with exact timestamps, category labels, spreadsheet-safe text, filtering, sorting, and safer links.
- Quick Open for tabs, bookmarks, downloads, recently closed tabs, and closed windows.
- Domain blacklist, whitelist, and manual category rules.
- Explicit destructive actions with undo where the local vault supports it.
- Local display preferences for theme, contrast, text size, date format, default result limit, backup reminders, and export filenames.

Browser and data limits:

- BrowseVault can preserve history from installation onward; it cannot recover visits Chrome already deleted unless you import them from another file.
- Imported records live in BrowseVault; Chrome extension APIs do not reliably write arbitrary old visits back into Chrome's native history database.
- Deleting from the BrowseVault vault is separate from deleting URLs from Chrome history. Chrome history deletion is explicit and URL-based.
- BrowseVault keeps Chrome's native history page available from Settings instead of silently replacing it.
- The extension stores its archive locally in your browser profile. It does not include analytics, ads, tracking scripts, remote code, host permissions, or automatic page-content capture.

## Keywords

- Chrome history search
- browser history backup
- export Chrome history
- unlimited browser history
- private history search
- local-first history manager
- Chrome history export
- browsing history vault
- search browser history
- preserve browser history

## GitHub Description

Private local-first browser history search, backup, export, and preservation extension.

## GitHub Topics

- chrome-extension
- browser-history
- history-search
- history-backup
- local-first
- privacy-first
- export-history
- manifest-v3

## Store Footer

Open source under the GPL-3.0 license:
https://github.com/molodchyk/BrowseVault
