export function getIncompleteTodayTodos(todos, todayDateKey) {
  return todos
    .filter((todo) => todo.local_date === todayDateKey && !todo.is_completed)
    .sort(compareTodosByPlanOrder);
}

export function shouldRequestSessionTodoSelection({
  activeSession,
  incompleteTodayTodos,
  selectedTodoIds,
}) {
  if (activeSession) {
    return { required: false, reason: null };
  }

  if (Array.isArray(selectedTodoIds) && selectedTodoIds.length > 0) {
    return { required: false, reason: null };
  }

  if (incompleteTodayTodos.length === 0) {
    return { required: true, reason: "no-todos" };
  }

  return { required: true, reason: "select-todos" };
}

export function normalizeSessionTodoDraft(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function shouldDisableSessionTodoStart({ busy, addBusy, selectedTodoIds }) {
  return Boolean(busy || addBusy || !Array.isArray(selectedTodoIds) || selectedTodoIds.length === 0);
}

export function buildSessionTodoLinkRows({ userId, sessionId, todoIds }) {
  return [...new Set(todoIds)]
    .filter(Boolean)
    .map((todoId) => ({
      user_id: userId,
      session_id: sessionId,
      todo_id: todoId,
    }));
}

export function getSessionLinkedTodos({ activeSessionId, links, todos }) {
  if (!activeSessionId) {
    return [];
  }

  const linkedTodoIds = new Set(
    links
      .filter((link) => link.session_id === activeSessionId)
      .map((link) => link.todo_id),
  );

  return todos
    .filter((todo) => linkedTodoIds.has(todo.id))
    .sort(compareTodosByPlanOrder);
}

export function summarizeSessionTodos(todos) {
  const total = todos.length;
  const completed = todos.filter((todo) => todo.is_completed).length;

  return {
    total,
    completed,
    message:
      total > 0
        ? `집중 세션을 종료했습니다. 이번 세션 할 일 ${completed}/${total}개 완료.`
        : "집중 세션을 종료했습니다.",
  };
}

function compareTodosByPlanOrder(left, right) {
  if (left.local_date !== right.local_date) {
    return left.local_date.localeCompare(right.local_date);
  }

  if (left.position !== right.position) {
    return left.position - right.position;
  }

  return String(left.created_at ?? "").localeCompare(String(right.created_at ?? ""));
}
