import fs from "node:fs";
import path from "node:path";
import { checkStoreMetadataSync } from "./store-metadata-core.mjs";

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

const errors = checkStoreMetadataSync({
  localeMessages: JSON.parse(read("_locales/en/messages.json")),
  packageJson: JSON.parse(read("package.json")),
  repositoryMetadata: read("docs/project/repository-metadata.md"),
  storeDraft: read("store/listing.md"),
  storePilotListing: read("store-listing/chrome-web-store/listing/en.md")
});

if (errors.length) {
  console.error("Store metadata sync failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Store metadata sync checked.");
