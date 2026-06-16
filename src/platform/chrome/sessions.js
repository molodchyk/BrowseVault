import { chromeApi } from "./api.js";

export function getRecentlyClosedSessions(filter) {
  return chromeApi().sessions.getRecentlyClosed(filter);
}

export function restoreSession(sessionId) {
  return chromeApi().sessions.restore(sessionId);
}
