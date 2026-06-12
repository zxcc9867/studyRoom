self.addEventListener("push", (event) => {
  const payload = event.data?.json() ?? {};
  const title = payload.title ?? "독서실 출석 시간";
  const options = {
    body: payload.body ?? "첫 알림 후 30분 안에 입장하고 타이머를 시작하세요.",
    data: { url: payload.url ?? "/" },
    badge: "/favicon.svg",
    icon: "/favicon.svg",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(clients.openWindow(url));
});
