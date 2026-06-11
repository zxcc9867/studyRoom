import type { Session } from "@supabase/supabase-js";

export const KAKAO_CONNECT_PENDING_KEY: "study-room-kakao-connect-pending";

export type KakaoNotificationStatus = {
  connected: boolean;
  enabled: boolean;
  connectedAt: string | null;
  updatedAt: string | null;
  scope: string | null;
  needsTalkMessage: boolean;
};

export function getKakaoNotificationStatus(session: Session): Promise<KakaoNotificationStatus>;

export function saveKakaoProviderTokens(session: Session): Promise<KakaoNotificationStatus>;

export function disconnectKakaoNotifications(session: Session): Promise<KakaoNotificationStatus>;
