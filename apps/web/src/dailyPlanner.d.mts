export type DailyPlannerTodo = {
  id: string;
  local_date: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  is_completed?: boolean;
};

export type DailyPlannerSegment<TTodo extends DailyPlannerTodo = DailyPlannerTodo> = {
  id: string;
  todo: TTodo;
  title: string;
  startTime: string;
  endTime: string;
  startMinute: number;
  endMinute: number;
  durationMinutes: number;
  startAngle: number;
  endAngle: number;
  wrapsMidnight: boolean;
  overlaps: boolean;
  color: string;
};

export type DailyPlannerResult<TTodo extends DailyPlannerTodo = DailyPlannerTodo> = {
  segments: Array<DailyPlannerSegment<TTodo>>;
  unscheduledTodos: TTodo[];
};

export const DAILY_PLANNER_COLORS: string[];

export function timeToPlannerAngle(time: string): number;

export function plannerAngleToTime(angle: number): string;

export function buildDailyPlannerSegments<TTodo extends DailyPlannerTodo>(
  todos: TTodo[],
  dateKey: string,
): DailyPlannerResult<TTodo>;
