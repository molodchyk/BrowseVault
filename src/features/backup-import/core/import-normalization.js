function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function cleanTitle(value) {
  const title = String(value || "").trim();
  return /^(untitle|untitled|null|undefined)$/i.test(title) ? "" : title;
}

function looksLikeGoogleActivity(item) {
  return Boolean(item?.titleUrl || (item?.time && Array.isArray(item?.products)));
}

function normalizeRawImportVisit(item, source) {
  const row = item || {};
  const url = firstNonEmpty(
    row.url,
    row.uri,
    row.link,
    row.href,
    row.address,
    row.titleUrl,
    row.title_url,
    row.titleurl,
    row.pageUrl,
    row.page_url,
    row.pageurl
  );
  const title = cleanTitle(firstNonEmpty(
    row.title,
    row.name,
    row.pageTitle,
    row.page_title,
    row.pagetitle,
    row.text
  ));

  return {
    id: firstNonEmpty(row.id, row.visitId, row.visit_id, row.visitid),
    chromeId: firstNonEmpty(row.chromeId, row.chrome_id, row.chromeid, row.historyId, row.history_id, row.historyid),
    url,
    title,
    visitTime: firstNonEmpty(
      row.visitTime,
      row.visit_time,
      row.visittime,
      row.visitTimestampMs,
      row.visit_timestamp_ms,
      row.visittimestampms,
      row.visitTimeIso,
      row.visit_time_iso,
      row.visittimeiso,
      row.lastVisitTime,
      row.last_visit_time,
      row.lastvisittime,
      row.lastVisitTimeLocal,
      row.last_visit_time_local,
      row.lastvisittimelocal,
      row.time_usec,
      row.timeUsec,
      row.timeusec,
      row.time,
      row.timestamp,
      row.dateTime,
      row.date_time,
      row.datetime,
      row.date
    ),
    lastVisitTime: firstNonEmpty(row.lastVisitTime, row.last_visit_time, row.lastvisittime),
    visitCount: firstNonEmpty(row.visitCount, row.visit_count, row.visitcount, row.visits, 1),
    typedCount: firstNonEmpty(row.typedCount, row.typed_count, row.typedcount, 0),
    transition: firstNonEmpty(row.transition, row.transitionType, row.transition_type, row.transitiontype, row.pageTransition, row.page_transition, row.pagetransition),
    source: row.source || source
  };
}

export function importArchiveSource(archive) {
  if (archive?.app) {
    return archive.app;
  }

  if (Array.isArray(archive?.["Browser History"])) {
    return "google-takeout";
  }

  if (Array.isArray(archive) && archive.some(looksLikeGoogleActivity)) {
    return "google-my-activity";
  }

  if (Array.isArray(archive)) {
    return "json-array";
  }

  return "unknown";
}

export function normalizeImportVisitCandidates(items, source = "import") {
  return (Array.isArray(items) ? items : []).map((item) => normalizeRawImportVisit(item, source));
}

export function extractImportVisits(archive) {
  const source = importArchiveSource(archive);

  if (Array.isArray(archive)) {
    return normalizeImportVisitCandidates(archive, source);
  }

  if (Array.isArray(archive?.visits)) {
    return normalizeImportVisitCandidates(archive.visits, source);
  }

  if (Array.isArray(archive?.items)) {
    return normalizeImportVisitCandidates(archive.items, source);
  }

  if (Array.isArray(archive?.["Browser History"])) {
    return normalizeImportVisitCandidates(archive["Browser History"], source);
  }

  if (Array.isArray(archive?.browserHistory)) {
    return normalizeImportVisitCandidates(archive.browserHistory, source);
  }

  if (Array.isArray(archive?.history)) {
    return normalizeImportVisitCandidates(archive.history, source);
  }

  if (Array.isArray(archive?.records)) {
    return normalizeImportVisitCandidates(archive.records, source);
  }

  if (Array.isArray(archive?.data)) {
    return normalizeImportVisitCandidates(archive.data, source);
  }

  return [];
}
