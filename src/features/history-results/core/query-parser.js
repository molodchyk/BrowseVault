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
