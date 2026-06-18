import fs from "node:fs";
import path from "node:path";
import { checkReferenceSync } from "./reference-sync-core.mjs";

const root = process.cwd();
const settingsRoot = path.resolve(root, "..");
const references = [
  {
    label: "Browser extension playbook snapshot",
    localPath: path.join(root, "docs", "research", "raw-sources", "browser-extension-playbook-reference.txt"),
    sourcePath: path.join(settingsRoot, "browser-extension-playbook.md")
  },
  {
    label: "Extension modularization playbook",
    localPath: path.join(root, "docs", "architecture", "extension-modularization-playbook.md"),
    sourcePath: path.join(settingsRoot, "Defense_against_Distractions", "docs", "extension-modularization-playbook.md")
  },
  {
    label: "StorePilot Chrome Web Store reference snapshot",
    localPath: path.join(root, "docs", "research", "raw-sources", "storepilot-chrome-web-store-reference.txt"),
    sourcePath: path.join(settingsRoot, "StorePilot", "docs", "reference.md")
  }
];

const result = checkReferenceSync(references, {
  exists: (file) => fs.existsSync(file),
  readFile: (file) => fs.readFileSync(file, "utf8")
});

for (const warning of result.warnings) {
  console.warn(warning);
}

if (result.errors.length) {
  console.error("Reference sync check failed:");
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Reference sync checked ${references.length - result.warnings.length} references.`);
