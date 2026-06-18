# Codex Working Rules

This repository is browser-sensitive because local tools such as Cold Turkey and FocusMe can interfere with Chrome processes and because accidental Chrome profile creation is stressful user-state mutation.

## Browser Safety

- Do not launch Chrome, Chromium, Playwright, the Chrome MCP, the in-app browser, or any browser automation for this project.
- Do not create, target, rename, delete, or otherwise manage Chrome profiles from Codex.
- Do not use the active Chrome profile, `%LOCALAPPDATA%\Google\Chrome\User Data`, `Default`, `Profile`, `Profile 1`, or named personal profiles such as `Your Chrome`.
- Do not pass `--profile-directory`, `--user-data-dir`, `--load-extension`, `--disable-extensions-except`, remote debugging, or CDP attachment flags from repo scripts or assistant-driven commands.
- Do not treat Chrome or Playwright closing under local focus blockers as a BrowseVault product failure.

Manual target-browser QA belongs in `docs/release/manual-browser-qa-checklist.md` and should be performed by the user in their normal browser session. Repo-owned checks should stay non-browser unless the user explicitly approves a disposable browser-profile plan in the current turn.
