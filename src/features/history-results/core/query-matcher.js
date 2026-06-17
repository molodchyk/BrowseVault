import {
  includesAll,
  includesAllFuzzy,
  includesAllWildcard,
  wildcardIncludes
} from "./query-text.js";

export function matchesVisitQuery(visit, query) {
  const title = visit.normalizedTitle || visit.title?.toLowerCase() || "";
  const url = visit.normalizedUrl || visit.url?.toLowerCase() || "";
  const domain = (visit.domain || "").toLowerCase();
  const domains = Array.isArray(visit.domains) && visit.domains.length
    ? visit.domains.map((value) => String(value || "").toLowerCase()).filter(Boolean)
    : [domain].filter(Boolean);
  const source = (visit.source || "").toLowerCase();
  const transition = (visit.transition || "").toLowerCase();
  const category = (visit.category || "").toLowerCase();
  const visitCount = Number(visit.visitCount || 0);
  const haystack = `${title} ${url} ${domains.join(" ")} ${category}`;

  if (query.after !== null && visit.visitTime < query.after) {
    return false;
  }

  if (query.before !== null && visit.visitTime > query.before) {
    return false;
  }

  if (query.dateStart !== null && visit.visitTime < query.dateStart) {
    return false;
  }

  if (query.dateEnd !== null && visit.visitTime > query.dateEnd) {
    return false;
  }

  if (
    query.site.length &&
    !query.site.some((site) => domains.some((item) => item === site || item.endsWith(`.${site}`)))
  ) {
    return false;
  }

  if (query.title.length && !includesAllWildcard(title, query.title)) {
    return false;
  }

  if (query.url.length && !includesAllWildcard(url, query.url)) {
    return false;
  }

  if (query.category.length && !query.category.some((token) => wildcardIncludes(category, token))) {
    return false;
  }

  if (query.source.length && !query.source.some((token) => wildcardIncludes(source, token))) {
    return false;
  }

  if (query.transition.length && !query.transition.some((token) => wildcardIncludes(transition, token))) {
    return false;
  }

  if (query.visitCount.min !== null && visitCount < query.visitCount.min) {
    return false;
  }

  if (query.visitCount.max !== null && visitCount > query.visitCount.max) {
    return false;
  }

  if (query.hour.start !== null || query.hour.end !== null) {
    const visitHour = new Date(visit.visitTime).getHours();
    if (query.hour.start !== null && visitHour < query.hour.start) {
      return false;
    }
    if (query.hour.end !== null && visitHour > query.hour.end) {
      return false;
    }
  }

  if (query.phrases.length && !includesAll(haystack, query.phrases)) {
    return false;
  }

  if (query.terms.length && !includesAllFuzzy(haystack, query.terms)) {
    return false;
  }

  if (query.negatives.some((token) => wildcardIncludes(haystack, token))) {
    return false;
  }

  if (query.regex && !query.regex.test(haystack)) {
    return false;
  }

  return true;
}
