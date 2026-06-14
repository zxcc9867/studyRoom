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

export type NewTodoDatesInput<T extends ExistingTodoIdentity> = {
  dates: string[];
  title: string;
  existingTodos: T[];
  startTime?: string | null;
  endTime?: string | null;
};

export const todoWeekdayOptions: TodoWeekdayOption[];
export function buildRecurringTodoDates(input: TodoRecurrenceInput): string[];
export function filterNewTodoDates<T extends ExistingTodoIdentity>(input: NewTodoDatesInput<T>): string[];
export function getDefaultRepeatEndDate(startDate: string): string;
export function getWeekdayFromDateKey(dateKey: string): number;
