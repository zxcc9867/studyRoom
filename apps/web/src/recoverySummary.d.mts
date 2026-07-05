export type RecoveryTriggerType = "missed_attendance" | "camera_absence_repeat";

export type RecoveryRequestSummaryItem = {
  id: string;
  local_date: string;
  trigger_type: RecoveryTriggerType;
  status: "pending" | "submitted";
  reason: string | null;
  makeup_todo_title: string | null;
  pledge_todo_title: string | null;
  created_at: string;
};

export type RecoveryReasonCategory = {
  id: string;
  label: string;
  keywords: string[];
  action: string;
};

export type RecoverySummaryCategory = {
  id: string;
  label: string;
  action: string;
  count: number;
};

export type RecoveryWeekRange = {
  weekStart: string;
  weekEnd: string;
};

export type RecoveryHistoryPage<T extends RecoveryRequestSummaryItem = RecoveryRequestSummaryItem> = {
  items: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

export type RecoveryWeeklySummary<T extends RecoveryRequestSummaryItem = RecoveryRequestSummaryItem> = {
  weekStart: string;
  weekEnd: string;
  totalCount: number;
  submittedCount: number;
  pendingCount: number;
  missedCount: number;
  cameraCount: number;
  categories: RecoverySummaryCategory[];
  topCategory: RecoverySummaryCategory | null;
  nextAction: string;
  requests: T[];
};

export const DEFAULT_RECOVERY_HISTORY_PAGE_SIZE: number;
export const RECOVERY_REASON_CATEGORIES: RecoveryReasonCategory[];
export const UNKNOWN_RECOVERY_CATEGORY: RecoveryReasonCategory;

export function classifyRecoveryReason<T extends Partial<RecoveryRequestSummaryItem>>(
  request: T,
): RecoveryReasonCategory;
export function getRecoveryTriggerLabel(triggerType: string): string;
export function getRecoveryWeekRange(dateKey: string): RecoveryWeekRange;
export function getPreviousRecoveryWeekRange(dateKey: string): RecoveryWeekRange;
export function paginateRecoveryHistory<T extends RecoveryRequestSummaryItem>(
  items: T[],
  page: number,
  pageSize?: number,
): RecoveryHistoryPage<T>;
export function summarizeRecoveryRequests<T extends RecoveryRequestSummaryItem>(
  requests: T[],
  dateKey: string,
): RecoveryWeeklySummary<T>;
export function summarizeRecoveryRequestsInRange<T extends RecoveryRequestSummaryItem>(
  requests: T[],
  weekStart: string,
  weekEnd: string,
): RecoveryWeeklySummary<T>;
