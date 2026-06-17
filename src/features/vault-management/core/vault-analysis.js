import { hostMatchesRule } from "./domain-rules.js";
import { normalizeDomain } from "./history-records.js";

const DAY_MS = 86400000;

function normalizedCategoryRules(categories) {
  return (Array.isArray(categories) ? categories : [])
    .filter((rule) => rule?.value && rule?.category)
    .map((rule) => ({
      value: String(rule.value).toLowerCase(),
      category: rule.category
    }))
    .sort((left, right) => right.value.length - left.value.length);
}

function categoryForVisitFromRules(visit, categories) {
  const domain = (visit.domain || normalizeDomain(visit.url || "")).toLowerCase();
  if (!domain || !categories.length) {
    return "";
  }

  return categories.find((rule) => hostMatchesRule(domain, rule.value))?.category || "";
}

export function categoryForVisit(visit, categories) {
  return categoryForVisitFromRules(visit, normalizedCategoryRules(categories));
}

export function decorateVisitsWithRuleCategories(visits, rules) {
  const categories = normalizedCategoryRules(rules?.categories);
  if (!categories.length) {
    return visits;
  }

  return visits.map((visit) => {
    const category = categoryForVisitFromRules(visit, categories);
    return category ? { ...visit, category } : visit;
  });
}

function visitMatchesWhitelist(visit, whitelist) {
  const domain = (visit.domain || normalizeDomain(visit.url || "")).toLowerCase();
  return Boolean(domain && whitelist.some((rule) => hostMatchesRule(domain, rule)));
}

function duplicateVisitKey(visit) {
  const url = String(visit.normalizedUrl || visit.url || "").trim().toLowerCase();
  const visitTime = Number(visit.visitTime);
  if (!url || !Number.isFinite(visitTime)) {
    return "";
  }

  return `${url}\n${Math.round(visitTime)}`;
}

function duplicateVisitQuality(visit) {
  return (
    String(visit.title || "").trim().length +
    (visit.chromeId ? 1000 : 0) +
    (visit.visitId ? 100 : 0) +
    Number(visit.visitCount || 0)
  );
}

function compareDuplicateKeepers(left, right) {
  const qualityDelta = duplicateVisitQuality(right) - duplicateVisitQuality(left);
  if (qualityDelta) {
    return qualityDelta;
  }

  const updatedDelta = Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || "");
  if (Number.isFinite(updatedDelta) && updatedDelta) {
    return updatedDelta;
  }

  return String(left.id || "").localeCompare(String(right.id || ""));
}

export function duplicateCleanupCandidates(visits) {
  const groups = new Map();

  for (const visit of Array.isArray(visits) ? visits : []) {
    if (!visit || visit.deletedAt) {
      continue;
    }

    const key = duplicateVisitKey(visit);
    if (!key) {
      continue;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(visit);
  }

  return [...groups.values()]
    .filter((group) => group.length > 1)
    .flatMap((group) => [...group].sort(compareDuplicateKeepers).slice(1));
}

export function summarizeVaultHealth(visits) {
  const allVisits = Array.isArray(visits) ? visits : [];
  let activeRecords = 0;
  let deletedRecords = 0;
  let chromeDeletedRecords = 0;
  let missingUrlRecords = 0;
  let invalidTimeRecords = 0;
  const duplicateGroups = new Map();

  for (const visit of allVisits) {
    if (!visit || visit.deletedAt) {
      deletedRecords += visit?.deletedAt ? 1 : 0;
      continue;
    }

    activeRecords += 1;
    if (visit.chromeDeletedAt) {
      chromeDeletedRecords += 1;
    }

    if (!visit.url) {
      missingUrlRecords += 1;
    }

    if (!Number.isFinite(Number(visit.visitTime))) {
      invalidTimeRecords += 1;
    }

    const key = duplicateVisitKey(visit);
    if (key) {
      duplicateGroups.set(key, (duplicateGroups.get(key) || 0) + 1);
    }
  }

  const duplicateActiveRecords = [...duplicateGroups.values()]
    .filter((count) => count > 1)
    .reduce((total, count) => total + count - 1, 0);
  const issueRecords = missingUrlRecords + invalidTimeRecords + duplicateActiveRecords;

  return {
    storedRows: allVisits.length,
    activeRecords,
    deletedRecords,
    chromeDeletedRecords,
    missingUrlRecords,
    invalidTimeRecords,
    duplicateActiveRecords,
    issueRecords
  };
}

function localDayKeyFromTimestamp(value) {
  const date = new Date(Number(value));
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sortedCountEntries(counts, tieBreaker = "ascending") {
  const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

  return [...counts.entries()]
    .sort((left, right) => {
      const countDelta = right[1] - left[1];
      if (countDelta) {
        return countDelta;
      }

      return tieBreaker === "descending"
        ? compareText(String(right[0]), String(left[0]))
        : compareText(String(left[0]), String(right[0]));
    })
    .map(([value, count]) => ({ value, count }));
}

export function summarizeArchiveInsights(visits, options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 3;
  const activeVisits = (Array.isArray(visits) ? visits : []).filter((visit) => {
    const visitTime = Number(visit?.visitTime);
    return visit && !visit.deletedAt && Number.isFinite(visitTime);
  });
  const domainCounts = new Map();
  const dayCounts = new Map();
  let oldestVisitTime = 0;
  let newestVisitTime = 0;

  for (const visit of activeVisits) {
    const visitTime = Number(visit.visitTime);
    const domain = (visit.domain || normalizeDomain(visit.url || "")).trim().toLowerCase();
    const day = localDayKeyFromTimestamp(visitTime);

    if (domain) {
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    }

    if (day) {
      dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    }

    newestVisitTime = newestVisitTime ? Math.max(newestVisitTime, visitTime) : visitTime;
    oldestVisitTime = oldestVisitTime ? Math.min(oldestVisitTime, visitTime) : visitTime;
  }

  return {
    totalVisits: activeVisits.length,
    activeDays: dayCounts.size,
    averageVisitsPerActiveDay: dayCounts.size ? activeVisits.length / dayCounts.size : 0,
    oldestVisitTime,
    newestVisitTime,
    topDomains: sortedCountEntries(domainCounts)
      .slice(0, limit)
      .map((entry) => ({
        domain: entry.value,
        count: entry.count
      })),
    busiestDays: sortedCountEntries(dayCounts, "descending")
      .slice(0, limit)
      .map((entry) => ({
        day: entry.value,
        count: entry.count
      }))
  };
}

export function retentionCleanupCandidates(visits, rules, options = {}) {
  const retentionDays = Number(options.retentionDays);
  const now = Number(options.now ?? Date.now());

  if (!Number.isInteger(retentionDays) || retentionDays < 1 || !Number.isFinite(now)) {
    return [];
  }

  const cutoff = now - retentionDays * DAY_MS;
  const whitelist = Array.isArray(rules?.whitelist) ? rules.whitelist : [];

  return visits.filter((visit) => {
    if (!visit || visit.deletedAt || !Number.isFinite(Number(visit.visitTime))) {
      return false;
    }

    return Number(visit.visitTime) < cutoff && !visitMatchesWhitelist(visit, whitelist);
  });
}

export function archiveVisitsForExport(visits) {
  const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

  return [...(Array.isArray(visits) ? visits : [])].sort((left, right) => {
    const leftTime = Number(left?.visitTime);
    const rightTime = Number(right?.visitTime);
    const leftHasTime = Number.isFinite(leftTime);
    const rightHasTime = Number.isFinite(rightTime);

    if (leftHasTime && rightHasTime && leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    if (leftHasTime !== rightHasTime) {
      return leftHasTime ? -1 : 1;
    }

    return [
      compareText(String(left?.url || ""), String(right?.url || "")),
      compareText(String(left?.title || ""), String(right?.title || "")),
      compareText(String(left?.id || ""), String(right?.id || ""))
    ].find((comparison) => comparison !== 0) || 0;
  });
}
