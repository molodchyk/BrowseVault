# Privacy

BrowseVault is intended to be local-first.

Current extension behavior:

- Stores the BrowseVault archive locally in IndexedDB.
- Captures new Chrome history visits in the background after installation.
- Imports currently available Chrome history when the extension is installed, started, or manually synced, including individual visits where Chrome exposes them.
- Searches open tabs, bookmarks, downloads, and recently closed tabs only in the local extension UI.
- Imports JSON, CSV, TSV, and Google Takeout-style files only when the user chooses a local file.
- Exports JSON, CSV, or HTML only when the user clicks an export button.
- Adds a local SHA-256 checksum to JSON backups so later imports can warn about changed archive payloads.
- Stores display preferences locally in Chrome extension storage.
- Does not automatically read page contents.
- Does not take screenshots.
- Does not make remote network requests.
- Does not include analytics, ads, or tracking scripts.
- Can erase all BrowseVault local data without deleting Chrome history.

Current permissions:

- `history`: searches browser history, listens for new visits, and supports explicit URL-level Chrome history deletion.
- `bookmarks`: searches bookmark titles and URLs in Quick Open.
- `downloads`: searches download URLs and filenames in Quick Open.
- `sessions`: searches recently closed tabs in Quick Open.
- `storage`: saves local extension state and archive metadata.
- `tabs`: opens the BrowseVault page from the extension action.

Future product direction:

- Preserve history locally from installation onward.
- Keep backup and restore as first-class workflows.
- Make destructive cleanup actions explicit and reversible where possible.
- Request optional permissions only when a feature needs them.
- Keep network, sync, and AI features opt-in.
