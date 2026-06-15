export type TodoWeekdayOption = {
  value: number;
  label: string;
};

export type TodoRecurrenceInput = {
  startDate: string;
  endDate: string;
  weekdays: number[];
};

export type ExistingTodoIdentity = {
  local_date: string;
  title: string;
  start_time?: string | null;
  end_time?: string | null;
};

export type TodoRepeatMetadata = {
  repeat_mode?: "single" | "weekly" | string | null;
  repeat_weekdays?: number[] | null;
  repeat_until?: string | null;
};

export type NewTodoDatesInput<T extends ExistingTodoIdentity> = {
  dates: string[];
  title: string;
  existingTodos: T[];
  startTime?: string | null;
  endTime?: string | null;
};

export const todoWeekdayOptions: TodoWeekdayOption[];
export function normalizeTodoRepeatWeekdays(weekdays: unknown): number[];
export function isWeeklyTodo(todo: TodoRepeatMetadata | null | undefined): boolean;
export function formatTodoRepeatLabel(todo: TodoRepeatMetadata | null | undefined): string;
export function buildRecurringTodoDates(input: TodoRecurrenceInput): string[];
export function filterNewTodoDates<T extends ExistingTodoIdentity>(input: NewTodoDatesInput<T>): string[];
export function getTodoSaveFocusDate(input: {
  selectedDate: string;
  targetDates: string[];
}): string;
export function getDefaultRepeatEndDate(startDate: string): string;
export function getWeekdayFromDateKey(dateKey: string): number;
