import { formatCount } from "./formatting.js";

export function label(options, key, fallback) {
  const value = options.labels?.[key];
  if (typeof value === "function") {
    return value([], fallback) || fallback;
  }

  return value || fallback;
}

export function message(options, key, fallback, substitutions = []) {
  const value = options.labels?.[key];
  if (typeof value === "function") {
    return value(substitutions, fallback) || fallback;
  }

  return value || fallback;
}

export function countMessage(options, count, oneKey, manyKey, oneFallback, manyFallback, extraSubstitutions = []) {
  const numericCount = Number(count || 0);
  const formattedCount = formatCount(numericCount);
  return message(
    options,
    numericCount === 1 ? oneKey : manyKey,
    numericCount === 1 ? oneFallback : manyFallback,
    [formattedCount, ...extraSubstitutions]
  );
}
