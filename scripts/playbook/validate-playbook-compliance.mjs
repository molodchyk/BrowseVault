import fs from "node:fs";
import path from "node:path";

const canonicalSupportBlock = `## Support

If this extension saves you time and you want to support its development:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=000)](https://buymeacoffee.com/molodchyk)
[![Patreon](https://img.shields.io/badge/Patreon-support-F96854?logo=patreon&logoColor=fff)](https://www.patreon.com/OMolodchyk)`;

const canonicalSourceBlock = `## Open Source And License

Open source under the GPL-3.0 license:
https://github.com/molodchyk/BrowseVault

The full license text is in [\`LICENSE\`](LICENSE).`;

export function validatePlaybookCompliance(root, assert) {
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  for (const expected of [
    "PRIVACY.md",
    "Open source under the GPL-3.0 license:",
    "https://github.com/molodchyk/BrowseVault",
    "Buy Me a Coffee",
    "https://buymeacoffee.com/molodchyk",
    "Patreon",
    "https://www.patreon.com/OMolodchyk"
  ]) {
    assert(readme.includes(expected), `README missing playbook-required text: ${expected}`);
  }

  assert(readme.includes(canonicalSourceBlock), "README must keep the browser-extension playbook source/license block.");
  assert(readme.includes(canonicalSupportBlock), "README must keep the browser-extension playbook support block.");
  assert(
    readme.indexOf(canonicalSourceBlock) < readme.indexOf(canonicalSupportBlock),
    "README support block must appear after privacy and license/source information."
  );

  const privacy = fs.readFileSync(path.join(root, "PRIVACY.md"), "utf8");
  assert(privacy.includes("Chrome local extension storage"), "Privacy policy must name the storage area used for settings.");
  for (const expected of [
    "content scripts",
    "remote code",
    "Does not sell, share, transfer, upload, review, or collect",
    "`downloads`: searches download URLs and filenames in Quick Open and can show Chrome's Save As prompt",
    "`tabs`: lists open tabs for Quick Open"
  ]) {
    assert(privacy.includes(expected), `Privacy policy missing playbook-required detail: ${expected}`);
  }

  const docsReadme = fs.readFileSync(path.join(root, "docs", "README.md"), "utf8");
  for (const expected of [
    "release/browser-extension-playbook-compliance.md",
    "release/release-notes.md",
    "release/release-qa.md",
    "project/decision-records.md",
    "project/repository-metadata.md",
    "research/source-inventory.md",
    "architecture/code-structure.md",
    "Browser Extension Playbook",
    "StorePilot Project Reference"
  ]) {
    assert(docsReadme.includes(expected), `Docs README missing playbook reference: ${expected}`);
  }

  const playbookCompliance = fs.readFileSync(
    path.join(root, "docs", "release", "browser-extension-playbook-compliance.md"),
    "utf8"
  );
  for (const expected of [
    "browser-extension-playbook.md",
    "Product Shape",
    "Repository Shape",
    "Store Listing Copy",
    "Localization",
    "Privacy And Permissions",
    "Reviewer Notes And Release Checks",
    "manual check"
  ]) {
    assert(playbookCompliance.includes(expected), `Playbook compliance matrix missing: ${expected}`);
  }
}
