import { chromeApi } from "./api.js";

export function getBookmarkTree() {
  return chromeApi().bookmarks.getTree();
}
