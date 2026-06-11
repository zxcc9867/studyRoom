export const DEFAULT_TODO_HISTORY_PAGE_SIZE: number;

export type TodoHistoryItem = {
  id: string;
  local_date: string;
  title: string;
  is_completed: boolean;
  position: number;
  created_at: string;
};

export type TodoHistoryPage<T> = {
  items: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

export type TodoHistoryStats = {
  totalTodos: number;
  completedTodos: number;
  completionPercent: number;
  monthCompletedTodos: number;
};

export function getCompletedTodoHistory<T extends TodoHistoryItem>(todos: T[]): T[];
export function paginateTodoHistory<T>(
  items: T[],
  page: number,
  pageSize?: number,
): TodoHistoryPage<T>;
export function calculateTodoHistoryStats<T extends Pick<TodoHistoryItem, "is_completed" | "local_date">>(
  todos: T[],
  monthKey: string,
): TodoHistoryStats;
