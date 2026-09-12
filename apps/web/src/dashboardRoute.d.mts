export const dashboardSections: readonly ["today", "goals", "feed", "forest", "me", "settings"];
export type DashboardSection = (typeof dashboardSections)[number];
export function getDashboardSectionFromHash(hash: string): DashboardSection;
