# Browser History Product Knowledge Base

This folder captures the critical market research, user feedback, product direction, and implementation knowledge gathered from Chrome Web Store listings and reviews for browser history, search, export, backup, and tab/history manager extensions.

## Files

- `browser-history-extension-research.md` - competitor/source inventory, ratings, positioning, strengths, and observed gaps.
- `user-feedback-taxonomy.md` - grouped complaints, user needs, and positive demand signals.
- `product-blueprint.md` - proposed better product, MVP scope, differentiators, prioritization, and positioning.
- `implementation-notes.md` - Chrome extension constraints, architecture, storage/search/backup design, and testing risks.
- `extension-modularization-playbook.md` - reusable extension modularization rules copied from Defense against Distractions.
- `code-structure.md` - BrowseVault-specific ownership map and next split candidates.
- `source-inventory.md` - index of raw source snapshots and how they map to the research notes.
- `raw-sources/` - preserved Chrome Web Store listing/review text snapshots used as evidence.

## Core Insight

Users are not mainly asking for more charts or decorative UI. They want a trustworthy local-first browser memory tool that can:

- keep history beyond Chrome's retention limits from the moment it is installed;
- search history, tabs, bookmarks, downloads, and closed tabs accurately;
- bulk delete/export selected history without repetitive clicking;
- avoid slowing or crashing Chrome;
- never lose years of data through database corruption;
- avoid ads, surprise popups, hidden tracking, or unexplained permission behavior;
- offer predictable import, export, backup, and restore flows.

## Product Thesis

Build a local-first "browser memory manager" rather than a simple history page replacement.

The winning product should feel boringly reliable for data preservation and sharply powerful for search. Trust, speed, and backup integrity matter more than visual novelty.
