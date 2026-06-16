import { chromeApi } from "./api.js";

export function searchHistory(query) {
  return chromeApi().history.search(query);
}

export function getHistoryVisits(query) {
  return chromeApi().history.getVisits(query);
}

export function deleteHistoryUrl(query) {
  return chromeApi().history.deleteUrl(query);
}

export function onHistoryVisited(listener) {
  chromeApi().history.onVisited.addListener(listener);
}

export function onHistoryVisitRemoved(listener) {
  chromeApi().history.onVisitRemoved.addListener(listener);
}
