export const dashboardSections = ["today", "together", "goals", "feed", "forest", "me", "settings"];

export function getDashboardSectionFromHash(hash) {
  const value = String(hash ?? "");
  if (!value.startsWith("#")) return "today";

  const section = value.slice(1);
  if (section.startsWith("together?invite=")) return "together";
  return dashboardSections.includes(section) ? section : "today";
}
