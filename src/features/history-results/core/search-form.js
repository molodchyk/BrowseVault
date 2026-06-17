function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate())
  ].join("-");
}

function shiftedLocalDate(now, offsetDays) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
}

export function dateShortcutValues(shortcut, now = new Date()) {
  const today = shiftedLocalDate(now, 0);

  if (shortcut === "today") {
    return {
      onDate: localDateKey(today),
      after: "",
      before: ""
    };
  }

  if (shortcut === "yesterday") {
    return {
      onDate: localDateKey(shiftedLocalDate(now, -1)),
      after: "",
      before: ""
    };
  }

  if (shortcut === "last7" || shortcut === "last30") {
    const days = shortcut === "last7" ? 7 : 30;
    return {
      onDate: "",
      after: localDateKey(shiftedLocalDate(now, -(days - 1))),
      before: localDateKey(today)
    };
  }

  if (shortcut === "all") {
    return {
      onDate: "",
      after: "",
      before: ""
    };
  }

  return null;
}

export function historySearchTextFromValues({
  query = "",
  onDate = "",
  after = "",
  before = ""
}) {
  const parts = [query.trim()];
  const trimmedOnDate = onDate.trim();
  const trimmedAfter = after.trim();
  const trimmedBefore = before.trim();

  if (trimmedOnDate) {
    parts.push(`date:${trimmedOnDate}`);
  }

  if (trimmedAfter) {
    parts.push(`after:${trimmedAfter}`);
  }

  if (trimmedBefore) {
    parts.push(`before:${trimmedBefore}`);
  }

  return parts.filter(Boolean).join(" ");
}
