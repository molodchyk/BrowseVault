const expectedManifestKeys = [
  "action",
  "background",
  "commands",
  "default_locale",
  "description",
  "icons",
  "manifest_version",
  "minimum_chrome_version",
  "name",
  "permissions",
  "short_name",
  "version"
];

const expectedPermissions = ["bookmarks", "downloads", "history", "sessions", "storage", "tabs"];

function hasManifestField(manifest, field) {
  return Object.prototype.hasOwnProperty.call(manifest, field);
}

export function validateManifestSurface(manifest, localeMessage, assert) {
  assert(
    JSON.stringify(Object.keys(manifest).sort()) === JSON.stringify([...expectedManifestKeys].sort()),
    `Manifest top-level keys changed; expected only: ${expectedManifestKeys.join(", ")}.`
  );
  assert(manifest.manifest_version === 3, "Manifest must use version 3.");
  assert(manifest.default_locale === "en", "Manifest must use the English _locales folder for StorePilot-compatible structure.");
  assert(manifest.name === "__MSG_extensionName__", "Manifest name should resolve through _locales/en/messages.json.");
  assert(manifest.short_name === "__MSG_extensionShortName__", "Manifest short_name should resolve through _locales/en/messages.json.");
  assert(manifest.description === "__MSG_extensionDescription__", "Manifest description should resolve through _locales/en/messages.json.");
  assert(localeMessage("extensionName") === "BrowseVault: History Search & Backup", "Unexpected localized extension name.");
  assert(localeMessage("extensionShortName") === "BrowseVault", "Unexpected localized short_name.");
  assert(
    localeMessage("extensionDescription") === "Search, back up, export, and preserve your browser history locally.",
    "Unexpected localized extension description."
  );
  assert(localeMessage("extensionDescription").length <= 132, "Manifest description should stay within Chrome Web Store summary length.");
  assert(manifest.background?.type === "module", "Background script should be an ES module.");
  assert(manifest.action?.default_title === "__MSG_extensionShortName__", "Toolbar action title should resolve through _locales/en/messages.json.");
  assert(!manifest.action?.default_popup, "Toolbar action should open the core app page, not a marketing popup.");

  for (const size of ["16", "32", "48", "128"]) {
    assert(manifest.icons?.[size] === `assets/icons/icon${size}.png`, `Missing manifest icon ${size}.`);
    assert(manifest.action?.default_icon?.[size] === `assets/icons/icon${size}.png`, `Missing action icon ${size}.`);
  }

  assert(Array.isArray(manifest.permissions), "Manifest permissions must be explicit.");
  assert(
    JSON.stringify([...manifest.permissions].sort()) === JSON.stringify([...expectedPermissions].sort()),
    `Manifest permissions changed; expected exactly: ${expectedPermissions.join(", ")}.`
  );
  assert(!manifest.optional_permissions?.length, "Manifest should not request optional permissions.");
  assert(!manifest.host_permissions?.length, "Manifest should not request host permissions.");
  assert(!manifest.optional_host_permissions?.length, "Manifest should not request optional host permissions.");
  assert(!manifest.chrome_url_overrides, "Manifest must not replace Chrome history by default.");
  assert(!hasManifestField(manifest, "chrome_settings_overrides"), "Manifest must not change search engine, homepage, or startup pages.");
  assert(!hasManifestField(manifest, "content_scripts"), "Manifest should not inject content scripts.");
  assert(!hasManifestField(manifest, "declarative_net_request"), "Manifest must not ship request-blocking or request-redirect rule sets.");
  assert(!hasManifestField(manifest, "declarative_net_request_rule_resources"), "Manifest must not ship request rule resources.");
  assert(!hasManifestField(manifest, "devtools_page"), "Manifest should not add a DevTools surface.");
  assert(!hasManifestField(manifest, "omnibox"), "Manifest should not take over omnibox keyword behavior.");
  assert(!hasManifestField(manifest, "options_page"), "Settings should stay inside the audited app surface.");
  assert(!hasManifestField(manifest, "options_ui"), "Settings should stay inside the audited app surface.");
  assert(!hasManifestField(manifest, "side_panel"), "Manifest should not add a side-panel surface.");
  assert(!manifest.externally_connectable, "Manifest should not expose externally_connectable messaging.");
  assert(!manifest.web_accessible_resources?.length, "Manifest should not expose web-accessible resources.");
  assert(manifest.commands?.["open-browsevault"], "Missing open-browsevault command.");
  assert(
    manifest.commands["open-browsevault"].description === "__MSG_openCommandDescription__",
    "Command description should resolve through _locales/en/messages.json."
  );
  assert(localeMessage("openCommandDescription") === "Open BrowseVault", "Unexpected localized open command description.");
}
