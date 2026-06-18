export function normalizeReferenceText(source) {
  return source.replace(/\r\n?/g, "\n").trimEnd();
}

export function checkReferenceSync(references, { exists, readFile }) {
  const errors = [];
  const warnings = [];

  for (const reference of references) {
    if (!exists(reference.localPath)) {
      errors.push(`${reference.label} local copy is missing: ${reference.localPath}`);
      continue;
    }

    if (!exists(reference.sourcePath)) {
      warnings.push(`${reference.label} source reference is unavailable, skipped: ${reference.sourcePath}`);
      continue;
    }

    const localText = normalizeReferenceText(readFile(reference.localPath));
    const sourceText = normalizeReferenceText(readFile(reference.sourcePath));
    if (localText !== sourceText) {
      errors.push(`${reference.label} local copy is stale. Refresh ${reference.localPath} from ${reference.sourcePath}.`);
    }
  }

  return { errors, warnings };
}
