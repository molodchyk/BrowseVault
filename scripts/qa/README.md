# QA Helpers

This folder is reserved for repo-owned QA helpers that are safe to run from a fresh clone.

Do not add scripts here that launch, attach to, or mutate an active Chrome profile. Do not create or target named personal Chrome profiles such as `Your Chrome`. Do not troubleshoot, clean up, delete, or otherwise mutate Chrome profile folders or Chrome user-data folders from repo QA helpers. Do not use browser-control plugins, Chrome-control MCP tools, Playwright browser launches, CDP attachment, or the in-app browser for BrowseVault repo work. Do not launch Chrome or Chromium executables such as `chrome.exe`, `google-chrome`, `chromium-browser`, or `Google Chrome.app` from repo QA helpers. Browser QA for BrowseVault is manual, as documented in `docs/release/release-qa.md`.

Current automated release checks stay non-browser:

- `npm run validate`
- `npm run check`
- `npm test`
- `npm run package`
- `npm run verify:package`
