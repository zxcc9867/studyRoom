export const dashboardSections: readonly ["today", "me", "settings"];
export type DashboardSection = (typeof dashboardSections)[number];
export function getDashboardSectionFromHash(hash: string): DashboardSection;
