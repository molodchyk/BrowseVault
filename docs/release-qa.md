# Release QA

This file records release verification status for the current BrowseVault package.

## Automated Gates

Last verified for `1.0.0`:

```text
npm run validate
npm run check
npm test
npm run package
npm run verify:package
git diff --check
```

Expected results:

- extension validation passes;
- JavaScript syntax, static import resolution, extension-page module script path, locale coverage, manifest path, file-size budget, and folder-density checks pass;
- unit tests pass;
- `dist/browsevault-1.0.0.zip` is produced;
- package ZIP verification passes, including packaged manifest path, locale message, static import, and module script target checks;
- package contains runtime extension files, root user-facing docs, and `_locales/en/messages.json`;
- package excludes repository research, tests, scripts, docs, StorePilot files, and build metadata.

## Real Browser QA

The browser-extension playbook requires loading the unpacked extension in the target browser before release.

Current workstation note:

- Automated Chrome/Playwright launches may be closed by local focus-blocking tools such as Cold Turkey or FocusMe before the extension service worker can be inspected.
- Do not treat that process-level closure as a BrowseVault product failure without reproducing it in a normal Chrome session.
- Manual release check: pause the local focus blockers, open `chrome://extensions`, enable Developer mode, load this repository folder unpacked, then verify the toolbar action opens BrowseVault, a second non-BrowseVault active tab creates another BrowseVault tab, and deleting a vault record in one BrowseVault tab refreshes the other BrowseVault tab.
