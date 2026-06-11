import { supabase } from "./supabase";
import { applicationServerKeyMatches } from "./webPushKeys.mjs";

export type WebPushStatus = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  serviceWorkerReady: boolean;
  subscribed: boolean;
  endpoint: string | null;
};

export async function registerWebPushTarget(userId: string): Promise<WebPushStatus> {
  const publicKey = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error("웹 푸시 공개키가 비어 있습니다. VITE_WEB_PUSH_VAPID_PUBLIC_KEY를 설정해야 합니다.");
  }

  ensurePushSupport();

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("브라우저 알림 권한이 허용되지 않았습니다.");
  }

  const registration = await navigator.serviceWorker.register("/service-worker.js");
  const readyRegistration = await navigator.serviceWorker.ready;
  const existingSubscription = await readyRegistration.pushManager.getSubscription();
  if (existingSubscription && !applicationServerKeyMatches(existingSubscription, publicKey)) {
    await existingSubscription.unsubscribe();
  }

  const currentSubscription = await readyRegistration.pushManager.getSubscription();
  const subscription =
    currentSubscription ??
    (await readyRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const { error } = await supabase.from("notification_targets").upsert(
    {
      user_id: userId,
      kind: "web_push",
      subscription: subscription.toJSON(),
      enabled: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,kind,target_key" },
  );

  if (error) {
    throw error;
  }

  return {
    supported: true,
    permission,
    serviceWorkerReady: Boolean(registration.active ?? readyRegistration.active),
    subscribed: true,
    endpoint: subscription.endpoint,
  };
}

export async function getWebPushStatus(): Promise<WebPushStatus> {
  const supported = isPushSupported();
  if (!supported) {
    return {
      supported: false,
      permission: "unsupported",
      serviceWorkerReady: false,
      subscribed: false,
      endpoint: null,
    };
  }

  const registration = await getStudyRoomServiceWorkerRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;

  return {
    supported: true,
    permission: Notification.permission,
    serviceWorkerReady: Boolean(registration?.active),
    subscribed: Boolean(subscription),
    endpoint: subscription?.endpoint ?? null,
  };
}

export async function showLocalTestNotification() {
  ensurePushSupport();

  if (Notification.permission !== "granted") {
    throw new Error("브라우저 알림 권한이 아직 필요합니다.");
  }

  const registration = (await getStudyRoomServiceWorkerRegistration()) ?? (await navigator.serviceWorker.ready);

  await registration.showNotification("독서실 알림 테스트", {
    body: "컴퓨터 알림이 정상적으로 등록되었습니다.",
    data: { url: "/" },
    icon: "/favicon.svg",
    badge: "/favicon.svg",
  });
}

function ensurePushSupport() {
  if (!isPushSupported()) {
    throw new Error("현재 브라우저는 컴퓨터 알림을 지원하지 않습니다.");
  }
}

function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function getStudyRoomServiceWorkerRegistration() {
  const registrationForAppScope = await navigator.serviceWorker.getRegistration("/");
  if (registrationForAppScope?.active?.scriptURL.endsWith("/service-worker.js")) {
    return registrationForAppScope;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  return (
    registrations.find((item) => item.active?.scriptURL.endsWith("/service-worker.js")) ??
    registrationForAppScope ??
    null
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const normalized = base64String.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new Error("웹 푸시 공개키 형식이 올바르지 않습니다.");
  }

  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const base64 = (normalized + padding).replace(/-/g, "+").replace(/_/g, "/");
  let rawData: string;
  try {
    rawData = window.atob(base64);
  } catch {
    throw new Error("웹 푸시 공개키를 디코딩할 수 없습니다. VAPID 공개키를 다시 생성하세요.");
  }

  if (rawData.length !== 65) {
    throw new Error("웹 푸시 공개키 길이가 올바르지 않습니다. VAPID 공개키를 다시 생성하세요.");
  }

  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
