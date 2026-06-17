import { stringifyJson } from "../core/json-stringify.js";

export async function downloadJson(filename, data, options = {}, runtime = globalThis) {
  const text = await stringifyJson(data, {
    chunkSize: options.jsonChunkSize,
    scheduler: options.jsonScheduler,
    space: 2
  });
  return downloadText(filename, "application/json", text, options, runtime);
}

function downloadWithSavePrompt(url, filename, runtime) {
  const downloads = runtime.chrome?.downloads;
  if (!downloads?.download) {
    return null;
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, downloadId) => {
      if (settled) {
        return;
      }

      settled = true;
      if (error) {
        reject(error);
        return;
      }

      resolve(downloadId);
    };
    const callback = (downloadId) => {
      const lastError = runtime.chrome?.runtime?.lastError;
      finish(lastError ? new Error(lastError.message) : null, downloadId);
    };

    try {
      const maybePromise = downloads.download.call(downloads, {
        filename,
        saveAs: true,
        url
      }, callback);

      if (maybePromise?.then) {
        maybePromise.then((downloadId) => finish(null, downloadId)).catch((error) => finish(error));
      }
    } catch (error) {
      finish(error);
    }
  });
}

export async function downloadText(filename, mimeType, text, options = {}, runtime = globalThis) {
  const blob = new runtime.Blob([text], { type: mimeType });
  const url = runtime.URL.createObjectURL(blob);
  const useSavePrompt = options.saveMode === "ask";

  if (useSavePrompt) {
    const prompted = downloadWithSavePrompt(url, filename, runtime);
    if (prompted) {
      try {
        await prompted;
        return blob.size;
      } finally {
        runtime.URL.revokeObjectURL(url);
      }
    }
  }

  const anchor = runtime.document.createElement("a");

  try {
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    return blob.size;
  } finally {
    runtime.URL.revokeObjectURL(url);
  }
}
