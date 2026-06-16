export function importHealthState(analysis, integrity) {
  if (integrity.checked && !integrity.ok) {
    return {
      className: "is-warning",
      text: "Checksum mismatch. This archive changed after export; import only if you trust this file.",
      buttonText: "Import Anyway"
    };
  }

  if (integrity.checked && integrity.ok) {
    return {
      className: "is-ok",
      text: `Restore check passed. ${analysis.newVisits} new record${analysis.newVisits === 1 ? "" : "s"} and ${analysis.existingVisits} existing record${analysis.existingVisits === 1 ? "" : "s"} detected.`,
      buttonText: "Import Now"
    };
  }

  if (analysis.validRows === 0 && analysis.rules > 0) {
    return {
      className: "is-warning",
      text: "Rules-only import. No history records were found in this file.",
      buttonText: "Import Rules"
    };
  }

  return {
    className: "is-warning",
    text: "Restore check limited. This archive has no checksum, so BrowseVault can preview rows but cannot prove the file is unchanged.",
    buttonText: "Import Now"
  };
}

export function importChecksumNote(integrity) {
  if (!integrity.checked) {
    return "No checksum included.";
  }

  return integrity.ok
    ? "Checksum verified."
    : "Checksum mismatch. Import only if you trust this file.";
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function importPreviewNote(analysis, integrity) {
  return [
    `${analysis.rows} rows scanned.`,
    analysis.invalidRows ? `${pluralize(analysis.invalidRows, "row")} without URLs will be skipped.` : "",
    analysis.rules ? `${pluralize(analysis.rules, "domain rule")} will be imported or updated.` : "",
    importChecksumNote(integrity)
  ]
    .filter(Boolean)
    .join(" ");
}

export function importPreviewViewModel(stagedImport) {
  if (!stagedImport) {
    return {
      hidden: true,
      buttonText: "Import Now",
      healthClassName: "import-health",
      healthText: "Archive not checked"
    };
  }

  const { analysis, fileName, integrity } = stagedImport;
  const health = importHealthState(analysis, integrity);
  return {
    hidden: false,
    title: `${fileName} from ${analysis.sourceApp}`,
    validRows: String(analysis.validRows),
    newVisits: String(analysis.newVisits),
    existingVisits: String(analysis.existingVisits),
    duplicateRows: String(analysis.duplicateRows),
    healthClassName: `import-health ${health.className}`,
    healthText: health.text,
    buttonText: health.buttonText,
    note: importPreviewNote(analysis, integrity)
  };
}
