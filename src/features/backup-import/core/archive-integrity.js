export async function sha256Hex(text, cryptoProvider = globalThis.crypto) {
  const bytes = new TextEncoder().encode(text);
  const digest = await cryptoProvider.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function archiveIntegrityPayload(archive) {
  return JSON.stringify({
    schemaVersion: archive.schemaVersion || 1,
    rules: archive.rules || [],
    visits: archive.visits || archive.items || []
  });
}

export async function attachArchiveIntegrity(archive, hashText = sha256Hex) {
  return {
    ...archive,
    integrity: {
      algorithm: "SHA-256",
      scope: "schemaVersion,rules,visits",
      sha256: await hashText(archiveIntegrityPayload(archive))
    }
  };
}

export async function verifyArchiveIntegrity(archive, hashText = sha256Hex) {
  if (!archive?.integrity?.sha256) {
    return {
      checked: false,
      ok: true
    };
  }

  const actual = await hashText(archiveIntegrityPayload(archive));
  return {
    checked: true,
    ok: actual === archive.integrity.sha256,
    expected: archive.integrity.sha256,
    actual
  };
}
