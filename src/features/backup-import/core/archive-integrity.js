import { stringifyJson } from "./json-stringify.js";

export async function sha256Hex(text, cryptoProvider = globalThis.crypto) {
  const bytes = new TextEncoder().encode(text);
  const digest = await cryptoProvider.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function archiveIntegrityFields(archive) {
  return {
    schemaVersion: archive.schemaVersion || 1,
    rules: archive.rules || [],
    visits: archive.visits || archive.items || []
  };
}

export function archiveIntegrityPayload(archive) {
  return JSON.stringify(archiveIntegrityFields(archive));
}

export function archiveIntegrityPayloadAsync(archive, options = {}) {
  return stringifyJson(archiveIntegrityFields(archive), {
    chunkSize: options.jsonChunkSize,
    scheduler: options.jsonScheduler
  });
}

export async function attachArchiveIntegrity(archive, hashText = sha256Hex, options = {}) {
  return {
    ...archive,
    integrity: {
      algorithm: "SHA-256",
      scope: "schemaVersion,rules,visits",
      sha256: await hashText(await archiveIntegrityPayloadAsync(archive, options))
    }
  };
}

export async function verifyArchiveIntegrity(archive, hashText = sha256Hex, options = {}) {
  if (!archive?.integrity?.sha256) {
    return {
      checked: false,
      ok: true
    };
  }

  const actual = await hashText(await archiveIntegrityPayloadAsync(archive, options));
  return {
    checked: true,
    ok: actual === archive.integrity.sha256,
    expected: archive.integrity.sha256,
    actual
  };
}
