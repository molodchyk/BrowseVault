export function markdownSection(source, heading) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) {
    return "";
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      end = index;
      break;
    }
  }

  return lines.slice(start + 1, end).join("\n").trim();
}

function firstContentLine(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || "";
}

function bulletItems(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.match(/^-\s+(.+?)\s*$/)?.[1])
    .filter(Boolean);
}

function fencedText(source) {
  return source.match(/```(?:text)?\s*\n([\s\S]*?)\n```/)?.[1].trim() || "";
}

function commaList(source) {
  return source
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sameList(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function storePilotBodyFromDraft(storeDraft) {
  return `${markdownSection(storeDraft, "Longer Description Draft")}\n\n${markdownSection(storeDraft, "Store Footer")}`
    .replace(/`/g, "")
    .trim();
}

export function checkStoreMetadataSync({ localeMessages, packageJson, repositoryMetadata, storeDraft, storePilotListing }) {
  const errors = [];
  const localeName = localeMessages.extensionName?.message || "";
  const localeSummary = localeMessages.extensionDescription?.message || "";
  const draftName = firstContentLine(markdownSection(storeDraft, "Name"));
  const draftSummary = firstContentLine(markdownSection(storeDraft, "Short Description"));
  const draftDescription = firstContentLine(markdownSection(storeDraft, "GitHub Description"));
  const repositoryDescription = fencedText(markdownSection(repositoryMetadata, "GitHub Description"));
  const draftTopics = bulletItems(markdownSection(storeDraft, "GitHub Topics"));
  const repositoryTopics = commaList(fencedText(markdownSection(repositoryMetadata, "GitHub Topics")));
  const expectedFooter = "Open source under the GPL-3.0 license:\nhttps://github.com/molodchyk/BrowseVault";

  if (draftName !== localeName) {
    errors.push(`Store draft Name must match localized manifest name: ${localeName}`);
  }

  if (draftSummary !== localeSummary) {
    errors.push(`Store draft Short Description must match localized manifest description: ${localeSummary}`);
  }

  if (draftDescription !== packageJson.description) {
    errors.push("Store draft GitHub Description must match package.json description.");
  }

  if (repositoryDescription !== packageJson.description) {
    errors.push("Repository metadata GitHub Description must match package.json description.");
  }

  if (!sameList(draftTopics, packageJson.keywords || [])) {
    errors.push("Store draft GitHub Topics must match package.json keywords in order.");
  }

  if (!sameList(repositoryTopics, packageJson.keywords || [])) {
    errors.push("Repository metadata GitHub Topics must match package.json keywords in order.");
  }

  if (storePilotBodyFromDraft(storeDraft) !== storePilotListing.trim()) {
    errors.push("StorePilot listing/en.md must match the human store draft Longer Description Draft plus Store Footer.");
  }

  if (markdownSection(storeDraft, "Store Footer") !== expectedFooter) {
    errors.push("Store draft footer must keep the GPL-3.0 GitHub footer.");
  }

  if (!storePilotListing.trim().endsWith(expectedFooter)) {
    errors.push("StorePilot listing must end with the GPL-3.0 GitHub footer.");
  }

  if (/buymeacoffee|patreon/i.test(storeDraft) || /buymeacoffee|patreon/i.test(storePilotListing)) {
    errors.push("Store copy must not include donation links.");
  }

  return errors;
}
