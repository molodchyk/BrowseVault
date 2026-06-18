export function localizedMessage(getMessage, key, fallback, substitutions) {
  return getMessage?.(key, substitutions) || fallback;
}

export function localizedCountMessage(getMessage, count, oneKey, manyKey, oneFallback, manyFallback, extraSubstitutions = []) {
  return localizedMessage(
    getMessage,
    count === 1 ? oneKey : manyKey,
    count === 1 ? oneFallback : manyFallback,
    [String(count), ...extraSubstitutions]
  );
}

export function localizedRuleType(type, getMessage) {
  const key = {
    blacklist: "ruleTypeBlacklist",
    category: "ruleTypeCategory",
    whitelist: "ruleTypeWhitelist"
  }[type] || "ruleTypeGeneric";
  return localizedMessage(getMessage, key, type);
}

export function chromeUrlLabel(count, getMessage) {
  return localizedCountMessage(
    getMessage,
    count,
    "chromeUrlLabelOne",
    "chromeUrlLabelMany",
    `${count} URL`,
    `${count} URLs`
  );
}

export function currentResultLabel(count, getMessage) {
  return localizedCountMessage(
    getMessage,
    count,
    "currentBrowseVaultResultLabelOne",
    "currentBrowseVaultResultLabelMany",
    `${count} current BrowseVault result`,
    `${count} current BrowseVault results`
  );
}

export function selectedRecordLabel(count, getMessage) {
  return localizedCountMessage(
    getMessage,
    count,
    "selectedBrowseVaultRecordLabelOne",
    "selectedBrowseVaultRecordLabelMany",
    `${count} selected record`,
    `${count} selected records`
  );
}
