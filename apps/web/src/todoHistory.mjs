export const DEFAULT_TODO_HISTORY_PAGE_SIZE = 10;

export function getCompletedTodoHistory(todos) {
  return [...todos]
    .filter((todo) => todo.is_completed)
    .sort((left, right) => {
      const dateOrder = right.local_date.localeCompare(left.local_date);
      if (dateOrder !== 0) return dateOrder;

      const createdOrder = right.created_at.localeCompare(left.created_at);
      if (createdOrder !== 0) return createdOrder;

      return left.position - right.position;
    });
}

export function paginateTodoHistory(items, page, pageSize = DEFAULT_TODO_HISTORY_PAGE_SIZE) {
  const safePageSize = Math.max(1, Math.trunc(pageSize));
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const requestedPage = Number.isFinite(page) ? Math.trunc(page) : 1;
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages);
  const startIndex = (currentPage - 1) * safePageSize;

  return {
    items: items.slice(startIndex, startIndex + safePageSize),
    currentPage,
    totalPages,
    totalItems,
    pageSize: safePageSize,
    hasPrevious: currentPage > 1,
    hasNext: currentPage < totalPages,
  };
}

export function calculateTodoHistoryStats(todos, monthKey) {
  const totalTodos = todos.length;
  const completedTodos = todos.filter((todo) => todo.is_completed).length;
  const monthCompletedTodos = todos.filter(
    (todo) => todo.is_completed && todo.local_date.startsWith(monthKey),
  ).length;

  return {
    totalTodos,
    completedTodos,
    completionPercent: totalTodos === 0 ? 0 : Math.round((completedTodos / totalTodos) * 100),
    monthCompletedTodos,
  };
}
