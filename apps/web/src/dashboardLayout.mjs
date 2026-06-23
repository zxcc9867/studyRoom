export const TODAY_TASK_VIEWS = ["checklist", "planner"];
export const DEFAULT_TODAY_TASK_VIEW = "checklist";

export const DEFAULT_TODAY_SECTION_ORDER = ["topbar", "attendance", "focus", "tasks"];
const TODAY_SECTION_IDS = new Set(DEFAULT_TODAY_SECTION_ORDER);

export function normalizeTodayTaskView(value) {
  return TODAY_TASK_VIEWS.includes(value) ? value : DEFAULT_TODAY_TASK_VIEW;
}

export function normalizeTodaySectionOrder(value) {
  if (!Array.isArray(value)) {
    return [...DEFAULT_TODAY_SECTION_ORDER];
  }

  const ordered = [];
  for (const item of value) {
    if (TODAY_SECTION_IDS.has(item) && !ordered.includes(item)) {
      ordered.push(item);
    }
  }

  for (const sectionId of DEFAULT_TODAY_SECTION_ORDER) {
    if (!ordered.includes(sectionId)) {
      ordered.push(sectionId);
    }
  }

  return ordered;
}

export function moveTodaySection(order, sectionId, direction) {
  const normalized = normalizeTodaySectionOrder(order);
  const index = normalized.indexOf(sectionId);
  if (index < 0) {
    return normalized;
  }

  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= normalized.length) {
    return normalized;
  }

  const next = [...normalized];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}
