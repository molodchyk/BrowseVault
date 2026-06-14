# Privacy

BrowseVault is intended to be local-first.

Current scaffold behavior:

- Searches Chrome history only when the BrowseVault page is open.
- Exports a JSON backup only when the user clicks the export button.
- Stores only lightweight local metadata in `chrome.storage.local`.
- Does not automatically read page contents.
- Does not take screenshots.
- Does not make remote network requests.
- Does not include analytics, ads, or tracking scripts.

Current permissions:

- `history`: searches browser history and can later listen for new visits.
- `storage`: saves local extension state and future archive metadata.
- `tabs`: opens the BrowseVault page from the extension action.

Planned product direction:

- Preserve history locally from installation onward.
- Keep backup and restore as first-class workflows.
- Make destructive cleanup actions explicit and reversible where possible.
- Request optional permissions only when a feature needs them.
- Keep network, sync, and AI features opt-in.

