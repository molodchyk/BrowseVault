export function parseQuery(input = "") {
  const query = {
    raw: input.trim(),
    terms: [],
    negatives: [],
    phrases: [],
    site: [],
    title: [],
    url: [],
    source: [],
    transition: [],
    visitCount: {
      min: null,
      max: null
    },
    after: null,
    before: null,
    dateStart: null,
    dateEnd: null,
    regex: null
  };

  const phrasePattern = /"([^"]+)"/g;
  const stripped = query.raw.replace(phrasePattern, (_match, phrase) => {
    query.phrases.push(phrase.toLowerCase());
    return " ";
  });

  for (const token of stripped.split(/\s+/).filter(Boolean)) {
    const lower = token.toLowerCase();
    const [field, ...rest] = lower.split(":");
    const value = rest.join(":");

    if (value && ["site", "domain", "host"].includes(field)) {
      query.site.push(normalizeSiteFilter(value));
      continue;
    }

    if (value && field === "title") {
      query.title.push(value);
      continue;
    }

    if (value && field === "url") {
      query.url.push(value);
      continue;
    }

    if (value && field === "source") {
      query.source.push(value);
      continue;
    }

    if (value && field === "transition") {
      query.transition.push(value);
      continue;
    }

    if (value && ["visits", "visitcount", "count"].includes(field)) {
      applyVisitCountConstraint(query.visitCount, parseVisitCountConstraint(value));
      continue;
    }

    if (value && ["date", "day", "on"].includes(field)) {
      const range = parseLocalDayRange(value);
      if (range) {
        query.dateStart = range.start;
        query.dateEnd = range.end;
      }
      continue;
    }

    if (value && field === "after") {
      query.after = Date.parse(value);
      continue;
    }

    if (value && field === "before") {
      query.before = Date.parse(value);
      continue;
    }

    if (value && field === "regex") {
      try {
        query.regex = new RegExp(value, "i");
      } catch {
        query.regex = null;
      }
      continue;
    }

    if (lower.startsWith("-") && lower.length > 1) {
      query.negatives.push(lower.slice(1));
      continue;
    }

    query.terms.push(lower);
  }

  return query;
}

function parseLocalDayRange(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const start = new Date(year, month - 1, day);

  if (
    start.getFullYear() !== year ||
    start.getMonth() !== month - 1 ||
    start.getDate() !== day
  ) {
    return null;
  }

  return {
    start: start.getTime(),
    end: new Date(year, month - 1, day + 1).getTime() - 1
  };
}

function normalizeSiteFilter(value) {
  const trimmed = value.trim().toLowerCase();
  try {
    const scheme = "https" + "://";
    const url = new URL(trimmed.includes("://") ? trimmed : `${scheme}${trimmed}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return trimmed.replace(/^www\./, "").replace(/\/+$/, "");
  }
}

function includesAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

function parseVisitCountConstraint(value) {
  const trimmed = value.trim();
  const range = /^(\d+)(?:\.\.|-)(\d+)$/.exec(trimmed);
  if (range) {
    const first = Number(range[1]);
    const second = Number(range[2]);
    return {
      min: Math.min(first, second),
      max: Math.max(first, second)
    };
  }

  const comparator = /^(>=|<=|>|<)(\d+)$/.exec(trimmed);
  if (comparator) {
    const count = Number(comparator[2]);
    if (comparator[1] === ">=") {
      return { min: count, max: null };
    }
    if (comparator[1] === ">") {
      return { min: count + 1, max: null };
    }
    if (comparator[1] === "<=") {
      return { min: null, max: count };
    }
    return { min: null, max: count - 1 };
  }

  const plus = /^(\d+)\+$/.exec(trimmed);
  if (plus) {
    return { min: Number(plus[1]), max: null };
  }

  const exact = /^(\d+)$/.exec(trimmed);
  if (exact) {
    const count = Number(exact[1]);
    return { min: count, max: count };
  }

  return null;
}

function applyVisitCountConstraint(target, constraint) {
  if (!constraint) {
    return;
  }

  if (constraint.min !== null) {
    target.min = target.min === null ? constraint.min : Math.max(target.min, constraint.min);
  }

  if (constraint.max !== null) {
    target.max = target.max === null ? constraint.max : Math.min(target.max, constraint.max);
  }
}

export function matchesVisitQuery(visit, query) {
  const title = visit.normalizedTitle || visit.title?.toLowerCase() || "";
  const url = visit.normalizedUrl || visit.url?.toLowerCase() || "";
  const domain = (visit.domain || "").toLowerCase();
  const source = (visit.source || "").toLowerCase();
  const transition = (visit.transition || "").toLowerCase();
  const visitCount = Number(visit.visitCount || 0);
  const haystack = `${title} ${url} ${domain}`;

  if (query.after && visit.visitTime < query.after) {
    return false;
  }

  if (query.before && visit.visitTime > query.before + 86400000 - 1) {
    return false;
  }

  if (query.dateStart !== null && visit.visitTime < query.dateStart) {
    return false;
  }

  if (query.dateEnd !== null && visit.visitTime > query.dateEnd) {
    return false;
  }

  if (query.site.length && !query.site.some((site) => domain === site || domain.endsWith(`.${site}`))) {
    return false;
  }

  if (query.title.length && !includesAll(title, query.title)) {
    return false;
  }

  if (query.url.length && !includesAll(url, query.url)) {
    return false;
  }

  if (query.source.length && !query.source.some((token) => source.includes(token))) {
    return false;
  }

  if (query.transition.length && !query.transition.some((token) => transition.includes(token))) {
    return false;
  }

  if (query.visitCount.min !== null && visitCount < query.visitCount.min) {
    return false;
  }

  if (query.visitCount.max !== null && visitCount > query.visitCount.max) {
    return false;
  }

  if (query.phrases.length && !includesAll(haystack, query.phrases)) {
    return false;
  }

  if (query.terms.length && !includesAll(haystack, query.terms)) {
    return false;
  }

  if (query.negatives.some((token) => haystack.includes(token))) {
    return false;
  }

  if (query.regex && !query.regex.test(haystack)) {
    return false;
  }

  return true;
}
