function localizedMessage(getMessage, key, fallback, substitutions) {
  return getMessage?.(key, substitutions) || fallback;
}

function ruleDisplayType(rule, getMessage = () => "") {
  if (rule?.type === "blacklist") {
    return localizedMessage(getMessage, "ruleTypeBlacklist", "Blacklist");
  }
  if (rule?.type === "whitelist") {
    return localizedMessage(getMessage, "ruleTypeWhitelist", "Whitelist");
  }
  if (rule?.type === "category") {
    return localizedMessage(getMessage, "ruleTypeCategory", "Category");
  }
  return localizedMessage(getMessage, "ruleTypeGeneric", "Rule");
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

function groupHeadingText(type, count, getMessage = () => "") {
  const label = ruleDisplayType({ type }, getMessage);
  return localizedMessage(getMessage, "ruleGroupHeading", `${label} (${count})`, [label, String(count)]);
}

export function renderRuleList({ document, getMessage = () => "", rules, rulesList, onRemove }) {
  rulesList.replaceChildren();

  if (!rules.length) {
    const empty = document.createElement("li");
    empty.className = "rule-item";
    empty.textContent = localizedMessage(getMessage, "noDomainRulesYet", "No domain rules yet.");
    rulesList.append(empty);
    return;
  }

  for (const [type, groupRules] of groupedRules(rules)) {
    const heading = document.createElement("li");
    heading.className = "rule-group-heading";
    heading.textContent = groupHeadingText(type, groupRules.length, getMessage);
    rulesList.append(heading);

    for (const rule of groupRules) {
      const item = document.createElement("li");
      item.className = `rule-item rule-item-${rule.type}`;

      const label = document.createElement("span");
      label.className = "rule-label";

      const typeLabel = document.createElement("span");
      typeLabel.className = "rule-kind visually-hidden";
      const typeText = ruleDisplayType(rule, getMessage);
      typeLabel.textContent = localizedMessage(getMessage, "ruleKindLabel", `${typeText} rule`, [typeText]);

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
      remove.textContent = localizedMessage(getMessage, "buttonRemoveRule", "Remove");
      remove.addEventListener("click", () => onRemove(rule));

      item.append(label, remove);
      rulesList.append(item);
    }
  }
}
