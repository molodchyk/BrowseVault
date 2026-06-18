import assert from "node:assert/strict";
import test from "node:test";
import { checkStoreMetadataSync, markdownSection } from "../../scripts/playbook/store-metadata-core.mjs";

const localeMessages = {
  extensionDescription: { message: "Search, back up, export, and preserve your browser history locally." },
  extensionName: { message: "BrowseVault: History Search & Backup" }
};
const packageJson = {
  description: "Private local-first browser history search, backup, export, and preservation extension.",
  keywords: ["chrome-extension", "browser-history"]
};
const repositoryMetadata = `# Repository Metadata

## GitHub Description

\`\`\`text
Private local-first browser history search, backup, export, and preservation extension.
\`\`\`

## GitHub Topics

\`\`\`text
chrome-extension, browser-history
\`\`\`
`;
const storeDraft = `# Store

## Name

BrowseVault: History Search & Backup

## Short Description

Search, back up, export, and preserve your browser history locally.

## Longer Description Draft

Use \`site:\` search locally.

## GitHub Description

Private local-first browser history search, backup, export, and preservation extension.

## GitHub Topics

- chrome-extension
- browser-history

## Store Footer

Open source under the GPL-3.0 license:
https://github.com/molodchyk/BrowseVault
`;
const storePilotListing = `Use site: search locally.

Open source under the GPL-3.0 license:
https://github.com/molodchyk/BrowseVault
`;

test("markdownSection returns a named second-level section body", () => {
  assert.equal(markdownSection(storeDraft, "Short Description"), "Search, back up, export, and preserve your browser history locally.");
  assert.equal(markdownSection(storeDraft, "Missing"), "");
});

test("checkStoreMetadataSync accepts synchronized store metadata", () => {
  assert.deepEqual(
    checkStoreMetadataSync({ localeMessages, packageJson, repositoryMetadata, storeDraft, storePilotListing }),
    []
  );
});

test("checkStoreMetadataSync rejects drift between store draft and localized manifest fields", () => {
  const errors = checkStoreMetadataSync({
    localeMessages: { ...localeMessages, extensionName: { message: "Other Name" } },
    packageJson,
    repositoryMetadata,
    storeDraft,
    storePilotListing
  });

  assert(errors.some((error) => error.includes("Store draft Name must match localized manifest name")));
});

test("checkStoreMetadataSync rejects stale StorePilot detailed description text", () => {
  const errors = checkStoreMetadataSync({
    localeMessages,
    packageJson,
    repositoryMetadata,
    storeDraft,
    storePilotListing: "Different body"
  });

  assert(errors.some((error) => error.includes("StorePilot listing/en.md must match")));
});

test("checkStoreMetadataSync rejects donation links in store copy", () => {
  const errors = checkStoreMetadataSync({
    localeMessages,
    packageJson,
    repositoryMetadata,
    storeDraft: `${storeDraft}\nhttps://buymeacoffee.com/molodchyk`,
    storePilotListing
  });

  assert(errors.some((error) => error.includes("donation links")));
});
