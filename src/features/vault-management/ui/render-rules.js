function ruleDisplayType(rule) {
  if (rule?.type === "blacklist") {
    return "Blacklist";
  }
  if (rule?.type === "whitelist") {
    return "Whitelist";
  }
  if (rule?.type === "category") {
    return "Category";
  }
  return "Rule";
}

const ruleGroupOrder = ["category", "blacklist", "whitelist"];

function groupedRules(rules) {
  const groups = new Map();
  for (const rule of rules) {
    const type = ruleGroupOrder.includes(rule?.type) ? rule.type : "rule";
    if (!groups.has(type)) {
      groups.set(type, []);
    }
    groups.get(type).push(rule);
  }
  return [
    ...ruleGroupOrder.filter((type) => groups.has(type)).map((type) => [type, groups.get(type)]),
    ...[...groups.entries()].filter(([type]) => !ruleGroupOrder.includes(type))
  ];
}

function groupHeadingText(type, count) {
  const label = ruleDisplayType({ type });
  return `${label} (${count})`;
}

export function renderRuleList({ document, rules, rulesList, onRemove }) {
  rulesList.replaceChildren();

  if (!rules.length) {
    const empty = document.createElement("li");
    empty.className = "rule-item";
    empty.textContent = "No domain rules yet.";
    rulesList.append(empty);
    return;
  }

  for (const [type, groupRules] of groupedRules(rules)) {
    const heading = document.createElement("li");
    heading.className = "rule-group-heading";
    heading.textContent = groupHeadingText(type, groupRules.length);
    rulesList.append(heading);

    for (const rule of groupRules) {
      const item = document.createElement("li");
      item.className = `rule-item rule-item-${rule.type}`;

      const label = document.createElement("span");
      label.className = "rule-label";

      const typeLabel = document.createElement("span");
      typeLabel.className = "rule-kind visually-hidden";
      typeLabel.textContent = `${ruleDisplayType(rule)} rule`;

      const value = document.createElement("span");
      value.className = "rule-value";
      value.textContent = rule.value;

      label.append(typeLabel, value);
      if (rule.type === "category" && rule.category) {
        const category = document.createElement("span");
        category.className = "rule-detail";
        category.textContent = rule.category;
        label.append(category);
      }

      const remove = document.createElement("button");
      remove.className = "ghost";
      remove.type = "button";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => onRemove(rule));

      item.append(label, remove);
      rulesList.append(item);
    }
  }
}
