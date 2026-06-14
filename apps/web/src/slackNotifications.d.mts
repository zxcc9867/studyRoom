import type { Session } from "@supabase/supabase-js";

export type SlackNotificationStatus = {
  connected: boolean;
  channelId: string;
  updatedAt: string | null;
};

export type SlackTestAlarmResult = {
  ok: boolean;
  localDate: string;
  todoCount: number;
  messageTs: string | null;
};

export function normalizeSlackChannelId(value: unknown): string;

export function isValidSlackChannelId(value: unknown): boolean;

export function getSlackNotificationStatus(userId: string): Promise<SlackNotificationStatus>;

export function saveSlackNotificationTarget(userId: string, channelId: string): Promise<SlackNotificationStatus>;

export function sendSlackTestAlarm(session: Session): Promise<SlackTestAlarmResult>;
