export const DEFAULT_BOOTSTRAP_URL_LIMIT = 3000;
export const DEFAULT_VISIT_EXPANSION_CONCURRENCY = 8;

export function isInternalUrl(url) {
  return /^(chrome|edge|brave|vivaldi|opera|about|chrome-extension):/i.test(url || "");
}

export function hostMatchesRule(host, rule) {
  return host === rule || host.endsWith(`.${rule}`);
}

export function shouldArchiveUrlWithRules(url, rules) {
  if (!url || isInternalUrl(url)) {
    return false;
  }

  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }

  if (rules.whitelist.some((rule) => hostMatchesRule(host, rule))) {
    return true;
  }

  return !rules.blacklist.some((rule) => hostMatchesRule(host, rule));
}

export function createChromeHistorySync(deps, options = {}) {
  const bootstrapUrlLimit = options.bootstrapUrlLimit || DEFAULT_BOOTSTRAP_URL_LIMIT;
  const notifyVaultChanged = options.notifyVaultChanged || (() => false);
  const visitExpansionConcurrency = options.visitExpansionConcurrency || DEFAULT_VISIT_EXPANSION_CONCURRENCY;
  const now = options.now || (() => new Date().toISOString());

  async function shouldArchiveUrl(url, existingRules = null) {
    const rules = existingRules || (await deps.getRules());
    return shouldArchiveUrlWithRules(url, rules);
  }

  async function expandHistoryItems(items) {
    const expanded = [];
    const rules = await deps.getRules();
    let cursor = 0;

    async function worker() {
      while (cursor < items.length) {
        const item = items[cursor];
        cursor += 1;

        if (!(await shouldArchiveUrl(item.url, rules))) {
          continue;
        }

        try {
          const visits = await deps.getHistoryVisits({ url: item.url });
          if (!visits.length) {
            expanded.push(item);
            continue;
          }

          for (const visit of visits) {
            expanded.push({
              ...item,
              id: `${item.url}|${visit.visitId || visit.visitTime}`,
              visitId: visit.visitId || "",
              visitTime: visit.visitTime,
              transition: visit.transition || "",
              referringVisitId: visit.referringVisitId || ""
            });
          }
        } catch {
          expanded.push(item);
        }
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(visitExpansionConcurrency, items.length) },
        () => worker()
      )
    );

    return expanded;
  }

  async function bootstrapChromeHistory(reason = "startup") {
    const items = await deps.searchHistory({
      text: "",
      startTime: 0,
      maxResults: bootstrapUrlLimit
    });

    const expandedItems = await expandHistoryItems(items);
    const syncOptions = {
      source: "chrome-history",
      reason,
      syncedAt: now()
    };
    const result = deps.syncChromeHistoryItemsWithSyncMetadata
      ? await deps.syncChromeHistoryItemsWithSyncMetadata(expandedItems, syncOptions)
      : await deps.syncChromeHistoryItems(expandedItems, syncOptions);

    if (!deps.syncChromeHistoryItemsWithSyncMetadata) {
      await deps.setMeta("lastChromeSync", {
        ...result,
        reason,
        syncedAt: syncOptions.syncedAt
      });
    }

    notifyVaultChanged("chrome-history-sync");
    return result;
  }

  async function recordVisitedItem(item) {
    if (!(await shouldArchiveUrl(item.url))) {
      return false;
    }

    const captureOptions = {
      source: "chrome-history-live",
      capturedAt: now()
    };

    if (deps.recordChromeVisitWithCaptureMetadata) {
      await deps.recordChromeVisitWithCaptureMetadata(item, captureOptions);
    } else {
      await deps.recordChromeVisit(item, captureOptions);
      await deps.setMeta("lastLiveCapture", {
        capturedAt: captureOptions.capturedAt,
        title: item.title || "",
        url: item.url
      });
    }
    notifyVaultChanged("chrome-history-live");
    return true;
  }

  return {
    bootstrapChromeHistory,
    expandHistoryItems,
    recordVisitedItem,
    shouldArchiveUrl
  };
}
