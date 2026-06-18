# Browser History Product Knowledge Base

This folder captures the critical market research, user feedback, product direction, and implementation knowledge gathered from Chrome Web Store listings and reviews for browser history, search, export, backup, and tab/history manager extensions.

## Files

- `research/browser-history-extension-research.md` - competitor/source inventory, ratings, positioning, strengths, and observed gaps.
- `research/user-feedback-taxonomy.md` - grouped complaints, user needs, and positive demand signals.
- `research/product-blueprint.md` - proposed better product, MVP scope, differentiators, prioritization, and positioning.
- `research/implementation-notes.md` - Chrome extension constraints, architecture, storage/search/backup design, and testing risks.
- `architecture/extension-modularization-playbook.md` - reusable extension modularization rules copied from Defense against Distractions.
- `architecture/code-structure.md` - BrowseVault-specific ownership map and next split candidates.
- `release/reviewer-notes.md` - browser-store reviewer notes for limitations, permissions, package behavior, and user-data handling.
- `release/browser-extension-playbook-compliance.md` - evidence matrix mapping BrowseVault to the shared browser-extension playbook.
- `release/browser-extension-playbook-audit.md` - requirement-by-requirement release audit separating verified evidence from manual browser evidence still needed.
- `release/release-qa.md` - release verification status and real-browser QA notes.
- `release/manual-browser-qa-checklist.md` - automated gate and manual target-browser QA checklist for release readiness.
- `release/release-notes.md` - docs-level release summary that points to the canonical root changelog.
- `project/decision-records.md` - product, privacy, packaging, and release decisions to preserve across future edits.
- `project/repository-metadata.md` - intended GitHub repository description and topic/tag values.
- `storepilot-project-structure.md` - checklist that maps BrowseVault files to the StorePilot Chrome Web Store import reference.
- `chrome-web-store-media.md` - screenshot coverage and manual review checklist for store media consistency.
- `research/source-inventory.md` - index of raw source snapshots and how they map to the research notes.
- `research/raw-sources/` - preserved Chrome Web Store listing/review text snapshots and tooling/playbook reference snapshots used as evidence.

## Related Playbooks

- [Browser Extension Playbook](../../browser-extension-playbook.md) - shared product, release, repository, privacy, store listing, and reviewer standards for browser extensions.
- [Defense against Distractions Localization Reference](../../Defense_against_Distractions/docs/localization.md) - canonical workflow for future Chrome Web Store visible-language coverage, locale-code, and right-to-left checks.
- [StorePilot Project Reference](../../StorePilot/docs/reference.md) - shared Chrome Web Store automation file layout used by StorePilot import flows.

## Core Insight

Users are not mainly asking for more charts or decorative UI. They want a trustworthy local-first browser memory tool that can:

- keep history beyond Chrome's retention limits from the moment it is installed;
- search history, tabs, bookmarks, downloads, closed tabs, and closed windows accurately;
- bulk delete/export selected history without repetitive clicking;
- avoid slowing or crashing Chrome;
- never lose years of data through database corruption;
- avoid ads, surprise popups, hidden tracking, or unexplained permission behavior;
- offer predictable import, export, backup, and restore flows.

## Product Thesis

Build a local-first "browser memory manager" rather than a simple history page replacement.

The winning product should feel boringly reliable for data preservation and sharply powerful for search. Trust, speed, and backup integrity matter more than visual novelty.
