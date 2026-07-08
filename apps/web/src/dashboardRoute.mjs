export const dashboardSections = ["today", "goals", "forest", "me", "settings"];

export function getDashboardSectionFromHash(hash) {
  const value = String(hash ?? "");
  if (!value.startsWith("#")) return "today";

  const section = value.slice(1);
  return dashboardSections.includes(section) ? section : "today";
}
