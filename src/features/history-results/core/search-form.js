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
