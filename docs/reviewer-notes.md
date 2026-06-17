# Reviewer Notes

These notes summarize behavior that browser-store reviewers should not need to infer from source code.

## Browser-Controlled Limits

- BrowseVault can preserve Chrome history from the time the extension is installed and running.
- BrowseVault cannot recover visits Chrome already deleted unless the user imports older data from another source.
- Chrome extension APIs generally cannot write arbitrary old imported visits back into Chrome's native history database.
- Mobile, synced-device, account, or other-profile history depends on what Chrome exposes locally or what the user imports.
- Incognito history is not captured unless the browser allows the extension to run in incognito and exposes the relevant local history events.
- Local backup/import files are handled only when the user chooses a file or export action; BrowseVault does not request `file://` host access or crawl local file URLs.

## Chrome History Behavior

- BrowseVault does not replace Chrome's native history page by default.
- The app opens from the toolbar action or keyboard command.
- Settings includes an explicit link to open Chrome's native history page.
- Deleting records from the BrowseVault vault is separate from deleting URLs from Chrome history.
- Chrome history deletion uses Chrome's URL-level history API, so deleting a URL can affect all native Chrome visits for that URL.

## Data Handling

- BrowseVault stores its archive locally in the user's browser profile.
- It does not include analytics, ads, tracking scripts, remote code, content scripts, host permissions, or automatic page-content capture.
- It does not make network requests by default.
- JSON backups, CSV exports, HTML exports, and imports happen only after user action.

## Permissions

- `history`: local archive sync, new-visit capture, history search, and explicit URL-level Chrome history deletion.
- `bookmarks`: Quick Open bookmark search.
- `downloads`: Quick Open download search and optional Save As prompts for generated backup/export files.
- `sessions`: Quick Open recently closed tab and window search/restore.
- `storage`: local extension preferences and archive metadata.
- `tabs`: Quick Open tab search/actions and opening BrowseVault.

## Package Review

`npm run validate` checks manifest permissions, missing required files, icon dimensions, store-listing inputs, privacy-form keys, no default Chrome history override, no host permissions, no content scripts, no external messaging surface, no network APIs, no remote URLs, and no dynamic code loaders in extension source. `npm run check` verifies JavaScript syntax, static import resolution, extension-page module script paths, file-size budgets, and folder-density budgets.
