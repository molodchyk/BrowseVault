const FUZZY_TERM_MIN_LENGTH = 5;
const FUZZY_TERM_LONG_LENGTH = 8;

export function includesAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

export function wildcardIncludes(text, token) {
  if (!hasWildcard(token)) {
    return text.includes(token);
  }

  try {
    return wildcardPattern(token).test(text);
  } catch {
    return false;
  }
}

export function includesAllWildcard(text, tokens) {
  return tokens.every((token) => wildcardIncludes(text, token));
}

export function includesAllFuzzy(text, tokens) {
  return tokens.every((token) => fuzzyIncludes(text, token));
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
