const DEFAULT_MAX_HIGHLIGHT_TOKENS = 12;
const DEFAULT_MAX_HIGHLIGHT_RANGES = 80;

export function highlightTokensForScope(query, scope, options = {}) {
  const maxTokens = options.maxTokens || DEFAULT_MAX_HIGHLIGHT_TOKENS;
  const shared = [...query.terms, ...query.phrases];
  const scoped = scope === "title"
    ? query.title
    : scope === "url"
      ? [...query.url, ...query.site]
      : query.site;

  return [...new Set([...shared, ...scoped]
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean))]
    .sort((left, right) => right.length - left.length)
    .slice(0, maxTokens);
}

export function regexHighlightRanges(text, regex, options = {}) {
  const maxRanges = options.maxRanges || DEFAULT_MAX_HIGHLIGHT_RANGES;
  if (!regex) {
    return [];
  }

  try {
    const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
    const matcher = new RegExp(regex.source, flags);
    const ranges = [];
    let match = matcher.exec(text);

    while (match && ranges.length < maxRanges) {
      if (match[0].length) {
        ranges.push([match.index, match.index + match[0].length]);
      } else {
        matcher.lastIndex += 1;
      }
      match = matcher.exec(text);
    }

    return ranges;
  } catch {
    return [];
  }
}

export function highlightRanges(text, tokens, regex, options = {}) {
  const maxRanges = options.maxRanges || DEFAULT_MAX_HIGHLIGHT_RANGES;
  const lowerText = text.toLowerCase();
  const ranges = regexHighlightRanges(text, regex, { maxRanges });

  for (const token of tokens) {
    let cursor = 0;
    while (ranges.length < maxRanges) {
      const index = lowerText.indexOf(token, cursor);
      if (index === -1) {
        break;
      }
      ranges.push([index, index + token.length]);
      cursor = index + Math.max(token.length, 1);
    }
  }

  if (!ranges.length) {
    return [];
  }

  ranges.sort((left, right) => left[0] - right[0] || right[1] - left[1]);
  const merged = [];
  for (const [start, end] of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && start <= previous[1]) {
      previous[1] = Math.max(previous[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

export function appendHighlightedText(target, value, tokens, regex) {
  const text = String(value || "");
  const ownerDocument = target.ownerDocument;
  target.replaceChildren();

  if (!text || (!tokens.length && !regex)) {
    target.textContent = text;
    return;
  }

  const ranges = highlightRanges(text, tokens, regex);
  if (!ranges.length) {
    target.textContent = text;
    return;
  }

  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) {
      target.append(ownerDocument.createTextNode(text.slice(cursor, start)));
    }

    const mark = ownerDocument.createElement("mark");
    mark.className = "search-hit";
    mark.textContent = text.slice(start, end);
    target.append(mark);
    cursor = end;
  }

  if (cursor < text.length) {
    target.append(ownerDocument.createTextNode(text.slice(cursor)));
  }
}
