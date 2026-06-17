# StorePilot Project Structure

This checklist maps BrowseVault to the StorePilot Chrome Web Store import reference.

Reference:

- [StorePilot Project Reference](../../StorePilot/docs/reference.md)

## Required Import Shape

```text
BrowseVault/
manifest.json
src/
_locales/
  en/
    messages.json
store-listing/
  chrome-web-store/
    listing/
      en.md
    media/
      icon-128.png
      screenshots/
        01-history-search.jpg
        02-quick-open.jpg
        03-backup-health.jpg
        04-rules-cleanup.jpg
        05-settings-privacy.jpg
      promo/
        small-promo.png
        marquee-promo.png
docs/
  chrome-web-store-additional-fields.md
  chrome-web-store-category.md
  chrome-web-store-privacy-form.md
```

## Notes

- `store-listing/chrome-web-store/listing/en.md` is detailed-description body only. It intentionally omits Name, Summary, Category, Homepage URL, Support URL, Official URL, Mature content, and privacy fields.
- Dashboard fields stay in `docs/chrome-web-store-additional-fields.md`.
- Category stays in `docs/chrome-web-store-category.md` with an explicit `Selected category:` line.
- Store privacy answers stay in `docs/chrome-web-store-privacy-form.md` with canonical StorePilot keys.
- Public privacy policy remains in root `PRIVACY.md`.
- `_locales/en/messages.json` is a real Chrome localization folder because `manifest.json` uses `default_locale: "en"`.
