export type SessionTodoSchedule = {
  startTime: string;
  endTime: string;
};

export function getSuggestedSessionTodoSchedule(date?: Date): SessionTodoSchedule;
