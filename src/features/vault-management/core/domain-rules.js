export function hostMatchesRule(host, rule) {
  return host === rule || host.endsWith(`.${rule}`);
}

export function normalizeRuleValue(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/[^a-z0-9.-]/g, "");
}

export function normalizeCategoryValue(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}
