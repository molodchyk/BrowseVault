# Source Inventory

This file indexes the raw source text used for BrowseVault market research and user-feedback analysis.

The raw files are preserved in [`raw-sources/`](raw-sources/) so future product, store listing, launch automation, and SEO work can audit the original evidence instead of relying only on summarized notes.

## Raw Sources

| Raw file | Source snapshot | Original attachment id | Primary use |
| --- | --- | --- | --- |
| [`raw-sources/browser-history-plus-overview.txt`](raw-sources/browser-history-plus-overview.txt) | Browser History Plus Chrome Web Store listing | `efbb4093-f838-46ed-923e-b833720f7ae3` | Positioning, features, privacy/store metadata |
| [`raw-sources/better-history-overview.txt`](raw-sources/better-history-overview.txt) | Better History Chrome Web Store listing | `88b671eb-1037-455a-ae29-fb25d7ba0a4d` | Incumbent feature set, scale, store positioning |
| [`raw-sources/better-history-reviews.txt`](raw-sources/better-history-reviews.txt) | Better History Chrome Web Store reviews | `34f61ce7-2a19-482a-b5fc-6ea4cf0f7d3b` | Review complaints, praise, missing workflows |
| [`raw-sources/history-plus-reviews.txt`](raw-sources/history-plus-reviews.txt) | History Plus Chrome Web Store reviews | `76ed848d-45e2-4b84-afd8-e133aaa551e7` | Unlimited-history, import/export, backup complaints |
| [`raw-sources/export-chrome-history-reviews.txt`](raw-sources/export-chrome-history-reviews.txt) | Export Chrome History Chrome Web Store reviews | `1c66c343-15b1-4057-b2ec-100de86022d3` | Export expectations, 90-day confusion, format needs |
| [`raw-sources/history-trends-unlimited-reviews.txt`](raw-sources/history-trends-unlimited-reviews.txt) | History Trends Unlimited Chrome Web Store reviews | `f872aa64-cb8f-4eab-8de0-cda9f5b6b2fe` | Long-term archive, backup trust, analytics expectations |
| [`raw-sources/recent-history-reviews.txt`](raw-sources/recent-history-reviews.txt) | Recent History Chrome Web Store reviews | `dbc92d6f-d0cb-4fcc-ba6f-b9f8c76010c0` | Recent-history workflow expectations and reliability issues |
| [`raw-sources/view-chrome-history-overview.txt`](raw-sources/view-chrome-history-overview.txt) | View Chrome History Chrome Web Store listing and reviews | `434aff07-a23e-4f98-829b-a5474f2b3d60` | Default-history replacement, date-range browsing, theme/readability complaints |
| [`raw-sources/storepilot-chrome-web-store-reference.txt`](raw-sources/storepilot-chrome-web-store-reference.txt) | StorePilot Chrome Web Store automation import reference | `e09bb4e2-a278-422a-93b4-f9525f87f3e1` | Store-facing file layout and dashboard field automation |

## Handling Notes

- These files are committed because they are small public/store-text snapshots and are useful provenance for product decisions.
- Absolute local attachment paths are intentionally not stored here.
- Treat these files as evidence snapshots, not current market truth. Re-check Chrome Web Store pages before launch-sensitive claims about ratings, users, or recent reviews.
- Treat the StorePilot reference as launch tooling documentation and re-check it before changing the automation-facing file layout.
- Summaries derived from these sources live in:
  - [`browser-history-extension-research.md`](browser-history-extension-research.md)
  - [`user-feedback-taxonomy.md`](user-feedback-taxonomy.md)
  - [`product-blueprint.md`](product-blueprint.md)
  - [`implementation-notes.md`](implementation-notes.md)
