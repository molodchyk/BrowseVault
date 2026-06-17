# Release Notes

BrowseVault release notes live in the root [`CHANGELOG.md`](../CHANGELOG.md) so users, reviewers, and package checks have one canonical history.

## 1.0.0 - 2026-06-17

Initial public-release baseline for BrowseVault: History Search & Backup.

Release focus:

- local-first Chrome history archive with background capture and manual sync;
- advanced history search, bulk selection, export, deletion, and undoable vault cleanup;
- Quick Open across open tabs, bookmarks, downloads, recently closed tabs, and closed windows;
- JSON backup import/export with integrity metadata and self-test checks;
- settings for theme, accent, text size, date display, result limit, backup reminders, and export filenames;
- domain blacklist, whitelist, manual category rules, retention cleanup, and duplicate cleanup;
- StorePilot-ready Chrome Web Store import structure, including localized manifest messages, listing body, store media, category/additional/privacy documents, and validator coverage;
- no default Chrome history-page override, host permissions, content scripts, remote code, analytics, ads, tracking, or default network requests;
- no default network requests from the extension source package.

For the full trust-sensitive change list, including permissions, deletion behavior, backup behavior, Chrome history limits, and package contents, see [`CHANGELOG.md`](../CHANGELOG.md).
