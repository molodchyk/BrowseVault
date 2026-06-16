export async function copyText(text, services = {}) {
  if (!text) {
    throw new Error("Nothing to copy.");
  }

  const deps = {
    document: globalThis.document,
    execCommand: (command) => globalThis.document?.execCommand(command),
    navigator: globalThis.navigator,
    ...services
  };

  if (deps.navigator?.clipboard?.writeText) {
    try {
      await deps.navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the local selection-based copy path.
    }
  }

  const selection = deps.document.getSelection();
  const selectedRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const textArea = deps.document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "-1000px";
  deps.document.body.append(textArea);
  textArea.select();
  const copied = deps.execCommand("copy");
  textArea.remove();

  if (selectedRange) {
    selection.removeAllRanges();
    selection.addRange(selectedRange);
  }

  if (!copied) {
    throw new Error("Copy failed.");
  }
}
