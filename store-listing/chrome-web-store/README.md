# StorePilot Chrome Web Store Inputs

This folder follows StorePilot's Chrome Web Store import layout.

Reference: [StorePilot Project Reference](../../../StorePilot/docs/reference.md).

- `listing/en.md` is the English Detailed description body only. It should not contain headings, field labels, the standalone Name field, the short summary, category notes, privacy form text, or SEO metadata.
- `media/icon-128.png` is the store import copy of the 128 x 128 extension icon.
- `media/screenshots/` contains five final `1280 x 800` JPG screenshots:
  - `01-history-search.jpg`
  - `02-quick-open.jpg`
  - `03-backup-health.jpg`
  - `04-rules-cleanup.jpg`
  - `05-settings-privacy.jpg`
- `media/promo/small-promo.png` is `440 x 280`.
- `media/promo/marquee-promo.png` is `1400 x 560`.
- The promo PNGs can be regenerated with `npm run store:media`.
- Screenshot release coverage and current-UI review notes live in `docs/chrome-web-store-media.md`.
- Dashboard-only values live in `docs/chrome-web-store-additional-fields.md`, `docs/chrome-web-store-category.md`, and `docs/chrome-web-store-privacy-form.md`.
- `docs/chrome-web-store-privacy-form.md` is not the public privacy policy. Keep the default extension privacy policy in `PRIVACY.md`.

Keep the human SEO and metadata draft in `store/listing.md`.
