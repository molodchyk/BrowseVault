# QA Helpers

This folder is reserved for repo-owned QA helpers that are safe to run from a fresh clone.

Do not add scripts here that launch, attach to, or mutate an active Chrome profile. Browser QA for BrowseVault is either manual, as documented in `docs/release/release-qa.md`, or explicitly uses a disposable temporary browser profile after the user approves that kind of run.

Current automated release checks stay non-browser:

- `npm run validate`
- `npm run check`
- `npm test`
- `npm run package`
- `npm run verify:package`
