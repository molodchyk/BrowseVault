# Manual Browser QA Checklist

This checklist records the browser-extension playbook requirement to load the unpacked extension in the target browser before release.

Do not use automated Chrome or Playwright runs against a live Chrome profile for this checklist. Run it manually in the target browser after pausing local focus-blocking tools if needed.

Do not create or target named personal Chrome profiles such as `Your Chrome` for this checklist.

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

- Confirm `npm run store:media`, `npm run validate`, `npm run check`, `npm test`, `npm run package`, `npm run verify:package`, and `git diff --check` passed on the same commit.
- Open `chrome://extensions`.
- Enable Developer mode.
- Load this repository folder unpacked.
- Confirm the extension loads without manifest, service-worker, or console errors that block normal use.

## Required Flow Checks

Record `Pass`, `Fail`, or `Not run` plus notes for each item.

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
| JSON backup export completes and reports backup health/self-test status. | Not run | |
| Import preview appears for a supported archive file and can be canceled safely. | Not run | |
| Reset Vault is visible in Settings/Backup workflows and clearly says it does not delete Chrome history. | Not run | |

## Release Decision

- Ship decision:
- Blocking issues:
- Follow-up issues:
- Screenshots or notes location:

Set `Ship decision` to `Ship` only when the release is ready. Run `npm run release:ready` after filling this checklist.
