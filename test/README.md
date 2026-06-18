# BrowseVault Tests

Tests are grouped by feature or responsibility to keep folder scans small:

- `features/` mirrors feature-owned product areas.
- `platform/` covers browser/platform wrappers.
- `query/` covers shared query parsing and matching.
- `scripts/` covers repository and release guardrails.
- `storage/` covers shared IndexedDB import/storage behavior.

Do not add new root-level `*.test.js` files. Place new tests beside the feature or responsibility they verify, and split a subfolder again if it grows past the folder-density targets in `docs/architecture/extension-modularization-playbook.md`.

Do not add automated tests that launch or attach to Chrome, Chromium, Playwright, CDP, browser-control tools, the active Chrome profile, or Chrome profile folders. BrowseVault target-browser QA is manual in this workspace; `npm run validate` scans tests for live Chrome profile automation patterns.
