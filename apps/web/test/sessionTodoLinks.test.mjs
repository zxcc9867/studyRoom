import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildSessionTodoLinkRows,
  getIncompleteTodayTodos,
  getSessionLinkedTodos,
  shouldRequestSessionTodoSelection,
  summarizeSessionTodos,
} from "../src/sessionTodoLinks.mjs";

const todos = [
  {
    id: "todo-later",
    local_date: "2026-06-22",
    title: "Next day",
    is_completed: false,
    position: 0,
    created_at: "2026-06-21T00:00:00.000Z",
  },
  {
    id: "todo-done",
    local_date: "2026-06-21",
    title: "Done",
    is_completed: true,
    position: 0,
    created_at: "2026-06-21T00:01:00.000Z",
  },
  {
    id: "todo-two",
    local_date: "2026-06-21",
    title: "Second",
    is_completed: false,
    position: 2,
    created_at: "2026-06-21T00:02:00.000Z",
  },
  {
    id: "todo-one",
    local_date: "2026-06-21",
    title: "First",
    is_completed: false,
    position: 1,
    created_at: "2026-06-21T00:03:00.000Z",
  },
];

test("getIncompleteTodayTodos returns today's incomplete todos in plan order", () => {
  assert.deepEqual(
    getIncompleteTodayTodos(todos, "2026-06-21").map((todo) => todo.id),
    ["todo-one", "todo-two"],
  );
});

test("shouldRequestSessionTodoSelection blocks starting without an active session plan", () => {
  assert.deepEqual(
    shouldRequestSessionTodoSelection({
      activeSession: false,
      incompleteTodayTodos: [],
      selectedTodoIds: undefined,
    }),
    { required: true, reason: "no-todos" },
  );

  assert.deepEqual(
    shouldRequestSessionTodoSelection({
      activeSession: false,
      incompleteTodayTodos: [todos[2]],
      selectedTodoIds: undefined,
    }),
    { required: true, reason: "select-todos" },
  );

  assert.deepEqual(
    shouldRequestSessionTodoSelection({
      activeSession: false,
      incompleteTodayTodos: [todos[2]],
      selectedTodoIds: ["todo-two"],
    }),
    { required: false, reason: null },
  );
});

test("buildSessionTodoLinkRows deduplicates selected todo ids", () => {
  assert.deepEqual(buildSessionTodoLinkRows({
    userId: "user-1",
    sessionId: "session-1",
    todoIds: ["todo-one", "todo-one", "todo-two"],
  }), [
    { user_id: "user-1", session_id: "session-1", todo_id: "todo-one" },
    { user_id: "user-1", session_id: "session-1", todo_id: "todo-two" },
  ]);
});

test("getSessionLinkedTodos returns todos linked to the active session", () => {
  const links = [
    { session_id: "session-other", todo_id: "todo-later" },
    { session_id: "session-1", todo_id: "todo-two" },
    { session_id: "session-1", todo_id: "todo-one" },
  ];

  assert.deepEqual(
    getSessionLinkedTodos({
      activeSessionId: "session-1",
      links,
      todos,
    }).map((todo) => todo.id),
    ["todo-one", "todo-two"],
  );
});

test("summarizeSessionTodos returns completed count and readable message", () => {
  assert.deepEqual(summarizeSessionTodos([]), {
    total: 0,
    completed: 0,
    message: "집중 세션을 종료했습니다.",
  });

  assert.deepEqual(summarizeSessionTodos([todos[1], todos[2]]), {
    total: 2,
    completed: 1,
    message: "집중 세션을 종료했습니다. 이번 세션 할 일 1/2개 완료.",
  });
});
