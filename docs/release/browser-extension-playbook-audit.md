# Browser Extension Playbook Audit

This audit records current evidence against the shared browser-extension playbook at `C:\Users\molod\Documents\Personal\settings\browser-extension-playbook.md`.

Status terms:

- `Verified`: current repository files or automated checks prove the requirement.
- `Manual required`: the requirement needs target-browser evidence before release.

## Audit Summary

| Area | Status | Evidence |
| --- | --- | --- |
| Product shape | Verified | `manifest.json`, `_locales/en/messages.json`, `src/app.html`, `PRIVACY.md`, `scripts/playbook/validate-manifest-surface.mjs`, `scripts/playbook/validate-playbook-compliance.mjs` |
| Repository shape | Verified | `README.md`, `LICENSE`, `PRIVACY.md`, `docs/`, `store-listing/chrome-web-store/`, `scripts/validate-extension.mjs`, `scripts/check-folder-density.mjs` |
| Store listing copy | Verified | `store/listing.md`, `store-listing/chrome-web-store/listing/en.md`, `docs/chrome-web-store-additional-fields.md`, `docs/chrome-web-store-category.md`, `docs/chrome-web-store-privacy-form.md`, `docs/chrome-web-store-media.md`, `scripts/validate-extension.mjs` |
| Localization baseline | Verified | `_locales/en/messages.json`, `src/features/app-shell/ui/localization-map.js`, `src/features/app-shell/ui/localization.js`, `scripts/check-locales.mjs`, `docs/README.md` |
| Open source and license | Verified | `LICENSE`, `package.json`, `README.md`, `store-listing/chrome-web-store/listing/en.md`, `scripts/playbook/validate-playbook-compliance.mjs` |
| README support block | Verified | `README.md`, `scripts/playbook/validate-playbook-compliance.mjs` |
| Privacy and permissions | Verified | `manifest.json`, `PRIVACY.md`, `docs/chrome-web-store-privacy-form.md`, `scripts/check-privacy-permissions.mjs`, `scripts/verify-package.mjs` |
| UI expectations | Verified by source/tests | `src/app.html`, `src/styles/`, `test/features/`, `scripts/playbook/validate-playbook-compliance.mjs` |
| Reviewer notes | Verified | `docs/release/reviewer-notes.md`, `scripts/validate-extension.mjs` |
| Release package checks | Verified by command gate | `npm run validate`, `npm run check`, `npm test`, `npm run package`, `npm run verify:package`, `git diff --check`; `npm run release:ready` requires those automated gates to be recorded as `Pass` for the current Git commit |
| Codex protocol | Verified by repo process docs and guardrails | `docs/README.md`, `docs/research/source-inventory.md`, `scripts/playbook/check-reference-sync.mjs`, `scripts/playbook/check-store-metadata.mjs`, `scripts/check-privacy-permissions.mjs`, `scripts/verify-package.mjs` |
| Target-browser load-unpacked check | Manual required | `docs/release/manual-browser-qa-checklist.md`; `npm run release:ready` fails until evidence is recorded for the current Git commit |

## Requirement Evidence

| Playbook requirement | Current evidence | Status |
| --- | --- | --- |
| Name describes concrete browser behavior. | Manifest-localized name is `BrowseVault: History Search & Backup`. | Verified |
| Summary says what changes for the user in one sentence. | Manifest/store summary is `Search, back up, export, and preserve your browser history locally.` | Verified |
| First screen performs the core job. | `src/app.html` opens on the History search panel; validation checks the default History panel. | Verified |
| Permissions are minimal and explainable. | Manifest has six explicit permissions and no host, optional, content-script, override, or network-facing surfaces; privacy docs justify each permission. | Verified |
| Visible reset path before uninstall. | Settings includes `Reset Vault`; README and validation document that it does not delete Chrome history. | Verified |
| README covers goal, load-unpacked steps, checks, privacy, license, and source URL. | `README.md` contains these sections and `validatePlaybookCompliance` checks the key text. | Verified |
| GPL-3.0 license is present in repo and metadata. | `LICENSE`, `package.json`, README, and store footer are checked. | Verified |
| StorePilot Chrome Web Store structure follows the shared reference. | `docs/storepilot-project-structure.md`, `store-listing/chrome-web-store/`, and StorePilot field docs match the reference and are validated. | Verified |
| Store copy is direct, concrete, and free of inflated claims. | Store body has one-sentence purpose, privacy boundary paragraph, examples, feature list, browser/data limits, and GPL GitHub footer. | Verified |
| Screenshots stay consistent with current UI and store copy. | `docs/chrome-web-store-media.md` maps the screenshots to UI/store-copy claims, and `npm run release:ready` requires manual screenshot review evidence. | Manual required |
| Localized UI strings are externalized before broader localization. | English `_locales` and UI binding map are checked by `scripts/check-locales.mjs`. | Verified |
| Privacy copy lists exact permissions, storage, network behavior, analytics/ads/tracking, content scripts, and remote code posture. | `PRIVACY.md` and StorePilot privacy form are checked by `scripts/check-privacy-permissions.mjs`. | Verified |
| UI uses browser-native vocabulary and explicit destructive actions. | Labels distinguish vault deletion, Chrome URL deletion, native Chrome History, and Reset Vault; tests cover destructive-action guards. | Verified |
| Reviewer notes document browser-controlled limits. | `docs/release/reviewer-notes.md` covers Chrome retention, imports, incognito, file URLs, URL-level deletion, and native-history behavior. | Verified |
| Release checks inspect the package users receive. | `scripts/package-extension.mjs` and `scripts/verify-package.mjs` create and inspect a runtime-only ZIP; `scripts/playbook/check-release-readiness.mjs` requires automated gate evidence before release. | Verified |
| Codex work protocol is represented in the repo. | Reference sync keeps local playbooks current, store/privacy/package checks keep claims synchronized, Chrome QA safety checks protect user browser profiles, and release docs define the required checks. | Verified |
| Load the unpacked extension in the target browser. | Manual checklist exists, and `npm run release:ready` verifies it is filled out for the current Git commit before release. No target-browser evidence has been recorded in this environment. | Manual required |

## Manual Release Evidence Still Needed

Before calling the full playbook implementation complete, fill out the automated gate table and manual browser flow table in `docs/release/manual-browser-qa-checklist.md` after manually loading this repository folder unpacked in the target browser, then run `npm run release:ready`. Do not use automated Chrome or Playwright runs against a live Chrome profile, and do not create or target named personal Chrome profiles such as `Your Chrome`.
