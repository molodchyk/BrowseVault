# Manual Browser QA Checklist

This checklist records the browser-extension playbook requirement to load the unpacked extension in the target browser before release.

Fill this checklist after the final source commit. `npm run release:ready` reads the working-tree checklist and compares the `Commit` field to the current `HEAD`, so completed release evidence should remain uncommitted while running the final release-readiness gate.

Do not use automated Chrome or Playwright runs against a live Chrome profile for this checklist. Run it manually in the target browser after pausing local focus-blocking tools if needed.

Do not create or target named personal Chrome profiles such as `Your Chrome` for this checklist.

Do not troubleshoot, clean up, delete, or otherwise mutate Chrome profile folders or Chrome user-data folders from Codex.

Do not use repo scripts or assistant-driven browser automation to pass `--profile-directory`, `--load-extension`, `--disable-extensions-except`, or remote debugging flags to Chrome for this checklist.

Do not use browser-control plugins, Chrome-control MCP tools, Playwright browser launches, CDP attachment, or the in-app browser for BrowseVault repo work.

Do not add repo scripts that launch Chrome or Chromium executables such as `chrome.exe`, `google-chrome`, `chromium-browser`, or `Google Chrome.app`.

If a Chrome/profile issue happens, stop repo work that touches Chrome and handle Chrome manually.

## Evidence Header

- Tester:
- Date:
- Commit:
- Operating system:
- Browser and version:
- Loaded folder:
- Extension ID:
- Result: Not run

Set `Result` to `Pass` only after every required flow check is `Pass`.

## Preflight

- Record the current `git rev-parse --short=7 HEAD` value in the `Commit` field.
- Open `chrome://extensions`.
- Enable Developer mode.
- Load this repository folder unpacked.
- Confirm the extension loads without manifest, service-worker, or console errors that block normal use.

## Automated Gate Checks

Record `Pass`, `Fail`, or `Not run` plus notes for each command. These commands must pass on the same commit recorded in the Evidence Header. `npm run release:ready` rejects blank Notes cells.

| Command | Result | Notes |
| --- | --- | --- |
| npm run store:media | Not run | |
| npm run validate | Not run | |
| npm run check | Not run | |
| npm test | Not run | |
| npm run package | Not run | |
| npm run verify:package | Not run | |
| git diff --check | Not run | |

## Required Flow Checks

Record `Pass`, `Fail`, or `Not run` plus notes for each item. `npm run release:ready` rejects blank Notes cells.

| Check | Result | Notes |
| --- | --- | --- |
| Toolbar action opens BrowseVault. | Not run | |
| Keyboard command opens BrowseVault when configured by the browser. | Not run | |
| First screen is the History search workflow, not a marketing screen. | Not run | |
| Search input is focused or immediately reachable, and a normal query returns usable results. | Not run | |
| Long URLs and titles stay inside the viewport with no page-level horizontal scrollbar. | Not run | |
| Settings, Rules, Backup, and retention action buttons stay compact instead of stretching across the page. | Not run | |
| Opening BrowseVault from a non-BrowseVault active tab creates another BrowseVault tab instead of enforcing one global app tab. | Not run | |
| Deleting a vault record in one BrowseVault tab refreshes another open BrowseVault tab. | Not run | |
| Rules list groups Category, Blacklist, and Whitelist rows by type rather than repeating the type on every row. | Not run | |
| Theme, accent, contrast, text size, date display, and default result-limit settings save and apply. | Not run | |
| Open Chrome History opens the native browser history page. | Not run | |
| JSON backup export completes and reports backup health, restore confidence, and self-test status. | Not run | |
| Import preview appears for a supported archive file and can be canceled safely. | Not run | |
| Reset Vault is visible in Settings/Backup workflows and clearly says it does not delete Chrome history. | Not run | |
| Chrome Web Store screenshots match the current UI and store listing copy. | Not run | |

## Release Decision

- Ship decision:
- Blocking issues:
- Follow-up issues:
- Screenshots or notes location:

Set `Ship decision` to `Ship` only when the release is ready. Fill `Blocking issues`, `Follow-up issues`, and `Screenshots or notes location`. Run `npm run release:ready` after filling this checklist.
