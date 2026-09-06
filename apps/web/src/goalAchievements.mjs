/** Derive badges from current goals; no separate achievement state to become stale. */
export function getGoalAchievements(goals) {
  const seen = new Set();
  return goals.filter((goal) => {
    if (goal.status !== "completed" || seen.has(goal.id)) return false;
    seen.add(goal.id);
    return true;
  }).sort((a, b) => {
    // Target date is a stable display order, not an achievement timestamp.
    if (a.target_date !== b.target_date) return a.target_date > b.target_date ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
