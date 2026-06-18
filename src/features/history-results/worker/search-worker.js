import { searchVisitRecords } from "../core/search-index.js";

function errorMessage(error) {
  return error instanceof Error ? error.message : "Search worker failed.";
}

export async function handleSearchWorkerMessage(data, postResult, searchRecords = searchVisitRecords) {
  const id = data?.id;
  try {
    const result = await searchRecords(data?.visits || [], data?.input || "", data?.options || {});
    postResult({
      id,
      ok: true,
      result
    });
  } catch (error) {
    postResult({
      id,
      ok: false,
      error: errorMessage(error)
    });
  }
}

if (typeof self !== "undefined" && self.addEventListener) {
  self.addEventListener("message", (event) => {
    handleSearchWorkerMessage(event.data, (message) => self.postMessage(message));
  });
}
