export function parseQuery(input = "") {
  const query = {
    raw: input.trim(),
    terms: [],
    negatives: [],
    phrases: [],
    site: [],
    title: [],
    url: [],
    after: null,
    before: null,
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
      query.site.push(value.replace(/^www\./, ""));
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

function includesAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

export function matchesVisitQuery(visit, query) {
  const title = visit.normalizedTitle || visit.title?.toLowerCase() || "";
  const url = visit.normalizedUrl || visit.url?.toLowerCase() || "";
  const domain = visit.domain || "";
  const haystack = `${title} ${url} ${domain}`;

  if (query.after && visit.visitTime < query.after) {
    return false;
  }

  if (query.before && visit.visitTime > query.before + 86400000 - 1) {
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

