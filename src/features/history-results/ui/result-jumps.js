const RESULT_SELECTOR = ".result";

function visibleResultItems(resultsElement) {
  return Array.from(resultsElement.querySelectorAll(RESULT_SELECTOR));
}

export function jumpToResult(resultsElement, position) {
  const items = visibleResultItems(resultsElement);
  if (!items.length) {
    return false;
  }

  const target = position === "last" ? items.at(-1) : items[0];
  for (const item of items) {
    item.tabIndex = item === target ? 0 : -1;
  }

  target.scrollIntoView?.({
    block: position === "last" ? "end" : "start",
    behavior: "smooth"
  });
  target.focus?.({
    preventScroll: true
  });
  return true;
}

export function createResultJumpActions({ elements, setStatus }) {
  function jumpToFirstResult() {
    setStatus(jumpToResult(elements.results, "first")
      ? "Jumped to first visible result"
      : "No visible results"
    );
  }

  function jumpToLastResult() {
    setStatus(jumpToResult(elements.results, "last")
      ? "Jumped to last visible result"
      : "No visible results"
    );
  }

  return {
    jumpToFirstResult,
    jumpToLastResult
  };
}
