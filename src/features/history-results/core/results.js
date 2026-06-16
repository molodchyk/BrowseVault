export function uniqueUrlsForItems(items) {
  return [...new Set(items.map((item) => item.url).filter(Boolean))];
}

export function domainForItem(item) {
  if (item.domain) {
    return item.domain.toLowerCase().replace(/^www\./, "");
  }

  try {
    return new URL(item.url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function uniqueDomainsForItems(items) {
  return [...new Set(items.map(domainForItem).filter(Boolean))];
}

export function resultIds(results) {
  return results.map((result) => result.id).filter(Boolean);
}

export function selectedIdsForResults(results) {
  return new Set(resultIds(results));
}

export function reconcileSelectedIds(selectedIds, results) {
  const resultIdSet = selectedIdsForResults(results);
  return new Set([...selectedIds].filter((id) => resultIdSet.has(id)));
}

export function toggleSelectedId(selectedIds, id, shouldSelect) {
  const next = new Set(selectedIds);
  if (shouldSelect) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return next;
}

export function selectRangeByIndex(selectedIds, results, startIndex, endIndex, shouldSelect) {
  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)) {
    return new Set(selectedIds);
  }

  const start = Math.max(0, Math.min(startIndex, endIndex));
  const end = Math.min(results.length - 1, Math.max(startIndex, endIndex));
  let next = new Set(selectedIds);

  for (const result of results.slice(start, end + 1)) {
    next = toggleSelectedId(next, result.id, shouldSelect);
  }

  return next;
}

export function invertSelectionForResults(selectedIds, results) {
  let next = new Set(selectedIds);
  for (const result of results) {
    next = toggleSelectedId(next, result.id, !next.has(result.id));
  }
  return next;
}

export function countResultsByKey(results, keyForResult) {
  const counts = new Map();
  for (const result of results) {
    const key = keyForResult(result);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

export function resultCountLabel(total, shown) {
  return `${total} result${total === 1 ? "" : "s"} (${shown} shown)`;
}

export function selectedCountLabel(count) {
  return `${count} selected`;
}

export function loadMoreState({ total, shown, step, max }) {
  const canLoadMore = total > shown && shown < max;
  return {
    canLoadMore,
    nextCount: canLoadMore ? Math.min(step, total - shown, max - shown) : 0
  };
}
