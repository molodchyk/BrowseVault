const FUZZY_TERM_MIN_LENGTH = 5;
const FUZZY_TERM_LONG_LENGTH = 8;

export function parseQuery(input = "") {
  const query = {
    raw: input.trim(),
    terms: [],
    negatives: [],
    phrases: [],
    site: [],
    title: [],
    url: [],
    category: [],
    source: [],
    transition: [],
    visitCount: {
      min: null,
      max: null
    },
    hour: {
      start: null,
      end: null
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

    if (value && ["category", "tag"].includes(field)) {
      query.category.push(value);
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

    if (value && field === "hour") {
      applyHourConstraint(query.hour, parseHourConstraint(value));
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
      const timestamp = parseDateBoundary(value, "start");
      if (timestamp !== null) {
        query.after = timestamp;
      }
      continue;
    }

    if (value && field === "before") {
      const timestamp = parseDateBoundary(value, "end");
      if (timestamp !== null) {
        query.before = timestamp;
      }
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

function parseHourConstraint(value) {
  const trimmed = value.trim();
  const range = /^(\d{1,2})(?:\.\.|-)(\d{1,2})$/.exec(trimmed);
  if (range) {
    const first = Number(range[1]);
    const second = Number(range[2]);
    if (isValidHour(first) && isValidHour(second)) {
      return {
        start: Math.min(first, second),
        end: Math.max(first, second)
      };
    }
    return null;
  }

  const exact = /^(\d{1,2})$/.exec(trimmed);
  if (exact) {
    const hour = Number(exact[1]);
    if (isValidHour(hour)) {
      return {
        start: hour,
        end: hour
      };
    }
  }

  return null;
}

function isValidHour(hour) {
  return Number.isInteger(hour) && hour >= 0 && hour <= 23;
}

function applyHourConstraint(target, constraint) {
  if (!constraint) {
    return;
  }

  target.start = target.start === null ? constraint.start : Math.max(target.start, constraint.start);
  target.end = target.end === null ? constraint.end : Math.min(target.end, constraint.end);
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

function parseDateBoundary(value, boundary) {
  const range = parseLocalDayRange(value);
  if (range) {
    return boundary === "end" ? range.end : range.start;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
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

function escapeRegexLiteral(value) {
  return value.replace(/[\\^$+?.()|[\]{}]/g, "\\$&");
}

function hasWildcard(token) {
  return /[*?]/.test(token) && /[\p{L}\p{N}]/u.test(token);
}

function wildcardPattern(token) {
  let pattern = "";
  for (const character of token) {
    if (character === "*") {
      pattern += ".*";
    } else if (character === "?") {
      pattern += ".";
    } else {
      pattern += escapeRegexLiteral(character);
    }
  }

  return new RegExp(pattern, "u");
}

function wildcardIncludes(text, token) {
  if (!hasWildcard(token)) {
    return text.includes(token);
  }

  try {
    return wildcardPattern(token).test(text);
  } catch {
    return false;
  }
}

function includesAllWildcard(text, tokens) {
  return tokens.every((token) => wildcardIncludes(text, token));
}

function searchableWords(text) {
  return text.match(/[\p{L}\p{N}]+/gu) || [];
}

function fuzzyDistanceLimit(token) {
  if (token.length < FUZZY_TERM_MIN_LENGTH) {
    return 0;
  }

  return token.length >= FUZZY_TERM_LONG_LENGTH ? 2 : 1;
}

function isOneEditAway(first, second) {
  const firstLength = first.length;
  const secondLength = second.length;

  if (Math.abs(firstLength - secondLength) > 1) {
    return false;
  }

  if (first === second) {
    return true;
  }

  if (firstLength === secondLength) {
    let differences = 0;
    for (let index = 0; index < firstLength; index += 1) {
      if (first[index] !== second[index]) {
        differences += 1;
        if (differences > 1) {
          break;
        }
      }
    }

    if (differences <= 1) {
      return true;
    }

    for (let index = 0; index < firstLength - 1; index += 1) {
      if (
        first[index] !== second[index] &&
        first[index] === second[index + 1] &&
        first[index + 1] === second[index] &&
        first.slice(index + 2) === second.slice(index + 2)
      ) {
        return first.slice(0, index) === second.slice(0, index);
      }
    }

    return false;
  }

  const shorter = firstLength < secondLength ? first : second;
  const longer = firstLength < secondLength ? second : first;
  let shorterIndex = 0;
  let longerIndex = 0;
  let edits = 0;

  while (shorterIndex < shorter.length && longerIndex < longer.length) {
    if (shorter[shorterIndex] === longer[longerIndex]) {
      shorterIndex += 1;
      longerIndex += 1;
      continue;
    }

    edits += 1;
    if (edits > 1) {
      return false;
    }
    longerIndex += 1;
  }

  return true;
}

function editDistanceWithin(first, second, limit) {
  if (limit <= 0) {
    return first === second;
  }

  if (limit === 1) {
    return isOneEditAway(first, second);
  }

  if (Math.abs(first.length - second.length) > limit) {
    return false;
  }

  const previous = Array.from({ length: second.length + 1 }, (_value, index) => index);
  const current = Array.from({ length: second.length + 1 }, () => 0);

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    current[0] = firstIndex;
    let rowMinimum = current[0];

    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      const substitutionCost = first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1;
      current[secondIndex] = Math.min(
        previous[secondIndex] + 1,
        current[secondIndex - 1] + 1,
        previous[secondIndex - 1] + substitutionCost
      );

      rowMinimum = Math.min(rowMinimum, current[secondIndex]);
    }

    if (rowMinimum > limit) {
      return false;
    }

    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[second.length] <= limit;
}

function fuzzyIncludes(text, token) {
  if (hasWildcard(token)) {
    return wildcardIncludes(text, token);
  }

  if (text.includes(token)) {
    return true;
  }

  const limit = fuzzyDistanceLimit(token);
  if (!limit) {
    return false;
  }

  return searchableWords(text).some((word) => {
    const normalized = word.toLowerCase();
    if (Math.abs(normalized.length - token.length) > limit) {
      return false;
    }
    return editDistanceWithin(token, normalized, limit);
  });
}

function includesAllFuzzy(text, tokens) {
  return tokens.every((token) => fuzzyIncludes(text, token));
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
