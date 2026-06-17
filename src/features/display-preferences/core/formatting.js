export function formatShortDate(value, dateFormat = "system") {
  if (!value) {
    return "No visits yet";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (dateFormat === "iso") {
    return `${year}-${month}-${day}`;
  }

  if (dateFormat === "dmy") {
    return `${day}/${month}/${year}`;
  }

  if (dateFormat === "mdy") {
    return `${month}/${day}/${year}`;
  }

  if (dateFormat === "ymd") {
    return `${year}/${month}/${day}`;
  }

  return new Intl.DateTimeFormat(undefined).format(date);
}

export function formatDate(value, dateFormat = "system") {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);
  if (dateFormat === "iso") {
    return `${date.toISOString().slice(0, 10)} ${date.toTimeString().slice(0, 5)}`;
  }

  const datePart = formatShortDate(value, dateFormat);
  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);

  return `${datePart}, ${timePart}`;
}

export function localDayKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDayHeading(value, dateFormat = "system") {
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(new Date(value));
  return `${weekday} · ${formatShortDate(value, dateFormat)}`;
}

export function formatCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? count.toLocaleString() : "0";
}

export function formatFileSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) {
    return "Not recorded";
  }

  if (value < 1024) {
    return `${Math.round(value)} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = size >= 10 ? 1 : 2;
  return `${size.toFixed(precision).replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1")} ${units[unitIndex]}`;
}

export function formatChecksum(value) {
  if (!value) {
    return "Not available";
  }

  return value.length > 24 ? `${value.slice(0, 12)}...${value.slice(-8)}` : value;
}

export function formatBackupSelfTest(selfTest) {
  if (!selfTest) {
    return "Not tested";
  }

  if (selfTest.status === "passed") {
    const records = Number(selfTest.records);
    return Number.isFinite(records)
      ? `Passed ${formatCount(records)} record${records === 1 ? "" : "s"}`
      : "Passed";
  }

  if (selfTest.checksum === "mismatch") {
    return "Failed checksum";
  }

  if (selfTest.countMatches === false) {
    return "Failed count";
  }

  if (selfTest.restoreCountMatches === false) {
    return "Failed restore rows";
  }

  return "Failed";
}
