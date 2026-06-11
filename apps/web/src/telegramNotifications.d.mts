import type { Session } from "@supabase/supabase-js";

export type TelegramNotificationStatus = {
  connected: boolean;
  chatId: string;
  updatedAt: string | null;
};

export type TelegramTestAlarmResult = {
  ok: boolean;
  localDate: string;
  todoCount: number;
  messageId: number | null;
};

export function normalizeTelegramChatId(value: unknown): string;

export function isValidTelegramChatId(value: unknown): boolean;

export function getTelegramNotificationStatus(userId: string): Promise<TelegramNotificationStatus>;

export function saveTelegramNotificationTarget(userId: string, chatId: string): Promise<TelegramNotificationStatus>;

export function sendTelegramTestAlarm(session: Session): Promise<TelegramTestAlarmResult>;
