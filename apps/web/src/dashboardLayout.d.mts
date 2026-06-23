export type TodayTaskView = "checklist" | "planner";
export type TodaySectionId = "topbar" | "attendance" | "focus" | "tasks";

export const TODAY_TASK_VIEWS: TodayTaskView[];
export const DEFAULT_TODAY_TASK_VIEW: TodayTaskView;
export const DEFAULT_TODAY_SECTION_ORDER: TodaySectionId[];

export function normalizeTodayTaskView(value: unknown): TodayTaskView;

export function normalizeTodaySectionOrder(value: unknown): TodaySectionId[];

export function moveTodaySection(
  order: unknown,
  sectionId: TodaySectionId,
  direction: "up" | "down",
): TodaySectionId[];
