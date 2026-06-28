export type PlannerTodoLike = {
  id?: string;
  user_id?: string;
  local_date: string;
  title: string;
  is_completed?: boolean;
  position?: number;
  start_time?: string | null;
  end_time?: string | null;
  goal_id?: string | null;
  repeat_group_id?: string | null;
  repeat_mode?: string;
  repeat_weekdays?: number[] | null;
  repeat_until?: string | null;
  repeat_forever?: boolean;
  created_at?: string;
};

export type PlanCopyRow = {
  user_id: string;
  local_date: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  goal_id: string | null;
  repeat_group_id: null;
  repeat_mode: "single";
  repeat_weekdays: [];
  repeat_until: null;
  repeat_forever: false;
  is_completed: false;
  position: number;
};

export function getPlannerDateLabel(dateKey: string, todayDateKey: string): string;

export function normalizePlanCopyTargetDates(input: {
  sourceDate: string | null;
  selectedDates: string[];
}): string[];

export function buildPlanCopyRows(input: {
  sourceTodos: PlannerTodoLike[];
  targetDates: string[];
  existingTodos: PlannerTodoLike[];
  userId: string;
}): PlanCopyRow[];
