import { chromeApi } from "./api.js";

export function searchDownloadItems(query) {
  return chromeApi().downloads.search(query);
}
