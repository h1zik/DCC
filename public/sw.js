self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Pesan baru";
  const body = typeof data.body === "string" ? data.body : "Ada pesan chat baru.";
  const url = typeof data.url === "string" && data.url ? data.url : "/";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/next.svg",
      badge: "/next.svg",
      vibrate: [200, 120, 200],
      data: { url },
      tag: "dcc-chat-message",
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && client.url.includes(url)) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
      return undefined;
    }),
  );
});
