# Browser Extension Playbook Compliance

This file maps BrowseVault release evidence to the shared browser-extension playbook at `C:\Users\molod\Documents\Personal\settings\browser-extension-playbook.md`.

## Product Shape

| Playbook expectation | BrowseVault evidence |
| --- | --- |
| Name describes concrete browser behavior. | `manifest.json` resolves to `BrowseVault: History Search & Backup` through `_locales/en/messages.json`. |
| Summary says what changes for the user in one sentence. | `_locales/en/messages.json` uses `Search, back up, export, and preserve your browser history locally.` |
| First screen performs the core job. | `src/app.html` starts on the History tab with search/results before secondary Backup, Rules, and Settings tabs. |
| Permissions are minimal and explainable. | `manifest.json`, `PRIVACY.md`, `docs/chrome-web-store-privacy-form.md`, and `scripts/check-privacy-permissions.mjs`. |
| No analytics, broad host permissions, search changes, extra surfaces, or remote calls by default. | `scripts/validate-extension.mjs` enforces a manifest key allowlist and blocks `chrome_settings_overrides`, `chrome_url_overrides`, `content_scripts`, DNR, omnibox, side-panel, options-page, host permissions, and web-accessible resources. |
| Visible reset path before uninstall. | Settings includes the explicit `Reset Vault` action and README documents local reset behavior. |

## Repository Shape

| Playbook expectation | BrowseVault evidence |
| --- | --- |
| README explains goal, load-unpacked steps, checks, privacy, license, and source URL. | `README.md`; exact license/source and support blocks are enforced by `npm run validate`. |
| Full license text and SPDX metadata. | `LICENSE`; `package.json` uses `GPL-3.0-only`; both are checked by `npm run validate`. |
| Plain-language privacy policy. | `PRIVACY.md` lists stored data, storage area, network behavior, permissions, and sale/sharing posture. |
| Small auditable manifest. | `manifest.json`; `scripts/validate-extension.mjs` manifest key allowlist; `scripts/check-manifest-paths.mjs`; `scripts/check-privacy-permissions.mjs`. |
| Human-authored source, assets, docs, store copy, scripts, and tests are separated. | Root project structure in `README.md`; `scripts/check-folder-density.mjs`. |
| StorePilot Chrome Web Store import layout. | `store-listing/chrome-web-store/`, `docs/storepilot-project-structure.md`, and `npm run validate`. |

## Store Listing Copy

| Playbook expectation | BrowseVault evidence |
| --- | --- |
| Direct concrete store copy with browser limitation notes. | `store-listing/chrome-web-store/listing/en.md`, `store/listing.md`, and `docs/release/reviewer-notes.md`. |
| Claims are provable. | `npm run validate` checks store footer, permissions, privacy disclosures, media dimensions, and no remote/network/dynamic-code claims. |
| Open-source footer includes license and GitHub link. | `store-listing/chrome-web-store/listing/en.md`; checked by `npm run validate`. |
| Store media exists at required dimensions and is reviewed against current UI/store copy. | `npm run store:media`; `npm run validate` checks screenshot and promo dimensions; `docs/chrome-web-store-media.md` maps each screenshot to UI/store-copy claims; `npm run release:ready` requires manual screenshot review evidence. |

## Localization

| Playbook expectation | BrowseVault evidence |
| --- | --- |
| English UI strings are externalized before broader localization. | `_locales/en/messages.json`; `src/features/app-shell/ui/localization.js`; `scripts/check-locales.mjs`. |
| Store-visible manifest strings use Chrome localization. | `manifest.json` uses `__MSG_*__` values and `default_locale: "en"`. |
| Shared localization workflow is recorded for future language expansion. | `docs/README.md` links to the Defense against Distractions localization reference; `scripts/check-locales.mjs` enforces Chrome `_locales` and UI binding coverage. |

## UI Expectations

| Playbook expectation | BrowseVault evidence |
| --- | --- |
| First screen performs the main job instead of marketing. | `src/app.html` opens on the History tab with search, saved searches, date shortcuts, result state, and results list. |
| Options/settings expose main preferences immediately. | Settings starts with `Display and search defaults`, `Save Settings`, theme/accent/contrast/text/date/result-limit/backup controls, and the native-history escape hatch. |
| Browser-native vocabulary is used when Chrome owns behavior. | Labels distinguish `Delete From Vault`, `Delete URLs From Chrome`, `Delete Results From Chrome`, and `Open Chrome History`; reviewer notes document URL-level Chrome deletion. |
| Destructive actions are explicit and guarded. | `src/features/vault-management/ui/actions.js` uses confirmations, undoable vault deletion where possible, and cross-tab vault-change notifications; tests cover empty/canceled destructive states. |
| Long URLs and labels stay inside the viewport. | `src/styles/tokens.css` prevents page-level horizontal overflow; `src/styles/results.css` wraps result titles, URLs, metadata, and rule values; `npm run validate` enforces these guardrails. |
| Dark, light, and blank states are intentional. | Settings includes system/light/dark themes, contrast and text-size preferences; activity/rules/quick-result tests cover empty states. |

## Privacy And Permissions

| Playbook expectation | BrowseVault evidence |
| --- | --- |
| Exact browser permissions are listed and justified. | `PRIVACY.md`, `docs/chrome-web-store-privacy-form.md`, `docs/release/reviewer-notes.md`. |
| Storage areas are named. | `PRIVACY.md` states archive storage in IndexedDB and preferences/metadata in Chrome local extension storage. |
| Network, analytics, ads, tracking, content scripts, and remote code are disclosed. | `PRIVACY.md`; `scripts/validate-extension.mjs`; `scripts/check-privacy-permissions.mjs`; `scripts/verify-package.mjs`. |
| Privacy stays aligned with manifest and package output. | `npm run validate`, `npm run check`, `npm run package`, `npm run verify:package`. |

## Reviewer Notes And Release Checks

| Playbook expectation | BrowseVault evidence |
| --- | --- |
| Reviewer notes cover browser-controlled limits. | `docs/release/reviewer-notes.md`. |
| Narrow checks inspect the release package. | `docs/release/release-qa.md`; `scripts/package-extension.mjs`; `scripts/verify-package.mjs` verifies required entries, static imports, locale references, remote-code/network patterns, and exact package freshness against the current source tree. |
| Load the unpacked extension before release. | `docs/release/release-qa.md` records this as a required manual check when local focus-blocking tools prevent reliable automated Chrome runs. |
