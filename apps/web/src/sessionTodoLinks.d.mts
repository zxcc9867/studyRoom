export type SessionTodoSelectionReason = "no-todos" | "select-todos" | null;

export type SessionTodoSelectionDecision = {
  required: boolean;
  reason: SessionTodoSelectionReason;
};

export type SessionTodoLike = {
  id: string;
  local_date: string;
  title?: string;
  is_completed: boolean;
  position: number;
  created_at?: string;
};

export type SessionTodoLinkLike = {
  session_id: string;
  todo_id: string;
};

export function getIncompleteTodayTodos<T extends SessionTodoLike>(
  todos: T[],
  todayDateKey: string,
): T[];

export function shouldRequestSessionTodoSelection(input: {
  activeSession: boolean;
  incompleteTodayTodos: SessionTodoLike[];
  selectedTodoIds?: string[];
}): SessionTodoSelectionDecision;

export function buildSessionTodoLinkRows(input: {
  userId: string;
  sessionId: string;
  todoIds: string[];
}): Array<{
  user_id: string;
  session_id: string;
  todo_id: string;
}>;

export function getSessionLinkedTodos<T extends SessionTodoLike>(input: {
  activeSessionId: string | null | undefined;
  links: SessionTodoLinkLike[];
  todos: T[];
}): T[];

export function summarizeSessionTodos(todos: SessionTodoLike[]): {
  total: number;
  completed: number;
  message: string;
};
