# Decision Records

This file captures product and release decisions that should stay visible to future maintainers.

## ADR-001: Keep BrowseVault Local-First

BrowseVault stores archive data in the user's browser profile and does not include analytics, ads, tracking, remote code, content scripts, host permissions, or default network requests.

Reason: a local-first browser history product should prioritize trust, data ownership, backup reliability, and predictable permission behavior.

## ADR-002: Do Not Replace Chrome History By Default

BrowseVault opens from the toolbar action or keyboard command and includes a Settings escape hatch to open Chrome's native history page.

Reason: replacing browser-owned pages increases review risk and makes recovery from product bugs harder. Users should be able to keep Chrome's native history behavior available.

## ADR-003: Separate Vault Deletion From Chrome History Deletion

Deleting BrowseVault vault records and deleting URLs from Chrome history are separate actions with separate labels and confirmations.

Reason: Chrome history deletion happens by URL and can remove every native visit for that URL. BrowseVault should not hide that browser-level side effect behind a generic cleanup action.

## ADR-004: Keep Research Docs Out Of The Runtime Package

Market research, raw source snapshots, StorePilot files, tests, scripts, and feature docs stay in the repository, while `npm run package` produces a runtime-only ZIP plus root user-facing docs.

Reason: reviewers and maintainers need the research trail, but users should receive the smallest auditable extension package.

## ADR-005: Follow The Shared Extension Playbooks

BrowseVault tracks the shared browser-extension release playbook and the StorePilot import reference from this settings workspace.

References:

- [Browser Extension Playbook](../../browser-extension-playbook.md)
- [Extension Modularization Playbook](../architecture/extension-modularization-playbook.md)
- [StorePilot Project Reference](../../StorePilot/docs/reference.md)

## ADR-006: Keep BrowseVault Browser QA Manual In This Workspace

Repo-owned QA must not launch or attach to Chrome, Chromium, Playwright, CDP, browser-control tools, the active Chrome profile, the real Chrome user-data directory, named folders such as `Default`, `Profile`, or `Profile 1`, or named personal profiles such as `Your Chrome`.

Reason: profile-level automation can collide with focus-blocking tools, active sessions, and Chrome's profile registry. BrowseVault release checks stay repo-only in this workspace. Target-browser QA is manual and recorded in the release checklist.

Repo scripts and tests reject Chrome profile-selection, extension-load, remote-debugging, persistent-context, direct Chromium launch, browser-control tooling, Playwright browser test, and CDP attachment patterns so the failure mode does not silently return through a convenience QA script.

## ADR-007: Do Not Enforce One Global BrowseVault Tab

Toolbar and keyboard-command opening reuses BrowseVault only when the current active tab is already the BrowseVault app. Otherwise, it creates a new BrowseVault tab.

Reason: users complained about incumbents with one-tab limitations. BrowseVault should not steal focus from an existing inactive app tab or make users hunt for a previous BrowseVault tab before starting another history task. Cross-tab vault invalidation keeps open BrowseVault tabs refreshed after deletes, imports, cleanup, reset, rules, manual sync, live capture, and native history removals.
