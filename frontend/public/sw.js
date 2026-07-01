self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json?.() || {};
  } catch (_error) {
    data = { title: "Rota notification", body: event.data?.text?.() || "You have a rota update." };
  }
  const title = data.title || "Rota notification";
  const options = {
    body: data.body || data.message || "You have a rota update.",
    icon: "/pwa-icon.svg",
    badge: "/pwa-icon.svg",
    tag: data.tag || data.type || "rota_update",
    renotify: data.type === "shift_reminder" || data.type === "shift_start",
    requireInteraction: data.type === "shift_start",
    vibrate: data.type === "shift_start" ? [300, 120, 300, 120, 500] : [200, 100, 200],
    data: {
      url: data.url || "/",
      type: data.type || "rota_update"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.focus();
      existing.navigate(targetUrl);
      return;
    }
    await self.clients.openWindow(targetUrl);
  })());
});
