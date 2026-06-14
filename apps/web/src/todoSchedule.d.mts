type TodoScheduleInput = {
  enabled: boolean;
  startTime?: string | null;
  endTime?: string | null;
};

type TodoScheduleResult =
  | {
      ok: true;
      startTime: string | null;
      endTime: string | null;
    }
  | {
      ok: false;
      message: string;
      startTime: null;
      endTime: null;
    };

type TodoScheduleLike = {
  title?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  startTime?: string | null;
  endTime?: string | null;
} | null;

export function normalizeTodoSchedule(input: TodoScheduleInput): TodoScheduleResult;
export function formatTodoScheduleLabel(todo: TodoScheduleLike): string;
export function formatTodoWithSchedule(todo: TodoScheduleLike): string;
