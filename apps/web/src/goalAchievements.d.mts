export type GoalAchievementLike = {
  id: string;
  title: string;
  target_date: string;
  status: string;
};

export function getGoalAchievements<T extends GoalAchievementLike>(goals: readonly T[]): T[];
