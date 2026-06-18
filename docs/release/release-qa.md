# Release QA

This file records release verification status for the current BrowseVault package.

Use [`browser-extension-playbook-audit.md`](browser-extension-playbook-audit.md) for the requirement-by-requirement playbook status.

## Automated Gates

Last verified for `1.0.0`:

```text
npm run store:media
npm run validate
npm run check
npm test
npm run package
npm run verify:package
git diff --check
```

After the manual browser QA checklist is complete, run:

```text
npm run release:ready
```

Expected results:

- extension validation passes;
- Chrome Web Store promo PNGs regenerate at the required `440 x 280` and `1400 x 560` dimensions;
- JavaScript syntax, static import resolution, extension-page module script path, manifest and extension UI locale coverage, manifest path, privacy/permission disclosure parity, file-size budget, and runtime/test/script/docs folder-density checks pass;
- unit tests pass;
- `dist/browsevault-1.0.0.zip` is produced;
- package ZIP verification passes, including packaged manifest path, locale message, static import, and module script target checks;
- package contains runtime extension files, root user-facing docs, and `_locales/en/messages.json`;
- package excludes repository research, tests, scripts, docs, StorePilot files, and build metadata.
- release readiness passes only after manual target-browser evidence is recorded in `manual-browser-qa-checklist.md`.
- release readiness rejects checklist evidence recorded for a different Git commit.

## Real Browser QA

The browser-extension playbook requires loading the unpacked extension in the target browser before release.

Required: Load the unpacked extension in the target browser before release.

Use [`manual-browser-qa-checklist.md`](manual-browser-qa-checklist.md) to record the manual target-browser evidence.

Current workstation note:

- Automated Chrome/Playwright launches may be closed by local focus-blocking tools such as Cold Turkey or FocusMe before the extension service worker can be inspected.
- Never use the active Chrome profile for automated QA.
- Do not use `%LOCALAPPDATA%\\Google\\Chrome\\User Data`, `Default`, `Profile`, or `Profile 1` as an automated QA profile.
- Do not create or target named personal Chrome profiles such as `Your Chrome` for automated QA.
- Automated browser QA must use a disposable temporary user-data directory, or stay manual.
- Do not add npm scripts that launch Chrome, Playwright, or a remote-debugging session against a real user profile.
- Validation scans package scripts, repository scripts, and tests for live Chrome profile automation patterns.
- Do not treat that process-level closure as a BrowseVault product failure without reproducing it in a normal Chrome session.
- Manual release check: pause the local focus blockers, open `chrome://extensions`, enable Developer mode, load this repository folder unpacked, then verify the toolbar action opens BrowseVault, a second non-BrowseVault active tab creates another BrowseVault tab, and deleting a vault record in one BrowseVault tab refreshes the other BrowseVault tab.
- `npm run release:ready` intentionally fails while the manual checklist is still `Not run`.
