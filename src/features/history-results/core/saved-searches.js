export const MAX_SAVED_SEARCHES = 25;

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function hashString(value) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function savedSearchId(name) {
  const cleaned = cleanText(name, 80);
  const normalized = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized) {
    return `saved:${normalized}`;
  }

  return cleaned ? `saved:${hashString(cleaned)}` : "";
}

export function normalizeSavedSearch(input, now = () => new Date().toISOString()) {
  const name = cleanText(input?.name, 60);
  const id = cleanText(input?.id, 96) || savedSearchId(name);

  if (!name || !id) {
    return null;
  }

  const createdAt = input?.createdAt || now();
  const updatedAt = input?.updatedAt || createdAt;

  return {
    id,
    name,
    query: cleanText(input?.query, 500),
    onDate: cleanText(input?.onDate, 32),
    after: cleanText(input?.after, 32),
    before: cleanText(input?.before, 32),
    limit: cleanText(input?.limit, 16),
    sortOrder: input?.sortOrder === "oldest" ? "oldest" : "newest",
    createdAt,
    updatedAt
  };
}

export function normalizeSavedSearches(input) {
  return (Array.isArray(input) ? input : [])
    .map((entry) => normalizeSavedSearch(entry))
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function savedSearchHasCriteria(values) {
  return Boolean(
    cleanText(values?.query, 500) ||
    cleanText(values?.onDate, 32) ||
    cleanText(values?.after, 32) ||
    cleanText(values?.before, 32) ||
    values?.sortOrder === "oldest"
  );
}

export function defaultSavedSearchName(values) {
  const query = cleanText(values?.query, 60);
  if (query) {
    return query;
  }

  return cleanText(values?.onDate || values?.after || values?.before, 60) ||
    (values?.sortOrder === "oldest" ? "Oldest first" : "Saved search");
}

export function upsertSavedSearch(searches, input, now = () => new Date().toISOString()) {
  const timestamp = now();
  const normalizedInput = normalizeSavedSearch({
    ...input,
    id: input?.id || savedSearchId(input?.name),
    updatedAt: timestamp
  }, () => timestamp);

  if (!normalizedInput) {
    return normalizeSavedSearches(searches);
  }

  const existing = normalizeSavedSearches(searches);
  const existingIndex = existing.findIndex((entry) => entry.id === normalizedInput.id);
  const next = existingIndex >= 0
    ? existing.map((entry, index) => index === existingIndex
      ? {
          ...normalizedInput,
          createdAt: entry.createdAt
        }
      : entry)
    : [
        ...existing,
        {
          ...normalizedInput,
          createdAt: timestamp
        }
      ];

  return normalizeSavedSearches(next).slice(0, MAX_SAVED_SEARCHES);
}

export function removeSavedSearch(searches, id) {
  return normalizeSavedSearches(searches).filter((entry) => entry.id !== id);
}
