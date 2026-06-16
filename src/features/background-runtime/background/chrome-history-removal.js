export function createChromeHistoryRemovalReconciler(deps, options = {}) {
  const now = options.now || (() => new Date().toISOString());

  async function reconcileHistoryRemoval(removed) {
    if (removed?.allHistory) {
      await deps.setMeta("lastNativeHistoryClear", {
        clearedAt: now()
      });
      return {
        type: "allHistory"
      };
    }

    const urls = Array.isArray(removed?.urls)
      ? [
          ...new Set(
            removed.urls
              .filter((url) => typeof url === "string" && url.trim())
              .map((url) => url.trim())
          )
        ]
      : [];

    if (!urls.length) {
      return {
        type: "empty"
      };
    }

    const deletedAt = now();
    await deps.markChromeDeletedByUrls(urls, deletedAt);
    return {
      type: "urls",
      urls,
      deletedAt
    };
  }

  return {
    reconcileHistoryRemoval
  };
}
