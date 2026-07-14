self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (_err) {
      payload = { title: "Canopy reminder", body: event.data.text() };
    }
  }

  const title = payload.title || "Canopy reminder";
  const scope = new URL(self.registration.scope);
  const basePath = scope.pathname.replace(/\/$/, "");
  const iconUrl = `${basePath}/icons/icon-192x192.png`.replace(/\/{2,}/g, "/");
  const options = {
    body: payload.body || "A quiet moment to reflect.",
    tag: payload.tag || "canopy-reminder",
    renotify: true,
    icon: iconUrl,
    badge: iconUrl,
    timestamp: Date.now(),
    data: {
      url: payload.url || "/capture",
      reminderType: payload.reminderType,
    },
    actions: [{ action: "open", title: "Open" }],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const scope = new URL(self.registration.scope);
  const basePath = scope.pathname.replace(/\/$/, "");
  const rawUrl = event.notification.data?.url || "/capture";
  const targetPath = rawUrl.startsWith(basePath)
    ? rawUrl
    : `${basePath}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
  const targetUrl = new URL(targetPath, self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) {
          return client.navigate(targetUrl);
        }
        return undefined;
      }
    }
    return clients.openWindow(targetUrl);
  })());
});
